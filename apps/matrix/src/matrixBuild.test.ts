import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MergedMatrixSnapshotSchema } from './matrixSchema';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

function loadLatestMatrix() {
  const files = readdirSync(dataDir)
    .filter((f) => /^matrix\..*\.json$/.test(f))
    .sort();
  const file = files.at(-1);
  if (!file) return null;
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  return MergedMatrixSnapshotSchema.parse(raw);
}

describe('merged matrix (S09)', () => {
  const matrix = loadLatestMatrix();

  it('exists and validates (run `pnpm matrix:build`)', () => {
    expect(matrix).not.toBeNull();
    expect(matrix?.cells.length).toBeGreaterThan(0);
  });

  it('GATE: every cell carries source + tier + a last-verified date', () => {
    for (const cell of matrix?.cells ?? []) {
      expect(cell.source.length).toBeGreaterThan(0);
      expect(['tier-1-automated', 'tier-2-manual']).toContain(cell.tier);
      expect(cell.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('CI machine-verified results override the desktop Chrome baseline', () => {
    const ciCells = (matrix?.cells ?? []).filter((c) => c.source === 'ci');
    expect(ciCells.length).toBeGreaterThan(0);
    const chromeWebauthn = matrix?.cells.find(
      (c) => c.browser === 'Chrome' && c.os === 'desktop' && c.feature === 'webauthn',
    );
    expect(chromeWebauthn?.source).toBe('ci');
    expect(chromeWebauthn?.tier).toBe('tier-1-automated');
  });
});
