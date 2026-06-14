/**
 * Measure the real per-subpath bundle cost of `@stellar-passkey/core` (the
 * "minimal SDK" proof). Each public subpath is bundled with esbuild — tree-shaken
 * and minified, with the peer deps (`@stellar/*`, `@noble/*`) externalized exactly
 * as a consumer's bundler would — then measured raw + gzip. Writes a flat JSON the
 * Mintlify docs fetch to render live bundle-size badges (Mintlify can't read repo
 * files, but `fetch` of a static JSON is allowed).
 *
 * Run with `pnpm --filter @stellar-passkey/matrix docs:sizes` (build core first).
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const coreDist = join(repo, 'packages', 'core', 'dist');
const outFile = join(repo, 'apps', 'docs', 'public', 'bundle-sizes.json');

const ENTRIES: { subpath: string; file: string; devOnly?: boolean }[] = [
  { subpath: '@stellar-passkey/core', file: 'index.js' },
  { subpath: '@stellar-passkey/core/create', file: 'create.js' },
  { subpath: '@stellar-passkey/core/connect', file: 'connect.js' },
  { subpath: '@stellar-passkey/core/sign', file: 'sign.js' },
  { subpath: '@stellar-passkey/core/recover', file: 'recover.js' },
  { subpath: '@stellar-passkey/core/types', file: 'types.js' },
  { subpath: '@stellar-passkey/core/testing', file: 'testing.js', devOnly: true },
];

interface Entry {
  subpath: string;
  rawBytes: number;
  gzipBytes: number;
  devOnly: boolean;
}

const entries: Entry[] = [];
for (const e of ENTRIES) {
  const out = await esbuild.build({
    entryPoints: [join(coreDist, e.file)],
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    target: 'es2022',
    // Externalize peers exactly as a downstream bundler would (never inlined).
    external: ['@stellar/*', '@noble/*'],
  });
  const code = out.outputFiles[0]?.contents ?? new Uint8Array();
  entries.push({
    subpath: e.subpath,
    rawBytes: code.byteLength,
    gzipBytes: gzipSync(Buffer.from(code)).byteLength,
    devOnly: e.devOnly ?? false,
  });
}

mkdirSync(dirname(outFile), { recursive: true });
const measuredAt = process.env.SOURCE_DATE ?? new Date().toISOString().slice(0, 10);
writeFileSync(
  outFile,
  JSON.stringify({ measuredAt, note: 'minified + gzip, @stellar/* and @noble/* externalized (peer deps)', entries }, null, 2) + '\n',
);

console.log(`bundle-sizes → ${outFile} (measured ${measuredAt})`);
for (const r of entries) {
  console.log(`  ${r.subpath}: ${String(r.rawBytes)} B raw / ${String(r.gzipBytes)} B gzip${r.devOnly ? ' (dev-only)' : ''}`);
}
