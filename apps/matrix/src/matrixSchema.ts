import { z } from 'zod';

/** Bump when the snapshot shape changes (consumers can branch on it). */
export const MATRIX_SCHEMA_VERSION = 1;

/** Where a row's data came from. BCD is machine-sourced; the rest are cross-referenced. */
export const SOURCES = ['BCD', 'caniuse', 'passkeys.dev', 'curated', 'live', 'ci'] as const;
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
