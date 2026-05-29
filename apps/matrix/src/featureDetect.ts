/**
 * S06 (YK-432) — live feature detection: the dynamic counterpart to BCD's
 * static data. Probes the *actual* client and is dependency-free + isomorphic
 * (runs in-browser on the matrix site and headless in CI under the S07 virtual
 * authenticator). Gracefully degrades where WebAuthn is unavailable (e.g. Node).
 */
import type { MatrixRow, Status } from './matrixSchema';

/** The keys WebAuthn `getClientCapabilities()` may report (spec-defined). */
export const CLIENT_CAPABILITY_KEYS = [
  'conditionalGet',
  'conditionalCreate',
  'relatedOrigins',
  'hybridTransport',
  'passkeyPlatformAuthenticator',
  'userVerifyingPlatformAuthenticator',
  'signalAllAcceptedCredentials',
] as const;

export type Es256Probe = 'supported' | 'unsupported' | 'untested';

export interface ClientCapabilityReport {
  source: 'live';
  pulledAt: string;
  userAgent: string;
  platform: string | null;
  webauthnAvailable: boolean;
  /** isUserVerifyingPlatformAuthenticatorAvailable(); null if unavailable/errored. */
  isUvpaa: boolean | null;
  /** isConditionalMediationAvailable(); null if unavailable/errored. */
  conditionalMediation: boolean | null;
  /** getClientCapabilities() result; null if the method is unavailable. */
  clientCapabilities: Record<string, boolean> | null;
  es256: Es256Probe;
}

interface PublicKeyCredentialStatic {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  isConditionalMediationAvailable?: () => Promise<boolean>;
  getClientCapabilities?: () => Promise<Record<string, boolean>>;
}

type CreateFn = (options: CredentialCreationOptions) => Promise<Credential | null>;

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPublicKeyCredential(): PublicKeyCredentialStatic | undefined {
  return (globalThis as { PublicKeyCredential?: PublicKeyCredentialStatic }).PublicKeyCredential;
}

function getNavigator(): Navigator | undefined {
  return (globalThis as { navigator?: Navigator }).navigator;
}

async function safeBool(fn: (() => Promise<boolean>) | undefined): Promise<boolean | null> {
  if (typeof fn !== 'function') return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}

export interface DetectOptions {
  /** Inject the current date (tests / deterministic snapshots). */
  now?: () => string;
}

/**
 * Probe the running client. Non-intrusive: it never calls `credentials.create`
 * (which would prompt). Use {@link probeES256Support} — driven by the S07
 * virtual authenticator — for the create-based ES256 probe.
 */
export async function detectCapabilities(options?: DetectOptions): Promise<ClientCapabilityReport> {
  const pulledAt = (options?.now ?? isoDate)();
  const nav = getNavigator();
  const userAgent = nav?.userAgent ?? '';
  const platform =
    (nav as { userAgentData?: { platform?: string } } | undefined)?.userAgentData?.platform ?? null;
  const pkc = getPublicKeyCredential();

  if (!pkc) {
    return {
      source: 'live',
      pulledAt,
      userAgent,
      platform,
      webauthnAvailable: false,
      isUvpaa: null,
      conditionalMediation: null,
      clientCapabilities: null,
      es256: 'untested',
    };
  }

  const [isUvpaa, conditionalMediation] = await Promise.all([
    safeBool(pkc.isUserVerifyingPlatformAuthenticatorAvailable?.bind(pkc)),
    safeBool(pkc.isConditionalMediationAvailable?.bind(pkc)),
  ]);

  let clientCapabilities: Record<string, boolean> | null = null;
  if (typeof pkc.getClientCapabilities === 'function') {
    try {
      const caps = await pkc.getClientCapabilities();
      clientCapabilities = {};
      for (const [key, value] of Object.entries(caps)) {
        clientCapabilities[key] = Boolean(value);
      }
    } catch {
      clientCapabilities = null;
    }
  }

  return {
    source: 'live',
    pulledAt,
    userAgent,
    platform,
    webauthnAvailable: true,
    isUvpaa,
    conditionalMediation,
    clientCapabilities,
    es256: 'untested',
  };
}

export interface Es256ProbeOptions {
  /** Inject `navigator.credentials.create` (CI virtual authenticator / tests). */
  create?: CreateFn;
  rpId?: string;
}

/**
 * The create-based ES256 probe: attempt a registration offering only `alg:-7`
 * and classify the outcome. Intrusive (prompts) in real browsers, so it is
 * separate from {@link detectCapabilities} and intended for the S07 virtual
 * authenticator. `NotSupportedError` → unsupported; anything else (no API,
 * user-cancel, no authenticator) → untested.
 */
export async function probeES256Support(options?: Es256ProbeOptions): Promise<Es256Probe> {
  const nav = getNavigator();
  const create =
    options?.create ??
    (nav?.credentials ? nav.credentials.create.bind(nav.credentials) : undefined);
  if (typeof create !== 'function') return 'untested';

  const randomBytes = (length: number): Uint8Array<ArrayBuffer> => {
    const out = new Uint8Array(new ArrayBuffer(length));
    (globalThis.crypto as Crypto | undefined)?.getRandomValues(out);
    return out;
  };

  try {
    await create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'feature-probe', id: options?.rpId },
        user: { id: randomBytes(16), name: 'probe', displayName: 'probe' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256-only
        timeout: 60_000,
      },
    });
    return 'supported';
  } catch (error) {
    if (error instanceof Error && error.name === 'NotSupportedError') return 'unsupported';
    return 'untested';
  }
}

/** Map a `getClientCapabilities` key (and isUvpaa/es256) to a matrix feature id. */
const CAPABILITY_TO_FEATURE: Record<string, string> = {
  conditionalGet: 'conditional_mediation',
  conditionalCreate: 'conditional_mediation',
  relatedOrigins: 'related_origin_requests',
  hybridTransport: 'hybrid_transport',
  userVerifyingPlatformAuthenticator: 'is_uvpaa',
  passkeyPlatformAuthenticator: 'webauthn',
  signalAllAcceptedCredentials: 'signal_credentials',
};

/** Best-effort browser+OS from a user-agent string (for the "your device" panel). */
export function detectBrowserOS(userAgent: string): { browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  const os = /iphone|ipad|ipod/.test(ua)
    ? 'iOS'
    : /android/.test(ua)
      ? 'Android'
      : /mac os x|macintosh/.test(ua)
        ? 'macOS'
        : /windows/.test(ua)
          ? 'Windows'
          : /linux/.test(ua)
            ? 'Linux'
            : 'unknown';
  const browser = /edg\//.test(ua)
    ? 'Edge'
    : /samsungbrowser/.test(ua)
      ? 'Samsung Internet'
      : /firefox|fxios/.test(ua)
        ? 'Firefox'
        : /chrome|crios|chromium/.test(ua)
          ? 'Chrome'
          : /safari/.test(ua)
            ? 'Safari'
            : 'unknown';
  return { browser, os };
}

const boolToStatus = (value: boolean): Status => (value ? 'supported' : 'unsupported');

/**
 * Convert a live report into `source:'live'` matrix rows, keyed by the detected
 * browser+OS and aligned to the BCD/curated feature ids so S09 can overlay
 * "your device" truth onto the static matrix.
 */
export function reportToMatrixRows(report: ClientCapabilityReport): MatrixRow[] {
  const { browser, os } = detectBrowserOS(report.userAgent);
  const rows: MatrixRow[] = [];
  const push = (feature: string, status: Status, notes?: string): void => {
    rows.push({
      feature,
      featureLabel: feature,
      browser,
      os,
      status,
      since: null,
      ...(notes ? { notes } : {}),
      source: 'live',
      pulledAt: report.pulledAt,
    });
  };

  push('webauthn', boolToStatus(report.webauthnAvailable));
  if (report.isUvpaa !== null) push('is_uvpaa', boolToStatus(report.isUvpaa));
  if (report.conditionalMediation !== null) {
    push('conditional_mediation', boolToStatus(report.conditionalMediation));
  }
  if (report.clientCapabilities) {
    for (const [key, value] of Object.entries(report.clientCapabilities)) {
      const feature = CAPABILITY_TO_FEATURE[key];
      if (feature) push(feature, boolToStatus(value), `getClientCapabilities().${key}`);
    }
  }
  if (report.es256 !== 'untested') {
    push('es256_alg', report.es256 === 'supported' ? 'supported' : 'unsupported');
  }
  return rows;
}
