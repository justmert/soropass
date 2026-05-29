import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Invariant #6: @stellar/stellar-sdk is a peer dependency and must never be
  // bundled into the SDK output.
  external: ['@stellar/stellar-sdk'],
});
