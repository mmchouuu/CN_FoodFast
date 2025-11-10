import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
    },
  });
};