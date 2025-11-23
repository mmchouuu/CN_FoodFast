# HTTPS over LAN for local Stripe testing

Stripe Elements/Checkout only works on secure origins, so both the API Gateway and the Vite dev server need HTTPS certificates that match your LAN IP.

## 1. Pick the LAN IP once
1. Run `ipconfig` (Windows) or `ifconfig` (macOS/Linux) and copy the IPv4 address of the network interface you want to test on (for example `192.168.2.19`).
2. Put that value in both env files:
   - `server/apps/api-gateway/.env` → `LAN_IP` and the `GATEWAY_SSL_*` settings.
   - `client/.env` → `VITE_LAN_IP`, `VITE_API_BASE_URL`, and (optionally) `VITE_DEV_HOST`.

Only these two files need to change the next time you switch Wi-Fi networks.

## 2. Generate LAN certificates with mkcert
`mkcert` yields browser-trusted certs for dev. Install it once (`choco install mkcert` on Windows, `brew install mkcert` on macOS, or use your package manager) and run `mkcert -install` to trust the mkcert CA.

Regenerate the cert/key pair every time you change the LAN IP:

```bash
# From the repo root
mkcert -cert-file server/apps/api-gateway/certs/lan-dev.pem \
       -key-file  server/apps/api-gateway/certs/lan-dev-key.pem \
       192.168.2.19 localhost 127.0.0.1 ::1

mkcert -cert-file client/certs/lan-dev.pem \
       -key-file  client/certs/lan-dev-key.pem \
       192.168.2.19 localhost 127.0.0.1 ::1
```

If you prefer to reuse the same certificate for both frontend and backend, point the env vars at the same PEM files.

> Tip: keep the certificate files out of source control. Add them to `.gitignore` (or double-check `git status`) before committing.

## 3. Run the services over HTTPS
- API Gateway: the existing `GATEWAY_HTTPS_ENABLED=true` flag uses the LAN cert when you run `npm start` or `docker compose up api-gateway`. The Docker entrypoint auto-generates a fallback certificate with the `LAN_IP` baked into `subjectAltName` if the files are missing.
- Frontend: `vite.config.js` now reads the Vite env vars and enables HTTPS (including WSS for HMR) when `VITE_DEV_HTTPS=true`. Start it normally with `npm run dev` inside `client/` and browse to `https://192.168.2.19:5173`.

At this point Stripe can load its iframe without mixed-content errors because both origins run on HTTPS with hostnames matching the LAN address.

## 4. Access from iOS/Android via a public tunnel (optional)
When the mobile device is not on the same LAN, expose the services through a tunnel provider such as Cloudflare Tunnel or ngrok.

### Example: Cloudflare Tunnel

1. Start your local services normally (Vite on 5173, API Gateway on 8080).
2. Create two tunnels, one per port. Cloudflare will give you URLs similar to:
   - Frontend: `https://barrier-reached-three-milk.trycloudflare.com`
   - Backend/API: `https://items-buddy-puzzles-cleveland.trycloudflare.com`
3. Update `client/.env`:
   - `VITE_API_BASE_URL=https://items-buddy-puzzles-cleveland.trycloudflare.com`
   - Keep the HTTPS dev settings so the tunnel can forward WebSocket/HMR traffic.
4. Restart `npm run dev` so Vite picks up the env changes.
5. Browse the frontend via the Cloudflare URL on iOS/Android. All API calls will route through the tunneled backend URL over HTTPS.

> Tip: when Cloudflare gives you new URLs, only `client/.env` needs to change. The API Gateway already allows any origin by echoing `Access-Control-Allow-Origin` so the new host is immediately valid.

### Example: ngrok
- Expose each port individually: `ngrok http https://192.168.2.19:8080` and `ngrok http https://192.168.2.19:5173`.
- Point `VITE_API_BASE_URL` at the backend tunnel URL and open the frontend tunnel from mobile browsers.
- Stripe webhooks can also target the backend tunnel URL (e.g. `https://<ngrok-id>.ngrok-free.app/api/payments/webhook`).

Tunnel URLs terminate TLS with trusted certificates, so you can test Stripe on devices that do not trust your mkcert self-signed certificates.

### Current shared URLs
- Frontend: `https://barrier-reached-three-milk.trycloudflare.com`
- Backend/API: `https://items-buddy-puzzles-cleveland.trycloudflare.com`

Update this section whenever Cloudflare reassigns new tunnel hostnames so your teammates know which URLs to use.
