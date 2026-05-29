import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// apps/matrix/src → repo root
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const doc = readFileSync(join(root, 'docs/matrix/architecture.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'apps/matrix/package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('matrix architecture doc (S10)', () => {
  it('renders a mermaid flowchart', () => {
    expect(doc).toMatch(/```mermaid/);
    expect(doc).toMatch(/flowchart/);
  });

  it('GATE: every matrix:* command in the diagram is a real script (no aspirational boxes)', () => {
    const referenced = new Set([...doc.matchAll(/matrix:(?:pull|ci|build)/g)].map((m) => m[0]));
    expect(referenced.size).toBeGreaterThan(0);
    for (const cmd of referenced) expect(pkg.scripts[cmd]).toBeTruthy();
  });

  it('names the refresh cadence and the honest automation limits', () => {
    expect(doc).toMatch(/weekly cron/i);
    expect(doc).toMatch(/high-S|biometric|Secure Enclave/i);
    expect(doc).toMatch(/Tier-2/);
  });
});
