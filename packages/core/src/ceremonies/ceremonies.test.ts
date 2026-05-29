import { describe, expect, it } from 'vitest';
import { createPasskey } from './create';
import { connect } from './connect';
import { recover } from './recover';
import type { AccountDeployer, CredentialStorage, WebAuthnClient } from './types';
import type { IndexerAdapter } from '../adapters/types';
import { ATTESTATION_OBJECT, EXPECTED } from '../__fixtures__/realAssertion';
import { bytesToHex } from '../internal/bytes';

const RP_ID = 'localhost';
const CRED_ID = 'KEbWNCc7NgaYnUyrNeFGX9_3Y-8';
const CONTRACT_ID = 'CCONTRACTTESTACCOUNTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

function mockWebAuthn(): WebAuthnClient {
  return {
    create: () =>
      Promise.resolve({
        id: CRED_ID,
        rawId: new Uint8Array([1, 2, 3]),
        attestationObject: ATTESTATION_OBJECT,
      }),
    get: () =>
      Promise.resolve({
        id: CRED_ID,
        rawId: new Uint8Array([1, 2, 3]),
        authenticatorData: new Uint8Array(37),
        clientDataJSON: new Uint8Array(1),
        signature: new Uint8Array(64),
      }),
  };
}
function mockDeployer(): AccountDeployer {
  return { deploy: () => Promise.resolve({ contractId: CONTRACT_ID, txHash: 'hash' }) };
}
function mockIndexer(known: Record<string, string>): IndexerAdapter {
  return {
    resolveByCredential: (id) => {
      const contractId = known[id];
      return Promise.resolve(contractId ? [{ contractId }] : []);
    },
  };
}
function memStorage(): CredentialStorage {
  const map = new Map<string, string>();
  return { get: (r) => map.get(r) ?? null, set: (r, id) => void map.set(r, id) };
}

describe('ceremonies (S13)', () => {
  it('GATE: createPasskey → connect → recover return the same contractId', async () => {
    const storage = memStorage();
    const webauthn = mockWebAuthn();

    const created = await createPasskey({
      rpId: RP_ID,
      rpName: 'Test',
      userName: 'alice',
      deployer: mockDeployer(),
      webauthn,
      storage,
    });
    expect(created.contractId).toBe(CONTRACT_ID);
    expect(created.credentialId).toBe(CRED_ID);
    // ES256-only: a real SEC-1 key was extracted (RS256 would have thrown).
    expect(bytesToHex(created.publicKey)).toBe(EXPECTED.attestationSec1Hex);

    const indexer = mockIndexer({ [CRED_ID]: CONTRACT_ID });
    const connected = await connect({
      rpId: RP_ID,
      indexer,
      webauthn,
      storage,
      silentMediationSupported: true,
    });
    const recovered = await recover({ rpId: RP_ID, indexer, webauthn });

    expect(connected?.contractId).toBe(CONTRACT_ID);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.contractId).toBe(created.contractId);
    expect(connected?.contractId).toBe(created.contractId);
  });

  it('connect returns null when no credential is stored (caller should recover)', async () => {
    const result = await connect({
      rpId: RP_ID,
      indexer: mockIndexer({}),
      webauthn: mockWebAuthn(),
      storage: memStorage(),
      silentMediationSupported: false,
    });
    expect(result).toBeNull();
  });

  it('connect degrades gracefully where silent mediation is unsupported', async () => {
    const storage = memStorage();
    storage.set(RP_ID, CRED_ID);
    let getCalled = false;
    const base = mockWebAuthn();
    const webauthn: WebAuthnClient = {
      create: base.create,
      get: (o) => {
        getCalled = true;
        return base.get(o);
      },
    };
    const result = await connect({
      rpId: RP_ID,
      indexer: mockIndexer({ [CRED_ID]: CONTRACT_ID }),
      webauthn,
      storage,
      silentMediationSupported: false,
    });
    expect(getCalled).toBe(false); // no silent get attempted when unsupported
    expect(result?.contractId).toBe(CONTRACT_ID); // still resolves via the indexer
  });
});
