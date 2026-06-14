import { defineConfig } from 'vite';

// Vanilla TS demo. Workspace deps (@stellar-passkey/*) resolve via package
// `exports` to their built `dist` — run `pnpm -r build` before `dev`/`build`.
export default defineConfig({
  server: { port: 4321, strictPort: true },
  preview: { port: 4321, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      // Two entries: the full gallery demo (index.html) and the docs embed
      // target (embed.html) the Mintlify docs iframe for live previews.
      input: { main: 'index.html', embed: 'embed.html' },
    },
  },
});
