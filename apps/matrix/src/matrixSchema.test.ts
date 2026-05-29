import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatrixSnapshotSchema } from './matrixSchema';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

function loadLatestSnapshot() {
  const pointer = JSON.parse(readFileSync(join(dataDir, 'latest.json'), 'utf8')) as {
    latestSnapshot: string;
  };
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, pointer.latestSnapshot), 'utf8'));
  // Re-validating on read proves the committed snapshot conforms to the schema.
  return MatrixSnapshotSchema.parse(raw);
}

describe('BCD matrix snapshot', () => {
  const snap = loadLatestSnapshot();

  it('validates against MatrixSnapshotSchema', () => {
    expect(snap.schemaVersion).toBe(1);
    expect(snap.rows.length).toBeGreaterThan(0);
    expect(snap.bcdVersion).not.toBe('unknown');
  });

  it('GATE: includes ES256/alg, conditional UI, related-origin and hybrid rows keyed by browser+OS', () => {
    for (const id of [
      'es256_alg',
      'conditional_mediation',
      'related_origin_requests',
      'hybrid_transport',
    ]) {
      const featureRows = snap.rows.filter((r) => r.feature === id);
      expect(featureRows.length).toBeGreaterThan(0);
      expect(featureRows.every((r) => r.browser.length > 0 && r.os.length > 0)).toBe(true);
    }
    // keyed by browser+OS across platforms (incl. iOS, the passkey-critical one)
    expect(snap.rows.some((r) => r.browser === 'Safari' && r.os === 'iOS')).toBe(true);
    expect(snap.rows.some((r) => r.browser === 'Chrome' && r.os === 'Android')).toBe(true);
  });

  it('every row carries a source + matching pulledAt; curated rows cite a source URL', () => {
    expect(snap.rows.every((r) => r.pulledAt === snap.pulledAt)).toBe(true);
    const curated = snap.rows.filter((r) => r.source !== 'BCD');
    expect(curated.length).toBeGreaterThan(0);
    expect(
      curated.every((r) => typeof r.sourceUrl === 'string' && r.sourceUrl.startsWith('http')),
    ).toBe(true);
  });
});
