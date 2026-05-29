import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATTLE_TESTED_ANCHORS } from './anchors';

const srcDir = dirname(fileURLToPath(import.meta.url)); // packages/core/src
const repoRoot = join(srcDir, '..', '..', '..');
const doc = readFileSync(join(repoRoot, 'docs/security/threat-model.md'), 'utf8');

function collectTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...collectTestFiles(join(dir, entry.name)));
    else if (entry.name.endsWith('.test.ts')) out.push(entry.name);
  }
  return out;
}
const testFiles = collectTestFiles(srcDir);

describe('threat model (S14) — no mitigation without a backing test', () => {
  it('GATE: every referenced *.test.ts exists under packages/core/src', () => {
    const referenced = new Set(
      [...doc.matchAll(/`([\w.-]+\.test\.ts)`/g)].flatMap((m) => (m[1] ? [m[1]] : [])),
    );
    expect(referenced.size).toBeGreaterThan(0);
    for (const file of referenced) expect(testFiles).toContain(file);
  });

  it('every referenced anchor id is a real BATTLE_TESTED_ANCHOR', () => {
    const anchorValues = new Set<string>(Object.values(BATTLE_TESTED_ANCHORS));
    const referenced = new Set(
      [...doc.matchAll(/`(low-s-normalization|rs256-hard-fail|apple-user-gesture)`/g)].flatMap(
        (m) => (m[1] ? [m[1]] : []),
      ),
    );
    expect(referenced.size).toBe(3);
    for (const id of referenced) expect(anchorValues.has(id)).toBe(true);
  });

  it('covers every required threat + the auditor trust-boundaries section', () => {
    const required = [
      /low-s/i,
      /challenge|replay/i,
      /signCount/,
      /RP-ID|rpId/i,
      /Related Origin/i,
      /attestation/i,
      /recover/i,
      /trust boundaries|for auditors/i,
    ];
    for (const topic of required) expect(doc).toMatch(topic);
  });
});
