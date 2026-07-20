import { describe, expect, it } from 'vitest';
import {
  MergedMatrixSnapshotSchema,
  type CiSnapshot,
  type MatrixRow,
  type MatrixSnapshot,
  type Source,
  type Status,
} from './matrixSchema';
import {
  changeFingerprint,
  diffSnapshots,
  matrixChanged,
  mergeMatrix,
  substanceFingerprint,
  tierForSource,
} from './pipeline';

// ── fixture builders ─────────────────────────────────────────────────────────
function mkRow(o: {
  feature: string;
  browser: string;
  os: string;
  status: Status;
  source: Source;
  pulledAt: string;
  notes?: string;
}): MatrixRow {
  return { featureLabel: o.feature, since: null, ...o };
}

function bcdSnap(opts: {
  pulledAt: string;
  bcdVersion: string;
  rows: MatrixRow[];
}): MatrixSnapshot {
  return {
    schemaVersion: 1,
    pulledAt: opts.pulledAt,
    bcdVersion: opts.bcdVersion,
    crossReferences: [],
    features: [{ id: 'webauthn', label: 'PublicKeyCredential (WebAuthn)', source: 'BCD' }],
    rows: opts.rows,
  };
}

function ciSnap(opts: {
  pulledAt: string;
  chromiumVersion: string;
  webauthn: Status;
  runnerOs?: string;
}): CiSnapshot {
  return {
    schemaVersion: 1,
    pulledAt: opts.pulledAt,
    runnerOs: opts.runnerOs ?? 'linux',
    browsers: [{ name: 'Chromium', version: opts.chromiumVersion, available: true }],
    gridResults: [
      {
        browser: 'Chromium',
        browserVersion: opts.chromiumVersion,
        runnerOs: opts.runnerOs ?? 'linux',
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
      mkRow({
        feature: 'webauthn',
        browser: 'Chromium',
        os: opts.runnerOs ?? 'linux',
        status: opts.webauthn,
        source: 'ci',
        pulledAt: opts.pulledAt,
        notes: 'virtual-authenticator create→get verified',
      }),
    ],
    limitations: ['Virtual authenticators cannot reproduce biometrics or real high-S.'],
  };
}

const baselineBcdRows = (pulledAt: string): MatrixRow[] => [
  mkRow({
    feature: 'webauthn',
    browser: 'Chrome',
    os: 'desktop',
    status: 'supported',
    source: 'BCD',
    pulledAt,
  }),
  mkRow({
    feature: 'webauthn',
    browser: 'Firefox',
    os: 'desktop',
    status: 'supported',
    source: 'BCD',
    pulledAt,
  }),
];

// ── mergeMatrix ──────────────────────────────────────────────────────────────
describe('mergeMatrix', () => {
  it('overrides the BCD baseline with CI-verified cells and stamps the engine version', () => {
    const merged = mergeMatrix({
      bcd: bcdSnap({
        pulledAt: '2026-06-01',
        bcdVersion: '8.0.0',
        rows: baselineBcdRows('2026-06-01'),
      }),
      ci: ciSnap({
        pulledAt: '2026-06-02',
        chromiumVersion: '148.0.7778.96',
        webauthn: 'supported',
      }),
      bcdFile: 'bcd.2026-06-01.json',
      ciFile: 'ci.2026-06-02.json',
      builtAt: '2026-06-02',
    });

    // output validates against the published schema
    expect(() => MergedMatrixSnapshotSchema.parse(merged)).not.toThrow();

    const chrome = merged.cells.find(
      (c) => c.browser === 'Chrome' && c.os === 'desktop' && c.feature === 'webauthn',
    );
    expect(chrome?.source).toBe('ci');
    expect(chrome?.tier).toBe('tier-1-automated');
    expect(chrome?.verifiedOn).toEqual({ browser: 'Chromium', version: '148.0.7778.96' });

    // a non-CI cell keeps its BCD provenance, no engine stamp
    const firefox = merged.cells.find((c) => c.browser === 'Firefox' && c.feature === 'webauthn');
    expect(firefox?.source).toBe('BCD');
    expect(firefox?.verifiedOn).toBeUndefined();

    // provenance carries the BCD version + verifying engines
    expect(merged.provenance?.bcdVersion).toBe('8.0.0');
    expect(merged.provenance?.engines).toEqual([{ browser: 'Chromium', version: '148.0.7778.96' }]);
  });

  it('builds a BCD-only matrix when no CI snapshot is present', () => {
    const merged = mergeMatrix({
      bcd: bcdSnap({
        pulledAt: '2026-06-01',
        bcdVersion: '8.0.0',
        rows: baselineBcdRows('2026-06-01'),
      }),
      ci: null,
      bcdFile: 'bcd.2026-06-01.json',
      ciFile: null,
      builtAt: '2026-06-01',
    });
    expect(merged.cells.every((c) => c.source === 'BCD')).toBe(true);
    expect(merged.provenance?.engines).toBeUndefined();
  });
});

// ── matrixChanged (the anti-date-churn gate) ─────────────────────────────────
describe('matrixChanged', () => {
  const build = (opts: {
    pulledAt: string;
    bcdVersion: string;
    chromium: string;
    webauthn: Status;
    builtAt: string;
  }) =>
    mergeMatrix({
      bcd: bcdSnap({
        pulledAt: opts.pulledAt,
        bcdVersion: opts.bcdVersion,
        rows: baselineBcdRows(opts.pulledAt),
      }),
      ci: ciSnap({
        pulledAt: opts.pulledAt,
        chromiumVersion: opts.chromium,
        webauthn: opts.webauthn,
      }),
      bcdFile: `bcd.${opts.pulledAt}.json`,
      ciFile: `ci.${opts.pulledAt}.json`,
      builtAt: opts.builtAt,
    });

  it('is FALSE when only the date moved — no new snapshot, no churn', () => {
    const week1 = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
      builtAt: '2026-06-01',
    });
    const week2 = build({
      pulledAt: '2026-06-08',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
      builtAt: '2026-06-08',
    });
    expect(matrixChanged(week1, week2)).toBe(false);
  });

  it('is TRUE when a status flips', () => {
    const before = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
      builtAt: '2026-06-01',
    });
    const after = build({
      pulledAt: '2026-06-08',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'unsupported',
      builtAt: '2026-06-08',
    });
    expect(matrixChanged(before, after)).toBe(true);
  });

  it('is TRUE when the verifying engine version advances (same status)', () => {
    const before = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
      builtAt: '2026-06-01',
    });
    const after = build({
      pulledAt: '2026-06-08',
      bcdVersion: '8.0.0',
      chromium: '149.0.0.1',
      webauthn: 'supported',
      builtAt: '2026-06-08',
    });
    expect(matrixChanged(before, after)).toBe(true);
  });

  it('is TRUE against a null prior (first build)', () => {
    const first = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
      builtAt: '2026-06-01',
    });
    expect(matrixChanged(null, first)).toBe(true);
  });
});

// ── diffSnapshots ────────────────────────────────────────────────────────────
describe('diffSnapshots', () => {
  const build = (opts: {
    pulledAt: string;
    bcdVersion: string;
    chromium: string;
    webauthn: Status;
  }) =>
    mergeMatrix({
      bcd: bcdSnap({
        pulledAt: opts.pulledAt,
        bcdVersion: opts.bcdVersion,
        rows: baselineBcdRows(opts.pulledAt),
      }),
      ci: ciSnap({
        pulledAt: opts.pulledAt,
        chromiumVersion: opts.chromium,
        webauthn: opts.webauthn,
      }),
      bcdFile: `bcd.${opts.pulledAt}.json`,
      ciFile: `ci.${opts.pulledAt}.json`,
      builtAt: opts.pulledAt,
    });

  it('reports zero changes for identical substance on a new date (churn ignored)', () => {
    const a = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
    });
    const b = build({
      pulledAt: '2026-06-08',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
    });
    const diff = diffSnapshots(a, b, '2026-06-01', '2026-06-08');
    expect(diff.changed).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.reverified).toHaveLength(0);
  });

  it('surfaces a status flip as a substantive change, not a re-verification', () => {
    const a = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
    });
    const b = build({
      pulledAt: '2026-06-08',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'unsupported',
    });
    const diff = diffSnapshots(a, b, '2026-06-01', '2026-06-08');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.cell).toBe('webauthn|Chrome|desktop');
    expect(diff.changed[0]?.before).toContain('supported');
    expect(diff.changed[0]?.after).toContain('unsupported');
    expect(diff.reverified).toHaveLength(0);
  });

  it('surfaces an engine bump (same status) as a re-verification, not a change', () => {
    const a = build({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      chromium: '148.0.7778.96',
      webauthn: 'supported',
    });
    const b = build({
      pulledAt: '2026-06-08',
      bcdVersion: '8.0.0',
      chromium: '149.0.0.1',
      webauthn: 'supported',
    });
    const diff = diffSnapshots(a, b, '2026-06-01', '2026-06-08');
    expect(diff.changed).toHaveLength(0);
    expect(diff.reverified).toHaveLength(1);
    expect(diff.reverified[0]?.cell).toBe('webauthn|Chrome|desktop');
    expect(diff.reverified[0]?.fromVersion).toContain('148.0.7778.96');
    expect(diff.reverified[0]?.toVersion).toContain('149.0.0.1');
  });
});

// ── fingerprints ─────────────────────────────────────────────────────────────
describe('fingerprints', () => {
  const cell = {
    feature: 'webauthn',
    featureLabel: 'w',
    browser: 'Chrome',
    os: 'desktop',
    status: 'supported' as Status,
    source: 'ci' as Source,
    tier: 'tier-1-automated' as const,
    lastVerified: '2026-06-01',
  };

  it('substance ignores the engine version; change fingerprint includes it', () => {
    const v148 = { ...cell, verifiedOn: { browser: 'Chromium', version: '148' } };
    const v149 = { ...cell, verifiedOn: { browser: 'Chromium', version: '149' } };
    expect(substanceFingerprint(v148)).toBe(substanceFingerprint(v149));
    expect(changeFingerprint(v148)).not.toBe(changeFingerprint(v149));
  });
});

// ── tierForSource (honesty: T1 only when actually machine-verified) ───────────
describe('tierForSource', () => {
  it('is tier-1 only for machine-verified sources (ci / live)', () => {
    expect(tierForSource('ci')).toBe('tier-1-automated');
    expect(tierForSource('live')).toBe('tier-1-automated');
  });
  it('is tier-2 for documented / cross-referenced / manual sources', () => {
    for (const s of ['BCD', 'curated', 'passkeys.dev', 'caniuse', 'manual']) {
      expect(tierForSource(s)).toBe('tier-2-manual');
    }
  });

  it('a BCD-sourced cell is tier-2 while its CI-verified peer is tier-1', () => {
    const merged = mergeMatrix({
      bcd: bcdSnap({
        pulledAt: '2026-06-01',
        bcdVersion: '8.0.0',
        rows: baselineBcdRows('2026-06-01'),
      }),
      ci: ciSnap({
        pulledAt: '2026-06-01',
        chromiumVersion: '148.0.7778.96',
        webauthn: 'supported',
      }),
      bcdFile: 'bcd.2026-06-01.json',
      ciFile: 'ci.2026-06-01.json',
      builtAt: '2026-06-01',
    });
    const chrome = merged.cells.find((c) => c.browser === 'Chrome' && c.feature === 'webauthn');
    const firefox = merged.cells.find((c) => c.browser === 'Firefox' && c.feature === 'webauthn');
    expect(chrome?.source).toBe('ci');
    expect(chrome?.tier).toBe('tier-1-automated');
    // Firefox is only in BCD (CI never ran it) — honestly tier-2, not a fake T1.
    expect(firefox?.source).toBe('BCD');
    expect(firefox?.tier).toBe('tier-2-manual');
  });
});

// ── manual real-device sessions ──────────────────────────────────────────────
describe('mergeMatrix — manual sessions', () => {
  const base = () =>
    bcdSnap({
      pulledAt: '2026-06-01',
      bcdVersion: '8.0.0',
      rows: [
        mkRow({
          feature: 'webauthn',
          browser: 'Safari',
          os: 'macOS',
          status: 'unknown',
          source: 'BCD',
          pulledAt: '2026-06-01',
        }),
      ],
    });

  it('merges a real-device session as source:manual / tier-2, dated + provenanced, overriding BCD', () => {
    const merged = mergeMatrix({
      bcd: base(),
      ci: null,
      manual: [
        {
          date: '2026-07-10',
          browser: 'Safari',
          os: 'macOS',
          browserVersion: '18.5',
          device: 'MacBook Pro 14 / Touch ID',
          tester: 'qa',
          result: 'pass',
          features: [{ feature: 'webauthn', status: 'supported', notes: 'Touch ID create+get' }],
        },
      ],
      bcdFile: 'bcd.2026-06-01.json',
      ciFile: null,
      builtAt: '2026-07-10',
    });
    const cell = merged.cells.find((c) => c.browser === 'Safari' && c.feature === 'webauthn');
    expect(cell?.source).toBe('manual');
    expect(cell?.status).toBe('supported');
    expect(cell?.tier).toBe('tier-2-manual');
    expect(cell?.lastVerified).toBe('2026-07-10');
    expect(cell?.verifiedOn).toEqual({ browser: 'Safari', version: '18.5' });
    expect(cell?.notes).toContain('Touch ID');
    expect(cell?.notes).toContain('MacBook Pro');
  });

  it('CI machine-verification still wins over a manual session for the same cell', () => {
    const merged = mergeMatrix({
      bcd: bcdSnap({
        pulledAt: '2026-06-01',
        bcdVersion: '8.0.0',
        rows: baselineBcdRows('2026-06-01'),
      }),
      ci: ciSnap({
        pulledAt: '2026-06-01',
        chromiumVersion: '148.0.7778.96',
        webauthn: 'supported',
      }),
      manual: [
        {
          date: '2026-05-01',
          browser: 'Chrome',
          os: 'desktop',
          result: 'pass',
          features: [{ feature: 'webauthn', status: 'partial' }],
        },
      ],
      bcdFile: 'bcd.2026-06-01.json',
      ciFile: 'ci.2026-06-01.json',
      builtAt: '2026-06-01',
    });
    const chrome = merged.cells.find((c) => c.browser === 'Chrome' && c.feature === 'webauthn');
    expect(chrome?.source).toBe('ci');
    expect(chrome?.status).toBe('supported');
  });
});
