/**
 * The matrix builder. Merges the BCD static snapshot with the virtual-authenticator
 * CI snapshot into one dated, diffable matrix where every cell is tagged with
 * `source` + `tier` + `lastVerified`, and CI-verified cells also carry the exact
 * engine version (`verifiedOn`). CI (machine-verified) overrides BCD/curated for
 * the same cell. Run with `pnpm matrix:build`.
 *
 * Anti-churn: a new `data/matrix.<ISODATE>.json` is written ONLY when the matrix
 * substance or a verifying engine version actually changed. An unchanged weekly
 * re-run appends one honest line to `data/verification-log.json` (proof we
 * re-verified on this date + engine) and mints no new snapshot — so dated history
 * marks real change-points, not date stamps.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CiSnapshotSchema,
  MATRIX_SCHEMA_VERSION,
  ManualSessionsFileSchema,
  MatrixSnapshotSchema,
  MergedMatrixSnapshotSchema,
  VerificationLogSchema,
  type CiSnapshot,
  type ManualSession,
  type MergedMatrixSnapshot,
  type VerificationRun,
} from '../src/matrixSchema';
import { matrixChanged, mergeMatrix } from '../src/pipeline';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.MATRIX_DATA_DIR ?? join(here, '..', 'data');
const renderedDir = process.env.MATRIX_RENDERED_DIR ?? join(here, '..', 'rendered');
const builtAt = process.env.MATRIX_PULL_DATE ?? new Date().toISOString().slice(0, 10);

function latestFile(prefix: string): string | null {
  const files = readdirSync(dataDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort();
  return files.at(-1) ?? null;
}
const readJson = (file: string): unknown => JSON.parse(readFileSync(join(dataDir, file), 'utf8'));

// ── inputs ───────────────────────────────────────────────────────────────────
const bcdFile = latestFile('bcd.');
const ciFile = latestFile('ci.');
const bcd = bcdFile ? MatrixSnapshotSchema.parse(readJson(bcdFile)) : null;
const ci = ciFile ? CiSnapshotSchema.parse(readJson(ciFile)) : null;

let manual: ManualSession[] | null = null;
try {
  manual = ManualSessionsFileSchema.parse(readJson('manual-sessions.json')).sessions;
} catch {
  /* no manual-sessions.json — real-device evidence is optional */
}

const next = mergeMatrix({ bcd, ci, manual, bcdFile, ciFile, builtAt });

// The latest already-committed dated snapshot (the change-point we compare to).
const prevFile = readdirSync(dataDir)
  .filter((f) => /^matrix\.\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .at(-1);
const prev: MergedMatrixSnapshot | null = prevFile
  ? MergedMatrixSnapshotSchema.parse(readJson(prevFile))
  : null;

const changed = matrixChanged(prev, next);
mkdirSync(dataDir, { recursive: true });

// The snapshot the docs should render: the newly-written one, or the unchanged prior.
let resolved: MergedMatrixSnapshot;
let resolvedFile: string;
if (changed) {
  resolvedFile = `matrix.${builtAt}.json`;
  resolved = next;
  writeFileSync(join(dataDir, resolvedFile), JSON.stringify(next, null, 2) + '\n');
  writeFileSync(
    join(dataDir, 'matrix-latest.json'),
    JSON.stringify(
      { latestSnapshot: resolvedFile, builtAt, cellCount: next.cells.length, inputs: next.inputs },
      null,
      2,
    ) + '\n',
  );
} else {
  // Unchanged — keep the prior change-point; do NOT mint a byte-different dated file.
  resolvedFile = prevFile as string;
  resolved = prev as MergedMatrixSnapshot;
}

// ── verification log (freshness proof, appended EVERY run) ────────────────────
function canonicalVerified(snap: CiSnapshot | null): boolean {
  return (
    snap?.gridResults.some(
      (g) =>
        g.transport === 'internal' &&
        g.residentKey &&
        g.userVerification &&
        g.verified &&
        g.alg === -7,
    ) ?? false
  );
}
const run: VerificationRun = {
  ranAt: builtAt,
  runnerOs: ci?.runnerOs ?? process.platform,
  bcdVersion: bcd?.bcdVersion ?? 'unknown',
  engines: ci
    ? ci.browsers.filter((b) => b.available).map((b) => ({ browser: b.name, version: b.version }))
    : [],
  canonicalVerified: canonicalVerified(ci),
  snapshot: resolvedFile,
  changed,
};
const logPath = join(dataDir, 'verification-log.json');
let log = {
  schemaVersion: MATRIX_SCHEMA_VERSION as typeof MATRIX_SCHEMA_VERSION,
  runs: [] as VerificationRun[],
};
try {
  log = VerificationLogSchema.parse(readJson('verification-log.json'));
} catch {
  /* first run — start a fresh log */
}
// Replace a same-date run (idempotent re-runs on one day), else append; keep the last 200.
log.runs = [...log.runs.filter((r) => r.ranAt !== run.ranAt), run]
  .sort((a, b) => a.ranAt.localeCompare(b.ranAt))
  .slice(-200);
writeFileSync(logPath, JSON.stringify(VerificationLogSchema.parse(log), null, 2) + '\n');

// ── render the markdown grid (stamped with the snapshot's change date) ────────
const STATUS_ICON: Record<string, string> = {
  supported: '✅',
  unsupported: '❌',
  partial: '🟡',
  unknown: '❔',
};
const TIER_LABEL: Record<string, string> = {
  'tier-1-automated': 'T1 · automated',
  'tier-2-manual': 'T2 · manual',
};
const featureLabel = (id: string): string =>
  resolved.features.find((f) => f.id === id)?.label ?? id;

let md = `<!-- GENERATED by \`pnpm matrix:build\`. Do not edit by hand. -->\n`;
md += `_Data as of ${resolved.builtAt}`;
if (run.engines.length)
  md += `; re-verified ${builtAt} on ${run.engines.map((e) => `${e.browser} ${e.version}`).join(', ')} (${run.runnerOs})`;
md += `._\n`;
for (const feature of resolved.features) {
  const rows = resolved.cells.filter((c) => c.feature === feature.id);
  if (rows.length === 0) continue;
  md += `\n### ${featureLabel(feature.id)}\n\n`;
  md += `| Browser / OS | Status | Source | Tier | Verified on | Last verified |\n`;
  md += `| --- | --- | --- | --- | --- | --- |\n`;
  for (const c of rows) {
    const icon = STATUS_ICON[c.status] ?? '';
    const engine = c.verifiedOn ? `${c.verifiedOn.browser} ${c.verifiedOn.version}` : '—';
    md += `| ${c.browser} / ${c.os} | ${icon} ${c.status} | \`${c.source}\` | ${TIER_LABEL[c.tier] ?? c.tier} | ${engine} | ${c.lastVerified} |\n`;
  }
}
mkdirSync(renderedDir, { recursive: true });
writeFileSync(join(renderedDir, 'matrix-table.md'), md);

console.log(
  `matrix:build → ${changed ? `wrote ${resolvedFile} (substance changed)` : `no change; kept ${resolvedFile}`}; ` +
    `${String(resolved.cells.length)} cells from bcd=${bcdFile ?? '–'} ci=${ciFile ?? '–'}; ` +
    `logged re-verification ${builtAt} (canonical ${run.canonicalVerified ? '✓' : '✗'}).`,
);
