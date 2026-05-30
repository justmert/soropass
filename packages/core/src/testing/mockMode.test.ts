import { afterEach, describe, expect, it, vi } from 'vitest';
import { Address, Networks, StrKey, xdr } from '@stellar/stellar-sdk';
import { createPasskeyKit } from './index';
import { mockAuthenticator } from './mockAuthenticator';
import { referenceCheckAuth } from '../soroban/checkAuth';
import { derToCompact, derToCompactLowS, isLowS } from '../webauthn/signature';

const RP_ID = 'localhost';

function buildUnsignedEntry(): string {
  const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 3)));
  const credentials = new xdr.SorobanAddressCredentials({
    address: address.toScAddress(),
    nonce: new xdr.Int64(42),
    signatureExpirationLedger: 1000,
    signature: xdr.ScVal.scvVoid(),
  });
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: address.toScAddress(),
        functionName: 'noop',
        args: [],
      }),
    ),
    subInvocations: [],
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(credentials),
    rootInvocation: invocation,
  }).toXDR('base64');
}

function assembledSignature(entry: xdr.SorobanAuthorizationEntry): Uint8Array {
  const structMap = entry.credentials().address().signature().map()!;
  const field = structMap.find((e) => e.key().sym().toString() === 'signature')!;
  return new Uint8Array(field.val().bytes());
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mock mode (S15) — createPasskeyKit({ mode: "mock" })', () => {
  it('GATE: create → sign → recover return the same contractId; the sign verifies', async () => {
    const kit = createPasskeyKit({ mode: 'mock', rpId: RP_ID, seed: 'gate' });
    const created = await kit.createPasskey({ userName: 'alice' });
    expect(created.publicKey).toHaveLength(65);

    const connected = await kit.connect();
    const recovered = await kit.recover();
    expect(connected?.contractId).toBe(created.contractId);
    expect(recovered[0]?.contractId).toBe(created.contractId);

    const signed = await kit.signAuthEntry(buildUnsignedEntry());
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    const result = referenceCheckAuth(entry, created.publicKey, Networks.TESTNET);
    expect(result.success).toBe(true);
    expect(isLowS(assembledSignature(entry))).toBe(true);
  });

  it('GATE: a high-S authenticator is normalized — no un-normalized sig reaches verify (guards S04)', async () => {
    const kit = createPasskeyKit({ mode: 'mock', rpId: RP_ID, seed: 'highs', forceHighS: true });
    const created = await kit.createPasskey();
    const signed = await kit.signAuthEntry(buildUnsignedEntry());
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');

    // The assembled signature in the entry MUST be canonical low-S.
    expect(isLowS(assembledSignature(entry))).toBe(true);
    expect(referenceCheckAuth(entry, created.publicKey, Networks.TESTNET).success).toBe(true);

    // Prove the normalization is load-bearing: the raw high-S form is NOT low-S.
    const raw = mockAuthenticator({ rpId: RP_ID, seed: 'highs', forceHighS: true }).sign(
      'challenge',
    );
    expect(isLowS(derToCompact(raw.signature))).toBe(false);
    expect(isLowS(derToCompactLowS(raw.signature))).toBe(true);
  });

  it('runs with zero network IO (fetch is blocked)', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('network blocked in mock mode');
    });
    const kit = createPasskeyKit({ mode: 'mock', rpId: RP_ID, seed: 'no-net' });
    await kit.createPasskey();
    await kit.connect();
    await kit.recover();
    await expect(kit.signAuthEntry(buildUnsignedEntry())).resolves.toBeTypeOf('string');
  });

  it('is deterministic: same seed → same account + public key', async () => {
    const a = await createPasskeyKit({ mode: 'mock', rpId: RP_ID, seed: 'det' }).createPasskey();
    const b = await createPasskeyKit({ mode: 'mock', rpId: RP_ID, seed: 'det' }).createPasskey();
    expect(a.contractId).toBe(b.contractId);
    expect([...a.publicKey]).toEqual([...b.publicKey]);
  });

  it('live mode requires its dependencies', () => {
    expect(() => createPasskeyKit({ mode: 'live', rpId: RP_ID })).toThrow(/live mode requires/);
  });
});
