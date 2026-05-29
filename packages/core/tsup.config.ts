import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    create: 'src/create.ts',
    connect: 'src/connect.ts',
    sign: 'src/sign.ts',
    recover: 'src/recover.ts',
    types: 'src/types.ts',
    // Deterministic mock mode — separate entry so it stays out of prod bundles.
    testing: 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Invariant #6: never bundle @stellar/stellar-sdk; @noble/* stays external too.
  external: [/^@stellar\//, /^@noble\//],
});
