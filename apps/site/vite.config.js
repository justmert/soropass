import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bespoke React docs site. Workspace deps (@soropass/ui, @soropass/core) resolve
// via package `exports` to their built `dist` — run `pnpm -r build` before dev.
// Real create/sign/recover components are mounted natively (RealScreen.jsx).
export default defineConfig({
  plugins: [react()],
  server: { port: 4444, strictPort: true, host: true },
  preview: { port: 4444, strictPort: true, host: true },
});
