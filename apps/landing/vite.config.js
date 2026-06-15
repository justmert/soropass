import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// soropass.dev landing. Reuses @soropass/ui (real components) + @soropass/core
// (the SDK + factoryDeployer). The live demo pulls @stellar/stellar-sdk, so
// `global` is aliased and Buffer/process are polyfilled (src/polyfills.ts).
export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  server: { port: 5173, strictPort: true, host: true },
  preview: { port: 5173, strictPort: true, host: true },
});
