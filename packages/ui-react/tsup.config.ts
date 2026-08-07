import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // React is a peer; @soropass/* resolve from the workspace. The design-sync
  // converter bundles those in when it compiles dist/ for claude.ai/design.
  external: [/^react/, /^react-dom/, /^@soropass\//],
});
