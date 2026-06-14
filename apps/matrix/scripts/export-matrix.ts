/**
 * Copy the latest matrix data snapshots to the docs site's `/public/matrix/` so the
 * Mintlify compatibility explorer can `fetch` them. Mintlify can't import the Zod
 * schema or read repo files, but fetching flat JSON from its own /public is
 * allowed — this is what turns the static table into a live, sourced, dated,
 * diffable, filterable explorer.
 *
 * Run with `pnpm --filter @stellar-passkey/matrix docs:export` (after matrix:build).
 */
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
// Output base is site-agnostic: the docs site sets DOCS_PUBLIC_DIR to its own
// /public at build; default is apps/matrix/public (gitignored, regenerable).
const publicDir = process.env.DOCS_PUBLIC_DIR ?? join(here, '..', 'public');
const outDir = join(publicDir, 'matrix');

function latest(prefix: string): string | null {
  const files = readdirSync(dataDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort();
  return files.at(-1) ?? null;
}

mkdirSync(outDir, { recursive: true });

// The pointer files (stable names) + the latest dated snapshot/diff/ci/bcd.
const PREFIXES = ['matrix-latest.', 'latest.', 'matrix.', 'matrix-diff.', 'ci.', 'bcd.'];
const copied: string[] = [];
for (const prefix of PREFIXES) {
  const file = latest(prefix);
  if (file) {
    copyFileSync(join(dataDir, file), join(outDir, file));
    copied.push(file);
  }
}

// A stable manifest so the docs know the canonical (dated) filenames to fetch.
const manifest = {
  pointers: { matrixLatest: 'matrix-latest.json', bcdLatest: 'latest.json' },
  latest: {
    matrix: copied.find((f) => /^matrix\.\d/.test(f)) ?? null,
    diff: copied.find((f) => f.startsWith('matrix-diff.')) ?? null,
    ci: copied.find((f) => /^ci\.\d/.test(f)) ?? null,
    bcd: copied.find((f) => /^bcd\.\d/.test(f)) ?? null,
  },
  files: copied,
};
writeFileSync(join(outDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`export-matrix → ${outDir}`);
for (const f of copied) console.log(`  ${f}`);
console.log(`  index.json (manifest)`);
