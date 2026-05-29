import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // @stellar-passkey/core, @stellar/*, @noble/* all stay external.
  external: [/^@stellar(-passkey)?\//, /^@noble\//],
});
