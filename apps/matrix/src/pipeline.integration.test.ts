/**
 * End-to-end integration: runs the real `build-matrix` / `diff-matrix` scripts
 * against a throwaway data dir and proves the living-matrix contract at the
 * filesystem level — the thing the pure-function tests can't: that an unchanged
 * weekly re-run mints NO new dated snapshot (kills date-churn) yet still records
 * the re-verification, and that a browser bump produces a real snapshot + a
 * `reverified` diff.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CiSnapshotSchema,
  MatrixSnapshotSchema,
  VerificationLogSchema,
  type CiSnapshot,
  type MatrixSnapshot,
} from './matrixSchema';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = join(pkgRoot, 'scripts');

let dataDir: string;
let renderedDir: string;

function runScript(script: string, pullDate: string): void {
  execFileSync('pnpm', ['exec', 'tsx', join(scripts, script)], {
    cwd: pkgRoot,
    env: {
      ...process.env,
      MATRIX_DATA_DIR: dataDir,
      MATRIX_RENDERED_DIR: renderedDir,
      MATRIX_PULL_DATE: pullDate,
    },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function writeBcd(date: string): void {
  const snap: MatrixSnapshot = MatrixSnapshotSchema.parse({
    schemaVersion: 1,
    pulledAt: date,
    bcdVersion: '8.0.0',
    crossReferences: [{ id: 'BCD', url: 'https://github.com/mdn/browser-compat-data' }],
    features: [{ id: 'webauthn', label: 'PublicKeyCredential (WebAuthn)', source: 'BCD' }],
    rows: [
      {
        feature: 'webauthn',
        featureLabel: 'WebAuthn',
        browser: 'Chrome',
        os: 'desktop',
        status: 'supported',
        since: '67',
        source: 'BCD',
        pulledAt: date,
      },
      {
        feature: 'webauthn',
        featureLabel: 'WebAuthn',
        browser: 'Firefox',
        os: 'desktop',
        status: 'supported',
        since: '60',
        source: 'BCD',
        pulledAt: date,
      },
    ],
  });
  writeFileSync(join(dataDir, `bcd.${date}.json`), JSON.stringify(snap, null, 2) + '\n');
}

function writeCi(date: string, chromium: string): void {
  const snap: CiSnapshot = CiSnapshotSchema.parse({
    schemaVersion: 1,
    pulledAt: date,
    runnerOs: 'linux',
    browsers: [{ name: 'Chromium', version: chromium, available: true }],
    gridResults: [
      {
        browser: 'Chromium',
        browserVersion: chromium,
        runnerOs: 'linux',
        transport: 'internal',
        residentKey: true,
        userVerification: true,
        created: true,
        asserted: true,
        verified: true,
        alg: -7,
      },
    ],
    rows: [
      {
        feature: 'webauthn',
        featureLabel: 'WebAuthn',
        browser: 'Chromium',
        os: 'linux',
        status: 'supported',
        since: null,
        source: 'ci',
        pulledAt: date,
        notes: 'virtual-authenticator create→get verified',
      },
    ],
    limitations: ['Virtual authenticators cannot reproduce biometrics or real high-S.'],
  });
  writeFileSync(join(dataDir, `ci.${date}.json`), JSON.stringify(snap, null, 2) + '\n');
}

const datedSnapshots = (): string[] =>
  readdirSync(dataDir)
    .filter((f) => /^matrix\.\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
const readLog = () =>
  VerificationLogSchema.parse(
    JSON.parse(readFileSync(join(dataDir, 'verification-log.json'), 'utf8')),
  );

describe('matrix pipeline (script-level integration)', () => {
  beforeAll(() => {
    const base = mkdtempSync(join(tmpdir(), 'matrix-it-'));
    dataDir = join(base, 'data');
    renderedDir = join(base, 'rendered');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(renderedDir, { recursive: true });
  });
  afterAll(() => {
    rmSync(join(dataDir, '..'), { recursive: true, force: true });
  });

  it('week 1: builds the first dated snapshot and logs the run', () => {
    writeBcd('2026-06-01');
    writeCi('2026-06-01', '148.0.7778.96');
    runScript('build-matrix.ts', '2026-06-01');

    expect(datedSnapshots()).toEqual(['matrix.2026-06-01.json']);
    const log = readLog();
    expect(log.runs).toHaveLength(1);
    expect(log.runs[0]).toMatchObject({
      ranAt: '2026-06-01',
      changed: true,
      canonicalVerified: true,
      snapshot: 'matrix.2026-06-01.json',
    });
  }, 60_000);

  it('week 2: unchanged data on a new date mints NO new snapshot (no churn) but logs the re-verification', () => {
    // Same BCD + same Chromium version, a week later.
    writeBcd('2026-06-08');
    writeCi('2026-06-08', '148.0.7778.96');
    runScript('build-matrix.ts', '2026-06-08');

    // still exactly one dated snapshot — the week-1 change-point
    expect(datedSnapshots()).toEqual(['matrix.2026-06-01.json']);
    const log = readLog();
    expect(log.runs).toHaveLength(2);
    expect(log.runs[1]).toMatchObject({
      ranAt: '2026-06-08',
      changed: false,
      snapshot: 'matrix.2026-06-01.json',
    });
  }, 60_000);

  it('week 3: a Chromium bump (same status) mints a snapshot and shows up as a re-verification in the diff', () => {
    writeBcd('2026-06-15');
    writeCi('2026-06-15', '149.0.0.1');
    runScript('build-matrix.ts', '2026-06-15');
    runScript('diff-matrix.ts', '2026-06-15');

    expect(datedSnapshots()).toEqual(['matrix.2026-06-01.json', 'matrix.2026-06-15.json']);

    const diffFile = readdirSync(dataDir).find((f) => /^matrix-diff\..*\.json$/.test(f));
    expect(diffFile).toBeTruthy();
    const diff = JSON.parse(readFileSync(join(dataDir, diffFile as string), 'utf8'));
    expect(diff.changed).toHaveLength(0);
    expect(diff.reverified).toHaveLength(1);
    expect(diff.reverified[0].cell).toBe('webauthn|Chrome|desktop');
    expect(diff.reverified[0].fromVersion).toContain('148.0.7778.96');
    expect(diff.reverified[0].toVersion).toContain('149.0.0.1');
  }, 60_000);
});
