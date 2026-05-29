/**
 * S05 (YK-431) — ingest MDN Browser-Compat-Data into a typed, zod-validated,
 * dated MatrixSchema snapshot. The matrix is SOURCED, not hand-typed (the RFP's
 * anti-staleness requirement). Run with `pnpm matrix:pull`.
 *
 * BCD covers the WebAuthn DOM surface (PublicKeyCredential / CredentialsContainer).
 * Features BCD does not track — ES256 algorithm support, Related Origin Requests,
 * hybrid transport — are emitted as clearly-labelled CURATED cross-references
 * (with source URLs); their authoritative values are produced by the
 * virtual-authenticator CI in S07 (YK-433).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcd from '@mdn/browser-compat-data';
import {
  BROWSER_OS,
  MATRIX_SCHEMA_VERSION,
  MatrixSnapshotSchema,
  type MatrixRow,
  type Source,
  type Status,
} from '../src/matrixSchema';

interface SupportStatement {
  version_added?: string | boolean | null;
  partial_implementation?: boolean;
  notes?: string | string[];
}
interface CompatNode {
  __compat?: { support?: Record<string, SupportStatement | SupportStatement[]> };
}

const pulledAt = process.env.MATRIX_PULL_DATE ?? new Date().toISOString().slice(0, 10);
const bcdVersion =
  (bcd as unknown as { __meta?: { version?: string } }).__meta?.version ?? 'unknown';

function getNode(path: readonly string[]): CompatNode | undefined {
  let cur: unknown = bcd;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur as CompatNode | undefined;
}

function notesToString(notes: SupportStatement['notes']): string | undefined {
  if (!notes) return undefined;
  return Array.isArray(notes) ? notes.join(' ') : notes;
}

function classify(s: SupportStatement | undefined): {
  status: Status;
  since: string | null;
  partial?: boolean;
} {
  if (!s) return { status: 'unknown', since: null };
  const va = s.version_added;
  const since = typeof va === 'string' ? va : null;
  if (s.partial_implementation) return { status: 'partial', since, partial: true };
  if (va === false) return { status: 'unsupported', since: null };
  if (va === true || typeof va === 'string') return { status: 'supported', since };
  return { status: 'unknown', since: null };
}

// ── BCD-sourced features ─────────────────────────────────────────────────────
const BCD_FEATURES: { id: string; label: string; path: string[] }[] = [
  { id: 'webauthn', label: 'PublicKeyCredential (WebAuthn)', path: ['api', 'PublicKeyCredential'] },
  {
    id: 'is_uvpaa',
    label: 'isUserVerifyingPlatformAuthenticatorAvailable()',
    path: ['api', 'PublicKeyCredential', 'isUserVerifyingPlatformAuthenticatorAvailable_static'],
  },
  {
    id: 'conditional_mediation',
    label: 'Conditional UI (isConditionalMediationAvailable)',
    path: ['api', 'PublicKeyCredential', 'isConditionalMediationAvailable_static'],
  },
  {
    id: 'get_client_capabilities',
    label: 'getClientCapabilities()',
    path: ['api', 'PublicKeyCredential', 'getClientCapabilities_static'],
  },
  {
    id: 'parse_creation_options',
    label: 'parseCreationOptionsFromJSON()',
    path: ['api', 'PublicKeyCredential', 'parseCreationOptionsFromJSON_static'],
  },
  {
    id: 'signal_credentials',
    label: 'signalAllAcceptedCredentials()',
    path: ['api', 'PublicKeyCredential', 'signalAllAcceptedCredentials_static'],
  },
  {
    id: 'credentials_create',
    label: 'navigator.credentials.create()',
    path: ['api', 'CredentialsContainer', 'create'],
  },
  {
    id: 'credentials_get',
    label: 'navigator.credentials.get()',
    path: ['api', 'CredentialsContainer', 'get'],
  },
];

// ── Curated cross-references (BCD has no key; CI-verified in S07) ─────────────
const ALL = 'ALL' as const;
const CURATED_FEATURES: {
  id: string;
  label: string;
  source: Source;
  sourceUrl: string;
  note: string;
  support: Record<string, Status> | typeof ALL;
}[] = [
  {
    id: 'es256_alg',
    label: 'ES256 (COSE alg -7) authenticator support',
    source: 'curated',
    sourceUrl: 'https://www.w3.org/TR/webauthn-3/#sctn-alg-identifier',
    note: 'ES256 (-7) is the de-facto mandatory WebAuthn algorithm; supported by all platform authenticators. RS256 (-257) appears only on some Windows Hello configs and cannot verify on Soroban (secp256r1-only).',
    support: ALL,
  },
  {
    id: 'related_origin_requests',
    label: 'Related Origin Requests (multi-origin passkeys)',
    source: 'passkeys.dev',
    sourceUrl: 'https://passkeys.dev/device-support/',
    note: 'Curated cross-reference; authoritative status is produced by the virtual-authenticator CI (S07).',
    support: {
      chrome: 'supported',
      edge: 'supported',
      chrome_android: 'supported',
      samsunginternet_android: 'supported',
      safari: 'unknown',
      safari_ios: 'unknown',
      firefox: 'unsupported',
      firefox_android: 'unsupported',
    },
  },
  {
    id: 'hybrid_transport',
    label: 'Hybrid transport (cross-device / caBLE)',
    source: 'passkeys.dev',
    sourceUrl: 'https://passkeys.dev/device-support/',
    note: 'Cross-device QR/hybrid flow. Curated cross-reference; CI-verified in S07.',
    support: {
      chrome: 'supported',
      edge: 'supported',
      safari: 'supported',
      chrome_android: 'supported',
      safari_ios: 'supported',
      samsunginternet_android: 'supported',
      firefox: 'unknown',
      firefox_android: 'unknown',
    },
  },
];

const browserKeys = Object.keys(BROWSER_OS);
const rows: MatrixRow[] = [];

for (const feature of BCD_FEATURES) {
  const support = getNode(feature.path)?.__compat?.support ?? {};
  for (const key of browserKeys) {
    const target = BROWSER_OS[key];
    if (!target) continue;
    let s = support[key];
    if (Array.isArray(s)) s = s[0];
    const { status, since, partial } = classify(s);
    rows.push({
      feature: feature.id,
      featureLabel: feature.label,
      browser: target.browser,
      os: target.os,
      status,
      since,
      ...(partial ? { partial } : {}),
      ...(notesToString(s?.notes) ? { notes: notesToString(s?.notes) } : {}),
      source: 'BCD',
      sourceUrl: 'https://github.com/mdn/browser-compat-data',
      pulledAt,
    });
  }
}

for (const feature of CURATED_FEATURES) {
  for (const key of browserKeys) {
    const target = BROWSER_OS[key];
    if (!target) continue;
    const status: Status =
      feature.support === ALL ? 'supported' : (feature.support[key] ?? 'unknown');
    rows.push({
      feature: feature.id,
      featureLabel: feature.label,
      browser: target.browser,
      os: target.os,
      status,
      since: null,
      notes: feature.note,
      source: feature.source,
      sourceUrl: feature.sourceUrl,
      pulledAt,
    });
  }
}

// Deterministic order so day-to-day diffs are minimal and reviewable.
rows.sort(
  (a, b) =>
    a.feature.localeCompare(b.feature) ||
    a.browser.localeCompare(b.browser) ||
    a.os.localeCompare(b.os),
);

const snapshot = {
  schemaVersion: MATRIX_SCHEMA_VERSION,
  pulledAt,
  bcdVersion,
  crossReferences: [
    { id: 'BCD' as const, url: 'https://github.com/mdn/browser-compat-data' },
    {
      id: 'caniuse' as const,
      url: 'https://caniuse.com/webauthn',
      note: 'Wired into the matrix in S09.',
    },
    {
      id: 'passkeys.dev' as const,
      url: 'https://passkeys.dev/device-support/',
      note: 'Device/feature support; wired in S09.',
    },
  ],
  features: [
    ...BCD_FEATURES.map((f) => ({
      id: f.id,
      label: f.label,
      source: 'BCD' as const,
      bcdPath: f.path.join('.'),
    })),
    ...CURATED_FEATURES.map((f) => ({ id: f.id, label: f.label, source: f.source })),
  ],
  rows,
};

// Validate on write (acceptance: typed + zod-validated).
const validated = MatrixSnapshotSchema.parse(snapshot);

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(dataDir, { recursive: true });
const snapshotFile = `bcd.${pulledAt}.json`;
writeFileSync(join(dataDir, snapshotFile), JSON.stringify(validated, null, 2) + '\n');
writeFileSync(
  join(dataDir, 'latest.json'),
  JSON.stringify(
    { latestSnapshot: snapshotFile, pulledAt, bcdVersion, rowCount: validated.rows.length },
    null,
    2,
  ) + '\n',
);

console.log(
  `matrix:pull → ${snapshotFile} (${String(validated.rows.length)} rows, BCD ${bcdVersion}, ${String(validated.features.length)} features)`,
);
