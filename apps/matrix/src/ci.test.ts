import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CiSnapshotSchema } from './matrixSchema';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

function loadLatestCiSnapshot() {
  const files = readdirSync(dataDir)
    .filter((f) => /^ci\..*\.json$/.test(f))
    .sort();
  const file = files.at(-1);
  if (!file) return null;
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  return CiSnapshotSchema.parse(raw);
}

describe('virtual-authenticator CI snapshot', () => {
  const snap = loadLatestCiSnapshot();

  it('exists and validates against CiSnapshotSchema (run `pnpm matrix:ci` to (re)generate)', () => {
    expect(snap).not.toBeNull();
    expect(snap?.gridResults.length).toBeGreaterThan(0);
    expect(snap?.browsers.some((b) => b.available)).toBe(true);
  });

  it('GATE: a canonical internal/residentKey/UV cell verified via p256.verify with alg -7', () => {
    const canonical = snap?.gridResults.find(
      (g) =>
        g.transport === 'internal' &&
        g.residentKey &&
        g.userVerification &&
        g.verified &&
        g.alg === -7,
    );
    expect(canonical).toBeTruthy();
  });

  it('every grid cell that completed create+get verified its round-trip', () => {
    const completed = snap?.gridResults.filter((g) => g.created && g.asserted) ?? [];
    expect(completed.length).toBeGreaterThan(0);
    for (const cell of completed) expect(cell.verified).toBe(true);
  });

  it('documents virtual-authenticator limitations (high-S, biometrics, WebView)', () => {
    expect((snap?.limitations ?? []).length).toBeGreaterThan(0);
  });
});
