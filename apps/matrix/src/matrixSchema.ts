import { z } from 'zod';

/** Bump when the snapshot shape changes (consumers can branch on it). */
export const MATRIX_SCHEMA_VERSION = 1;

/**
 * Where a row's data came from. `ci`/`live` are machine-verified this run;
 * `manual` is a hand-logged real-device session; the rest are cross-referenced.
 */
export const SOURCES = [
  'BCD',
  'caniuse',
  'passkeys.dev',
  'curated',
  'live',
  'ci',
  'manual',
] as const;
export type Source = (typeof SOURCES)[number];

/** Support status for one feature on one browser+OS. */
export const STATUSES = ['supported', 'unsupported', 'partial', 'unknown'] as const;
export type Status = (typeof STATUSES)[number];

export const MatrixRowSchema = z.object({
  /** Canonical feature id (stable across snapshots). */
  feature: z.string(),
  featureLabel: z.string(),
  browser: z.string(),
  os: z.string(),
  status: z.enum(STATUSES),
  /** Version the feature landed in, when known (BCD `version_added`); else null. */
  since: z.string().nullable(),
  partial: z.boolean().optional(),
  notes: z.string().optional(),
  source: z.enum(SOURCES),
  sourceUrl: z.string().optional(),
  /** ISO date (YYYY-MM-DD) the snapshot was pulled. */
  pulledAt: z.string(),
});
export type MatrixRow = z.infer<typeof MatrixRowSchema>;

export const MatrixSnapshotSchema = z.object({
  schemaVersion: z.literal(MATRIX_SCHEMA_VERSION),
  pulledAt: z.string(),
  bcdVersion: z.string(),
  /** Cross-reference sources to wire into the published matrix (S09). */
  crossReferences: z.array(
    z.object({ id: z.enum(SOURCES), url: z.string(), note: z.string().optional() }),
  ),
  features: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      source: z.enum(SOURCES),
      bcdPath: z.string().optional(),
    }),
  ),
  rows: z.array(MatrixRowSchema),
});
export type MatrixSnapshot = z.infer<typeof MatrixSnapshotSchema>;

/** Transports swept by the virtual-authenticator CI (S07). */
export const TRANSPORTS = ['internal', 'usb'] as const;

/** One cell of the virtual-authenticator CI grid. */
export const CiGridResultSchema = z.object({
  browser: z.string(),
  browserVersion: z.string(),
  runnerOs: z.string(),
  transport: z.enum(TRANSPORTS),
  residentKey: z.boolean(),
  userVerification: z.boolean(),
  created: z.boolean(),
  asserted: z.boolean(),
  /** create→get round-trip verified via p256.verify. */
  verified: z.boolean(),
  /** COSE alg the authenticator emitted (-7 = ES256). */
  alg: z.number().nullable(),
  error: z.string().optional(),
});
export type CiGridResult = z.infer<typeof CiGridResultSchema>;

export const CiSnapshotSchema = z.object({
  schemaVersion: z.literal(MATRIX_SCHEMA_VERSION),
  pulledAt: z.string(),
  runnerOs: z.string(),
  browsers: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      available: z.boolean(),
      note: z.string().optional(),
    }),
  ),
  gridResults: z.array(CiGridResultSchema),
  rows: z.array(MatrixRowSchema),
  /** Honest scope notes — what virtual authenticators cannot reproduce. */
  limitations: z.array(z.string()),
});
export type CiSnapshot = z.infer<typeof CiSnapshotSchema>;

/** BCD browser key → human { browser, os }. The passkey-relevant set. */
export const BROWSER_OS: Record<string, { browser: string; os: string }> = {
  chrome: { browser: 'Chrome', os: 'desktop' },
  edge: { browser: 'Edge', os: 'Windows' },
  firefox: { browser: 'Firefox', os: 'desktop' },
  safari: { browser: 'Safari', os: 'macOS' },
  safari_ios: { browser: 'Safari', os: 'iOS' },
  chrome_android: { browser: 'Chrome', os: 'Android' },
  firefox_android: { browser: 'Firefox', os: 'Android' },
  samsunginternet_android: { browser: 'Samsung Internet', os: 'Android' },
};

/** Verification tiers (S08). Mirrors `tiers.ts` `Tier`. */
export const TIERS = ['tier-1-automated', 'tier-2-manual'] as const;
export type Tier = (typeof TIERS)[number];

/** The exact engine that machine-verified a cell (only present for source:'ci'). */
export const VerifiedOnSchema = z.object({ browser: z.string(), version: z.string() });
export type VerifiedOn = z.infer<typeof VerifiedOnSchema>;

/** One merged matrix cell: the chosen value for (feature, browser, os) + provenance. */
export const MergedCellSchema = z.object({
  feature: z.string(),
  featureLabel: z.string(),
  browser: z.string(),
  os: z.string(),
  status: z.enum(STATUSES),
  source: z.enum(SOURCES),
  tier: z.enum(TIERS),
  /** ISO date of the source that produced this cell's value. */
  lastVerified: z.string(),
  /** The engine + version that machine-verified this cell (source:'ci' only). */
  verifiedOn: VerifiedOnSchema.optional(),
  since: z.string().nullable().optional(),
  notes: z.string().optional(),
  sourceUrl: z.string().optional(),
});
export type MergedCell = z.infer<typeof MergedCellSchema>;

/** The published, dated, diffable matrix — BCD ⊕ live ⊕ CI merged (S09). */
export const MergedMatrixSnapshotSchema = z.object({
  schemaVersion: z.literal(MATRIX_SCHEMA_VERSION),
  builtAt: z.string(),
  inputs: z.object({ bcd: z.string().nullable(), ci: z.string().nullable() }),
  /** The BCD data version + verifying engine versions this snapshot was built from. */
  provenance: z
    .object({
      bcdVersion: z.string().optional(),
      engines: z.array(VerifiedOnSchema).optional(),
    })
    .optional(),
  features: z.array(z.object({ id: z.string(), label: z.string() })),
  cells: z.array(MergedCellSchema),
});
export type MergedMatrixSnapshot = z.infer<typeof MergedMatrixSnapshotSchema>;

/** A single cell change between two dated snapshots. */
export const MatrixDiffChangeSchema = z.object({
  cell: z.string(),
  before: z.string(),
  after: z.string(),
});
/** Structured diff between the two most recent dated snapshots. */
export const MatrixDiffSchema = z.object({
  schemaVersion: z.literal(MATRIX_SCHEMA_VERSION),
  from: z.string(),
  to: z.string(),
  /** status / source / tier moved — the substance of the matrix changed. */
  changed: z.array(MatrixDiffChangeSchema),
  added: z.array(z.object({ cell: z.string(), now: z.string() })),
  removed: z.array(z.object({ cell: z.string(), was: z.string() })),
  /** status unchanged, but re-verified on a newer engine version (anti-staleness proof). */
  reverified: z.array(
    z.object({ cell: z.string(), fromVersion: z.string(), toVersion: z.string() }),
  ),
});
export type MatrixDiff = z.infer<typeof MatrixDiffSchema>;

/**
 * Anti-staleness proof: one entry per re-verification run, whether or not the
 * data changed. Lets the docs show an honest "last re-verified on <engine> <ver>
 * (<runnerOs>), data unchanged since <date>" freshness stamp — the RFP's core
 * "a guide that goes stale is worse than no guide" requirement.
 */
export const VerificationRunSchema = z.object({
  ranAt: z.string(),
  runnerOs: z.string(),
  bcdVersion: z.string(),
  engines: z.array(VerifiedOnSchema),
  /** The canonical internal/rk/uv create→get cell verified via p256.verify. */
  canonicalVerified: z.boolean(),
  /** The dated matrix snapshot this run resolved to. */
  snapshot: z.string(),
  /** Whether the matrix substance (or a verifying engine version) changed this run. */
  changed: z.boolean(),
});
export type VerificationRun = z.infer<typeof VerificationRunSchema>;

export const VerificationLogSchema = z.object({
  schemaVersion: z.literal(MATRIX_SCHEMA_VERSION),
  runs: z.array(VerificationRunSchema),
});
export type VerificationLog = z.infer<typeof VerificationLogSchema>;

/**
 * A hand-logged real-device session — the honest path for engines the virtual-
 * authenticator CI cannot reach (Safari/WebKit, Firefox, real biometrics such as
 * macOS Touch ID). Merged into the matrix as `source:'manual'`, `tier-2-manual`,
 * dated with the real session date, so real-device evidence is recorded and
 * dated, never faked as automation.
 */
export const ManualSessionSchema = z.object({
  /** ISO date the session was run. */
  date: z.string(),
  browser: z.string(),
  os: z.string(),
  browserVersion: z.string().optional(),
  /** e.g. "MacBook Pro 14 / Touch ID", "Pixel 8 / fingerprint". */
  device: z.string().optional(),
  /** Who ran it (for provenance). */
  tester: z.string().optional(),
  result: z.enum(['pass', 'partial', 'fail']),
  /** Per-feature outcomes verified in this session. */
  features: z.array(
    z.object({ feature: z.string(), status: z.enum(STATUSES), notes: z.string().optional() }),
  ),
  notes: z.string().optional(),
});
export type ManualSession = z.infer<typeof ManualSessionSchema>;

export const ManualSessionsFileSchema = z.object({
  schemaVersion: z.literal(MATRIX_SCHEMA_VERSION),
  /** How to add a session (kept in-file so the format is self-documenting). */
  readme: z.string().optional(),
  sessions: z.array(ManualSessionSchema),
});
export type ManualSessionsFile = z.infer<typeof ManualSessionsFileSchema>;
