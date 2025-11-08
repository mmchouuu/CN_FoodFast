import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const stripeContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://workable-basilisk-31.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://workable-basilisk-31.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com",
  "connect-src 'self' https://localhost:8080 https://api.stripe.com https://m.stripe.network https://m.stripe.com https://q.stripe.com https://api.clerk.dev https://workable-basilisk-31.clerk.accounts.dev https://*.clerk.dev https://*.clerk.com",
  "img-src 'self' data: https://q.stripe.com https://m.stripe.network https://m.stripe.com https://b.stripecdn.com https://images.clerk.dev https://img.clerk.com",
].join('; ');

const resolveHttpsConfig = (env) => {
  if (env.VITE_DEV_HTTPS !== 'true') {
    return undefined;
  }

  const certPath = env.VITE_DEV_SSL_CERT || './certs/localhost.pem';
  const keyPath = env.VITE_DEV_SSL_KEY || './certs/localhost-key.pem';

  try {
    const cert = fs.readFileSync(path.resolve(certPath));
    const key = fs.readFileSync(path.resolve(keyPath));
    return { cert, key };
  } catch (error) {
    console.warn(
      '[vite] Unable to read HTTPS cert/key. Falling back to HTTP.',
      error.message,
    );
    return undefined;
  }
};

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return defineConfig({
    plugins: [tailwindcss(), react()],
    server: {
      host: env.VITE_DEV_HOST || 'localhost',
      port: Number(env.VITE_DEV_PORT || 5173),
      https: resolveHttpsConfig(env),
      headers: {
        'Content-Security-Policy': stripeContentSecurityPolicy,
      },
    },
  });
};
