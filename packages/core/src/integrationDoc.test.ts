import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const doc = readFileSync(join(repoRoot, 'docs/integration/stellar-wallets-kit.md'), 'utf8');

describe('stellar-wallets-kit integration design (S16)', () => {
  it('GATE: pins the exact studied version', () => {
    expect(doc).toMatch(/`@creit-tech\/stellar-wallets-kit`\s*`?2\.2\.0`?/);
  });

  it('covers all five ModuleInterface methods + metadata + isAvailable budget', () => {
    for (const method of [
      'getAddress',
      'signTransaction',
      'signAuthEntry',
      'signMessage',
      'getNetwork',
    ]) {
      expect(doc).toContain(method);
    }
    for (const meta of ['moduleType', 'productId', 'productName', 'productIcon', 'isAvailable']) {
      expect(doc).toContain(meta);
    }
    expect(doc).toMatch(/500\s?ms|≤500/); // isAvailable / isUVPAA budget
  });

  it('reconciles the C-address (smart-account) story and lists maintainer questions', () => {
    expect(doc).toMatch(/C-address|C…|contract address/i);
    expect(doc).toMatch(/Open questions/i);
    expect(doc).toMatch(/Issue #90/);
  });
});
