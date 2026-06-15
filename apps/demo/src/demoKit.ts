/**
 * Demo wiring — binds the S18 headless flows to a zero-network backend so the
 * styled screens (S20) can be exercised end-to-end with no testnet.
 *
 * Two modes (via `?mode=`):
 *   - `mock` (default): a deterministic in-memory authenticator + backend. No
 *     biometrics, no network — runs anywhere, including headless CI.
 *   - `webauthn`: the REAL `browserWebAuthnClient` over `navigator.credentials`,
 *     so a CDP virtual authenticator (Playwright) or a real Touch ID / Windows
 *     Hello sheet drives the prompting/discovering states. Backend stays in-memory.
 *
 * `control` exposes deterministic failure injection so every error code + the
 * FAILED-submission path can be driven from tests.
 */
import { KitError, type KitErrorCode, type SubmitResult } from '@soropass/core/types';
import {
  browserWebAuthnClient,
  buildCreateOptions,
  extractPublicKeyFromAttestationObject,
} from '@soropass/core/create';
import { recover as recoverCeremony, type RecoverResult } from '@soropass/core/recover';
import { createInMemoryBackend, mockAuthenticator } from '@soropass/core/testing';
import {
  createCreatePasskeyFlow,
  createRecoverFlow,
  createSignFlow,
  type CreateFlow,
  type RecoverFlow,
  type SignFlow,
} from '@soropass/ui/headless';
import type { TxSummaryData } from '@soropass/ui/styled';

export type DemoScreen = 'create' | 'sign' | 'recover';
export type DemoMode = 'mock' | 'webauthn';

export interface DemoControl {
  readonly mode: DemoMode;
  /** Make the next ceremony on `screen` reject with `code` → drives the error layout. */
  failNext(screen: DemoScreen, code: KitErrorCode): void;
  /** Make the next Sign submission return FAILED → drives CONTRACT_AUTH_FAILED → sign:verify. */
  failSubmit(on: boolean): void;
  /** Override how many accounts Recover resolves (null = use the real indexer). */
  setRecoverCount(count: number | null): void;
}

export interface Demo {
  createFlow: CreateFlow;
  signFlow: SignFlow;
  recoverFlow: RecoverFlow;
  control: DemoControl;
  tx: TxSummaryData;
  mode: DemoMode;
}

const SAMPLE_C = [
  'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP',
  'CDEF8GH1J2K3L4M5N6P7Q8R9S0T1U2V3W4X5Y6Z7B8DEF8GH1J2K3L4',
  'CBQ9Z8Y7X6W5V4U3T2S1R0P9N8M7L6K5J4H3G2F1D0BQ9Z8Y7X6W5V4',
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function randomBytes32(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function syntheticAccounts(count: number, credentialId: string): RecoverResult[] {
  const out: RecoverResult[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ contractId: SAMPLE_C[i % SAMPLE_C.length] ?? `C${'0'.repeat(55)}`, credentialId });
  }
  return out;
}

export function createDemo(): Demo {
  const params = new URLSearchParams(globalThis.location.search);
  const mode: DemoMode = params.get('mode') === 'webauthn' ? 'webauthn' : 'mock';
  const rpId = globalThis.location.hostname || 'localhost';
  const auth = mode === 'webauthn' ? browserWebAuthnClient() : mockAuthenticator({ rpId });
  const backend = createInMemoryBackend();

  const tx: TxSummaryData = {
    amountValue: '250.00 USDC',
    amountFiat: '≈ $250.00',
    destination: 'GDUKMGUGDZQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6X',
    action: 'transfer',
  };

  const pending: Partial<Record<DemoScreen, KitErrorCode>> = {};
  let failSubmitFlag = false;
  // Default to a 3-account list so the listbox + keyboard pattern is visible out of the box.
  let recoverCount: number | null = 3;

  const takeFail = (screen: DemoScreen): void => {
    const code = pending[screen];
    if (code) {
      delete pending[screen];
      throw new KitError(code, 'Injected demo failure');
    }
  };

  const userActivation = globalThis.navigator.userActivation;

  const createFlow = createCreatePasskeyFlow({
    userActivation,
    create: async (input, report) => {
      takeFail('create');
      const options = buildCreateOptions({
        rpId,
        rpName: 'Stellar Passkey Demo',
        userName: input.userName ?? 'demo-user',
        challenge: randomBytes32(),
      });
      const registration = await auth.create(options); // prompting (OS sheet / virtual authenticator)
      report.deploying(); // → deploying
      const publicKey = extractPublicKeyFromAttestationObject(registration.attestationObject);
      await sleep(700);
      const { contractId } = await backend.deployer.deploy({
        publicKey,
        credentialId: registration.id,
      });
      return { contractId, credentialId: registration.id, publicKey };
    },
  });

  const signFlow = createSignFlow({
    userActivation,
    sign: async () => {
      takeFail('sign');
      await auth.get({ rpId, allowCredentials: [], challenge: randomBytes32() }); // prompting
      return 'demo-signed-tx-xdr';
    },
    submit: async (): Promise<SubmitResult> => {
      await sleep(600); // submitting
      if (failSubmitFlag) {
        failSubmitFlag = false;
        return { status: 'FAILED', hash: randomHex(32) };
      }
      return { status: 'SUCCESS', hash: randomHex(32) };
    },
  });

  const recoverFlow = createRecoverFlow({
    userActivation,
    recover: async () => {
      takeFail('recover');
      // Synthetic list (default): show the listbox without needing a resident
      // key — so the keyboard pattern is demoable standalone in any mode.
      if (recoverCount !== null) {
        await sleep(400); // discovering
        return syntheticAccounts(recoverCount, 'demo-credential');
      }
      // Real discoverable recovery: requires a passkey created earlier this
      // session (the in-memory backend then resolves its account).
      return recoverCeremony({ rpId, indexer: backend.indexer, webauthn: auth });
    },
  });

  const control: DemoControl = {
    mode,
    failNext: (screen, code) => {
      pending[screen] = code;
    },
    failSubmit: (on) => {
      failSubmitFlag = on;
    },
    setRecoverCount: (count) => {
      recoverCount = count;
    },
  };

  return { createFlow, signFlow, recoverFlow, control, tx, mode };
}
