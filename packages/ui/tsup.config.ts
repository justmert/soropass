import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    headless: 'src/headless/index.ts',
    styled: 'src/styled/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // No styling deps; core stays external (types only). CSS ships as static files.
  external: [/^@stellar(-passkey)?\//, /^@noble\//],
});
