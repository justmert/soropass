import { defineConfig } from 'vite';

// Vanilla TS demo. Workspace deps (@soropass/*) resolve via package
// `exports` to their built `dist` — run `pnpm -r build` before `dev`/`build`.
// The on-chain demo (onchain.html) pulls @stellar/stellar-sdk; `global` is
// aliased to globalThis here and Buffer/process are polyfilled in src/polyfills.ts.
export default defineConfig({
  define: { global: 'globalThis' },
  server: { port: 4321, strictPort: true },
  preview: { port: 4321, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      // Three entries: the gallery (index.html), the docs embed target
      // (embed.html), and the live on-chain testnet demo (onchain.html).
      input: { main: 'index.html', embed: 'embed.html', onchain: 'onchain.html' },
    },
  },
});
