import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Invariant #6: `@stellar/stellar-sdk` must be a PEER dependency and must never be
 * bundled into the SDK output (a wallet app supplies its own copy; bundling would
 * duplicate multi-MB of XDR/crypto and risk two incompatible instances). This
 * proves both the manifest shape and the actual built artifacts.
 */
const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const SDK = '@stellar/stellar-sdk';

describe('build smoke: @stellar/stellar-sdk is a peer dep and not bundled (invariant #6)', () => {
  it('declares it as a peer dependency, never a regular (runtime) dependency', () => {
    expect(pkg.peerDependencies?.[SDK]).toBeDefined();
    expect(pkg.dependencies?.[SDK]).toBeUndefined();
  });

  it('externalizes it in the built ESM + CJS output (referenced, not inlined)', () => {
    if (!existsSync(distDir)) {
      // dist only exists after `pnpm build`; CI builds before test, so skip cleanly locally.
      return;
    }
    const files = readdirSync(distDir).filter((f) => f.endsWith('.js') || f.endsWith('.cjs'));
    expect(files.length).toBeGreaterThan(0);

    const read = (f: string): string => readFileSync(`${distDir}/${f}`, 'utf8');
    const esmImportsSdk = files
      .filter((f) => f.endsWith('.js'))
      .some((f) => /from\s*['"]@stellar\/stellar-sdk['"]/.test(read(f)));
    const cjsRequiresSdk = files
      .filter((f) => f.endsWith('.cjs'))
      .some((f) => /require\(\s*['"]@stellar\/stellar-sdk['"]\s*\)/.test(read(f)));

    // Present as an external module specifier ⇒ the SDK is a runtime import, not inlined.
    expect(esmImportsSdk).toBe(true);
    expect(cjsRequiresSdk).toBe(true);

    // Size guard: stellar-sdk alone is multiple MB. If any chunk had inlined it, that
    // chunk would balloon; every built chunk stays small precisely because it is external.
    const largest = Math.max(...files.map((f) => statSync(`${distDir}/${f}`).size));
    expect(largest).toBeLessThan(500 * 1024);
  });
});
