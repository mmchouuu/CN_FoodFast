import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

const buildHttpsConfig = (env) => {
  const wantsHttps = String(env.VITE_DEV_HTTPS ?? '').toLowerCase() === 'true';
  if (!wantsHttps) return false;

  const certPath = path.resolve(env.VITE_DEV_SSL_CERT || 'certs/lan-dev.pem');
  const keyPath = path.resolve(env.VITE_DEV_SSL_KEY || 'certs/lan-dev-key.pem');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.warn(
      `[vite] HTTPS disabled – missing TLS files at ${certPath} or ${keyPath}. ` +
        'Generate the dev certificate first (see docs/dev-https.md).',
    );
    return false;
  }

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    minVersion: 'TLSv1.2',
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const preferredHost = env.VITE_DEV_HOST || env.VITE_LAN_IP || '0.0.0.0';
  const portFromEnv = Number(env.VITE_DEV_PORT || 5173);
  const devPort = Number.isFinite(portFromEnv) && portFromEnv > 0 ? portFromEnv : 5173;
  const httpsConfig = buildHttpsConfig(env);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: preferredHost || '0.0.0.0',
      port: devPort,
      https: httpsConfig || false,
      strictPort: true,
    },
    preview: {
      host: preferredHost || '0.0.0.0',
      port: devPort,
      https: httpsConfig || false,
    },
  };
});
