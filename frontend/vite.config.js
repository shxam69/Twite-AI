import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'
import path from 'path'

// Check for custom mkcert certificates in certs/ directory
const rootDir = import.meta.dirname || process.cwd();
const certPath = path.resolve(rootDir, 'certs/cert.pem');
const keyPath = path.resolve(rootDir, 'certs/key.pem');
const hasCustomCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    !hasCustomCerts && basicSsl(),
  ].filter(Boolean),
  server: {
    host: true,
    port: 5173,
    https: hasCustomCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
