import { defineConfig } from 'vite';

// @stellar/stellar-sdk expects Node globals in the browser; `Buffer` is polyfilled in
// index.html and `global` is aliased here, the same setup the other kit examples use.
//
// The kit is vendored from our fork's build (./kit, the dnt npm output with the
// PasskeyModule) until the upstream PR merges, and @soropass/core resolves to the
// workspace package (root pnpm override). Without dedupe Vite can bundle a second copy
// of stellar-sdk/stellar-base, the noble libs, or @soropass/core for the vendored
// package; two copies means an `xdr.Int64` built by one is rejected by the other's
// writer ("not a Hyper"). Force a single instance of each.
export default defineConfig({
  define: { global: 'globalThis' },
  server: { port: 5273, strictPort: true },
  preview: { port: 5273, strictPort: true },
  resolve: {
    dedupe: [
      '@soropass/core',
      '@stellar/stellar-sdk',
      '@stellar/stellar-base',
      '@noble/curves',
      '@noble/hashes',
    ],
  },
});
