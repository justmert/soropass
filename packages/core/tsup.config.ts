import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/create.ts',
    'src/connect.ts',
    'src/sign.ts',
    'src/recover.ts',
    'src/types.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Invariant #6: never bundle @stellar/stellar-sdk; @noble/* stays external
  // too (normal deps) so the SDK output carries no vendored crypto.
  external: [/^@stellar\//, /^@noble\//],
});
