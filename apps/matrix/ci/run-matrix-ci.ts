/**
 * S07 (YK-433) ⭐ — virtual-authenticator CI. Exercises REAL WebAuthn
 * create→get ceremonies against CDP virtual authenticators (Chromium + Edge)
 * across a {transport × residentKey × UV} grid, verifies every round-trip with
 * @stellar-passkey/core's p256.verify, and writes a dated, zod-validated
 * `apps/matrix/data/ci.<ISODATE>.json` (source:'ci'). Run with `pnpm matrix:ci`.
 *
 * Honest scope: virtual authenticators cannot reproduce biometrics, the Secure
 * Enclave, the real high-S distribution, or in-app WebView breakage — see
 * `limitations` in the snapshot. Firefox/WebKit are handled by the S08 spike.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { extractPublicKeyFromAttestationObject } from '@stellar-passkey/core/create';
import { verifyAssertionSignature } from '@stellar-passkey/core/sign';
import {
  CiSnapshotSchema,
  MATRIX_SCHEMA_VERSION,
  TRANSPORTS,
  type CiGridResult,
  type MatrixRow,
  type Status,
} from '../src/matrixSchema';

const RP_ID = 'localhost';
const pulledAt = process.env.MATRIX_PULL_DATE ?? new Date().toISOString().slice(0, 10);
const runnerOs = process.platform;
const toBytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'base64url'));

interface CellConfig {
  transport: (typeof TRANSPORTS)[number];
  residentKey: boolean;
  userVerification: boolean;
}
const GRID: CellConfig[] = [];
for (const transport of TRANSPORTS) {
  for (const residentKey of [true, false]) {
    for (const userVerification of [true, false]) {
      GRID.push({ transport, residentKey, userVerification });
    }
  }
}

interface CeremonyRaw {
  attestationObject: string;
  alg: number | null;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}
interface CapabilityRaw {
  isUvpaa: boolean | null;
  conditionalMediation: boolean | null;
  clientCapabilities: Record<string, boolean> | null;
}

/** Run create()+get() for one grid cell inside the page; return raw base64url. */
async function runCeremony(page: Page, cfg: CellConfig): Promise<CeremonyRaw> {
  return page.evaluate(async (cell) => {
    const enc = (b: ArrayBuffer): string =>
      btoa(String.fromCharCode(...new Uint8Array(b)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const created = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'matrix-ci', id: 'localhost' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'ci', displayName: 'ci' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: cell.transport === 'internal' ? 'platform' : 'cross-platform',
          residentKey: cell.residentKey ? 'required' : 'discouraged',
          userVerification: cell.userVerification ? 'required' : 'discouraged',
        },
        attestation: 'none',
        timeout: 20000,
      },
    })) as PublicKeyCredential;
    const attResp = created.response as AuthenticatorAttestationResponse;
    const asserted = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: 'localhost',
        allowCredentials: [{ type: 'public-key', id: created.rawId, transports: [cell.transport] }],
        userVerification: cell.userVerification ? 'required' : 'discouraged',
        timeout: 20000,
      },
    })) as PublicKeyCredential;
    const asResp = asserted.response as AuthenticatorAssertionResponse;
    return {
      attestationObject: enc(attResp.attestationObject),
      alg: attResp.getPublicKeyAlgorithm(),
      authenticatorData: enc(asResp.authenticatorData),
      clientDataJSON: enc(asResp.clientDataJSON),
      signature: enc(asResp.signature),
    };
  }, cfg);
}

/** Probe isUVPAA / conditional mediation / getClientCapabilities in the page (closes S06's live gate). */
async function probeCapabilities(page: Page): Promise<CapabilityRaw> {
  return page.evaluate(async () => {
    const Pkc = PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
      isConditionalMediationAvailable?: () => Promise<boolean>;
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    };
    const safe = async (p?: () => Promise<boolean>): Promise<boolean | null> => {
      if (!p) return null;
      try {
        return await p();
      } catch {
        return null;
      }
    };
    let clientCapabilities: Record<string, boolean> | null = null;
    if (Pkc.getClientCapabilities) {
      try {
        clientCapabilities = await Pkc.getClientCapabilities();
      } catch {
        clientCapabilities = null;
      }
    }
    return {
      isUvpaa: await safe(Pkc.isUserVerifyingPlatformAuthenticatorAvailable?.bind(Pkc)),
      conditionalMediation: await safe(Pkc.isConditionalMediationAvailable?.bind(Pkc)),
      clientCapabilities,
    };
  });
}

async function addAuthenticator(cdp: CDPSession, cfg: CellConfig): Promise<string> {
  const res = (await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: cfg.transport,
      hasResidentKey: cfg.residentKey,
      hasUserVerification: cfg.userVerification,
      isUserVerified: cfg.userVerification,
      automaticPresenceSimulation: true,
    },
  })) as { authenticatorId: string };
  return res.authenticatorId;
}

interface BrowserTarget {
  name: string;
  channel?: string;
}
const TARGETS: BrowserTarget[] = [{ name: 'Chromium' }, { name: 'Edge', channel: 'msedge' }];

const gridResults: CiGridResult[] = [];
const browsers: { name: string; version: string; available: boolean; note?: string }[] = [];
const rows: MatrixRow[] = [];

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><meta charset=utf-8><title>matrix-ci</title>');
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://${RP_ID}:${(server.address() as AddressInfo).port}`;

function mkRow(browser: string, feature: string, status: Status, notes?: string): MatrixRow {
  return {
    feature,
    featureLabel: feature,
    browser,
    os: runnerOs,
    status,
    since: null,
    ...(notes ? { notes } : {}),
    source: 'ci',
    pulledAt,
  };
}

for (const target of TARGETS) {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch(target.channel ? { channel: target.channel } : {});
  } catch (error) {
    browsers.push({
      name: target.name,
      version: 'n/a',
      available: false,
      note: `launch failed (${error instanceof Error ? error.message.split('\n')[0] : 'unknown'})`,
    });
    continue;
  }

  const version = browser.version();
  browsers.push({ name: target.name, version, available: true });
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  // tsx/esbuild injects a `__name` keep-names helper into serialized
  // page.evaluate functions; define a no-op in the page so it resolves.
  await page.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((fn) => fn);' });
  await page.goto(origin);
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');

  const caps = await probeCapabilities(page);

  for (const cell of GRID) {
    const authenticatorId = await addAuthenticator(cdp, cell);
    const base: CiGridResult = {
      browser: target.name,
      browserVersion: version,
      runnerOs,
      transport: cell.transport,
      residentKey: cell.residentKey,
      userVerification: cell.userVerification,
      created: false,
      asserted: false,
      verified: false,
      alg: null,
    };
    try {
      const raw = await runCeremony(page, cell);
      base.created = true;
      base.asserted = true;
      base.alg = raw.alg;
      const publicKey = extractPublicKeyFromAttestationObject(toBytes(raw.attestationObject));
      base.verified = verifyAssertionSignature({
        publicKey,
        authenticatorData: toBytes(raw.authenticatorData),
        clientDataJSON: toBytes(raw.clientDataJSON),
        signature: toBytes(raw.signature),
      });
    } catch (error) {
      base.error = error instanceof Error ? error.message.split('\n')[0] : 'unknown error';
    } finally {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    }
    gridResults.push(base);
    const tag = `${cell.transport}/rk:${cell.residentKey ? 'on' : 'off'}/uv:${cell.userVerification ? 'on' : 'off'}`;
    console.log(`  ${target.name} ${tag} → verified=${base.verified} alg=${base.alg ?? '–'}`);
  }

  // Derive source:'ci' matrix rows for this browser.
  const cells = gridResults.filter((g) => g.browser === target.name);
  const verifiedCount = cells.filter((g) => g.verified).length;
  rows.push(
    mkRow(
      target.name,
      'webauthn',
      verifiedCount > 0 ? 'supported' : 'unsupported',
      `virtual-authenticator create→get verified ${String(verifiedCount)}/${String(cells.length)} grid cells`,
    ),
  );
  rows.push(
    mkRow(
      target.name,
      'es256_alg',
      cells.some((g) => g.verified && g.alg === -7) ? 'supported' : 'unknown',
      'create→get round-trip verified via p256.verify with COSE alg -7',
    ),
  );
  if (typeof caps.isUvpaa === 'boolean') {
    rows.push(mkRow(target.name, 'is_uvpaa', caps.isUvpaa ? 'supported' : 'unsupported'));
  }
  const cc = caps.clientCapabilities;
  if (cc) {
    if ('conditionalGet' in cc) {
      rows.push(
        mkRow(
          target.name,
          'conditional_mediation',
          cc.conditionalGet ? 'supported' : 'unsupported',
          'getClientCapabilities().conditionalGet',
        ),
      );
    }
    if ('relatedOrigins' in cc) {
      rows.push(
        mkRow(
          target.name,
          'related_origin_requests',
          cc.relatedOrigins ? 'supported' : 'unsupported',
          'getClientCapabilities().relatedOrigins',
        ),
      );
    }
    if ('hybridTransport' in cc) {
      rows.push(
        mkRow(
          target.name,
          'hybrid_transport',
          cc.hybridTransport ? 'supported' : 'unsupported',
          'getClientCapabilities().hybridTransport',
        ),
      );
    }
  }

  await context.close();
  await browser.close();
}

server.close();

rows.sort(
  (a, b) =>
    a.feature.localeCompare(b.feature) ||
    a.browser.localeCompare(b.browser) ||
    a.os.localeCompare(b.os),
);

const snapshot = CiSnapshotSchema.parse({
  schemaVersion: MATRIX_SCHEMA_VERSION,
  pulledAt,
  runnerOs,
  browsers,
  gridResults,
  rows,
  limitations: [
    'Virtual authenticators cannot reproduce biometrics, the Apple Secure Enclave, or real device UX.',
    'They emit deterministic low-S signatures, so they do NOT reproduce the ~50% high-S distribution of real Apple authenticators (see anchor low-s-normalization).',
    'In-app WebView breakage (e.g. embedded browsers) is not exercised here.',
    'Firefox/WebKit virtual authenticators are out of scope here — handled by the S08 WebDriver-BiDi spike.',
  ],
});

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(dataDir, { recursive: true });
const file = `ci.${pulledAt}.json`;
writeFileSync(join(dataDir, file), JSON.stringify(snapshot, null, 2) + '\n');

const available = browsers.filter((b) => b.available);
const completed = gridResults.filter((g) => g.created && g.asserted);
const allVerified = completed.length > 0 && completed.every((g) => g.verified);
const canonical = gridResults.find(
  (g) =>
    g.transport === 'internal' && g.residentKey && g.userVerification && g.verified && g.alg === -7,
);

console.log(
  `\nmatrix:ci → ${file}: ${String(available.length)} browser(s), ${String(gridResults.length)} cells, ${String(completed.filter((g) => g.verified).length)}/${String(completed.length)} verified.`,
);

// VALIDATION GATE: a canonical create→get round-trip must verify before publish.
if (available.length === 0) {
  console.error('FAIL: no browser available — install Playwright Chromium/Edge.');
  process.exit(1);
}
if (!canonical) {
  console.error('FAIL: canonical internal/residentKey/UV cell did not verify via p256.verify.');
  process.exit(1);
}
if (!allVerified) {
  console.error('FAIL: not every completed grid cell verified.');
  process.exit(1);
}
console.log('GATE: canonical create→get round-trip verified via p256.verify ✓');
