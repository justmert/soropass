import { createPasskey as createPasskeyCeremony } from '../ceremonies/create';
import { connect as connectCeremony, type ConnectResult } from '../ceremonies/connect';
import { recover as recoverCeremony, type RecoverResult } from '../ceremonies/recover';
import { signAuthEntry as signAuthEntryFn, type WebAuthnSigner } from '../soroban/sign';
import type { AccountDeployer, CredentialStorage, WebAuthnClient } from '../ceremonies/types';
import type { IndexerAdapter, SubmissionAdapter } from '../adapters/types';
import type { PasskeyCredential } from '../types';
import { mockAuthenticator } from './mockAuthenticator';
import { createInMemoryBackend } from './inMemory';

const TESTNET = 'Test SDF Network ; September 2015';

export interface CreatePasskeyKitOptions {
  mode: 'mock' | 'live';
  rpId: string;
  rpName?: string;
  networkPassphrase?: string;
  // mock-mode knobs
  seed?: string;
  forceHighS?: boolean;
  // live-mode dependencies
  webauthn?: WebAuthnClient;
  deployer?: AccountDeployer;
  indexer?: IndexerAdapter;
  submission?: SubmissionAdapter;
  storage?: CredentialStorage;
  signer?: WebAuthnSigner;
}

export interface PasskeyKit {
  readonly mode: 'mock' | 'live';
  readonly rpId: string;
  createPasskey(input?: { userName?: string }): Promise<PasskeyCredential>;
  connect(): Promise<ConnectResult | null>;
  recover(): Promise<RecoverResult[]>;
  signAuthEntry(entryXdr: string): Promise<string>;
}

function inMemoryStorage(): CredentialStorage {
  const map = new Map<string, string>();
  return { get: (rpId) => map.get(rpId) ?? null, set: (rpId, id) => void map.set(rpId, id) };
}

/**
 * The downstream-adopter kit (S15, Deliverable #6). `mode:'mock'` wires a
 * deterministic in-memory authenticator + backend (zero network IO) so the
 * happy path matches the live path's SHAPE — swap `mock → live` and the demo
 * stays green. `mode:'live'` takes real adapters + a WebAuthn signer.
 */
export function createPasskeyKit(options: CreatePasskeyKitOptions): PasskeyKit {
  const networkPassphrase = options.networkPassphrase ?? TESTNET;
  const rpName = options.rpName ?? options.rpId;

  let webauthn: WebAuthnClient;
  let deployer: AccountDeployer;
  let indexer: IndexerAdapter;
  let storage: CredentialStorage;
  let signer: WebAuthnSigner;

  if (options.mode === 'mock') {
    const auth = mockAuthenticator({
      rpId: options.rpId,
      seed: options.seed,
      forceHighS: options.forceHighS,
    });
    const backend = createInMemoryBackend();
    webauthn = auth;
    deployer = backend.deployer;
    indexer = backend.indexer;
    signer = auth.sign;
    storage = inMemoryStorage();
  } else {
    if (!options.webauthn || !options.deployer || !options.indexer || !options.signer) {
      throw new Error('live mode requires webauthn, deployer, indexer and signer');
    }
    webauthn = options.webauthn;
    deployer = options.deployer;
    indexer = options.indexer;
    signer = options.signer;
    storage = options.storage ?? inMemoryStorage();
  }

  return {
    mode: options.mode,
    rpId: options.rpId,
    createPasskey: (input) =>
      createPasskeyCeremony({
        rpId: options.rpId,
        rpName,
        userName: input?.userName ?? 'user',
        deployer,
        webauthn,
        storage,
      }),
    connect: () =>
      connectCeremony({
        rpId: options.rpId,
        indexer,
        webauthn,
        storage,
        silentMediationSupported: false,
      }),
    recover: () => recoverCeremony({ rpId: options.rpId, indexer, webauthn }),
    signAuthEntry: (entryXdr) => signAuthEntryFn(entryXdr, { networkPassphrase, sign: signer }),
  };
}
