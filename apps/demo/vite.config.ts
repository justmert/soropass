import { defineConfig } from 'vite';

// Vanilla TS demo. Workspace deps (@stellar-passkey/*) resolve via package
// `exports` to their built `dist` — run `pnpm -r build` before `dev`/`build`.
export default defineConfig({
  server: { port: 4321, strictPort: true },
  preview: { port: 4321, strictPort: true },
  build: { target: 'es2022' },
});
