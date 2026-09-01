import { describe, expect, it } from 'vitest';
import { Address, Networks, StrKey, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { signAuthEntry } from '../sign';
import { isKitError } from '../errors';
import type { AssertionResult, WebAuthnSigner } from '../types';
import { concatBytes } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';

const RP_ID = 'wallet.example';
const ORIGIN = 'https://wallet.example';
const PRIV = new Uint8Array(32).fill(7);
const PUB = p256.getPublicKey(PRIV, false);
const CRED_ID = new Uint8Array([1, 2, 3, 4]);

/** A mock authenticator with overridable ceremony fields so we can break each check. */
function makeSigner(
  over: {
    type?: string;
    origin?: string;
    rpId?: string;
    up?: boolean;
    uv?: boolean;
    challenge?: string;
    crossOrigin?: boolean;
  } = {},
): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    let flags = 0;
    if (over.up ?? true) flags |= 0x01;
    if (over.uv ?? true) flags |= 0x04;
    const authenticatorData = concatBytes(
      sha256(utf8ToBytes(over.rpId ?? RP_ID)),
      new Uint8Array([flags]),
      new Uint8Array([0, 0, 0, 1]),
    );
    const clientDataJSON = utf8ToBytes(
      JSON.stringify({
        type: over.type ?? 'webauthn.get',
        challenge: over.challenge ?? challenge,
        origin: over.origin ?? ORIGIN,
        ...(over.crossOrigin !== undefined ? { crossOrigin: over.crossOrigin } : {}),
      }),
    );
    const payload = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, PRIV).toDERRawBytes();
    return {
      authenticatorData,
      clientDataJSON,
      signature: der,
      credentialId: CRED_ID,
      publicKey: PUB,
    };
  };
}

function unsignedEntryXdr(): string {
  const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 9)));
  const credentials = new xdr.SorobanAddressCredentials({
    address: address.toScAddress(),
    nonce: 11n,
    signatureExpirationLedger: 2000,
    signature: xdr.ScVal.scvVoid(),
  });
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: address.toScAddress(),
        functionName: 'transfer',
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

const base = { networkPassphrase: Networks.TESTNET };

async function signExpectingCode(signer: WebAuthnSigner, verify: object, code: string) {
  try {
    await signAuthEntry(unsignedEntryXdr(), { ...base, sign: signer, verify });
    throw new Error('expected pre-flight to throw');
  } catch (e) {
    expect(isKitError(e)).toBe(true);
    expect((e as { code: string }).code).toBe(code);
  }
}

describe('sign pre-flight verification (opt-in)', () => {
  it('passes for a valid assertion with full RP context', async () => {
    const signed = await signAuthEntry(unsignedEntryXdr(), {
      ...base,
      sign: makeSigner(),
      verify: { rpId: RP_ID, origin: ORIGIN, publicKey: PUB, requireUserVerification: true },
    });
    expect(typeof signed).toBe('string');
  });

  it('surfaces ORIGIN_MISMATCH for a wrong origin', async () => {
    await signExpectingCode(
      makeSigner({ origin: 'https://evil.example' }),
      { origin: ORIGIN },
      'ORIGIN_MISMATCH',
    );
  });

  it('surfaces RP_ID_MISMATCH for a wrong rpId hash', async () => {
    await signExpectingCode(
      makeSigner({ rpId: 'other.example' }),
      { rpId: RP_ID },
      'RP_ID_MISMATCH',
    );
  });

  it('surfaces CHALLENGE_MISMATCH when the assertion signs a different challenge', async () => {
    await signExpectingCode(
      makeSigner({ challenge: 'not-the-preimage' }),
      { rpId: RP_ID },
      'CHALLENGE_MISMATCH',
    );
  });

  it('rejects a non-webauthn.get assertion (e.g. a registration response)', async () => {
    await signExpectingCode(
      makeSigner({ type: 'webauthn.create' }),
      { rpId: RP_ID },
      'UNSUPPORTED_AUTHENTICATOR',
    );
  });

  it('rejects an assertion missing the User-Present (UP) flag (passkey-kit v1)', async () => {
    await signExpectingCode(
      makeSigner({ up: false }),
      { rpId: RP_ID },
      'UNSUPPORTED_AUTHENTICATOR',
    );
  });

  it('rejects a missing UV flag only when requireUserVerification is set', async () => {
    // UV absent but not required → passes.
    const ok = await signAuthEntry(unsignedEntryXdr(), {
      ...base,
      sign: makeSigner({ uv: false }),
      verify: { rpId: RP_ID },
    });
    expect(typeof ok).toBe('string');
    // UV absent and required → throws.
    await signExpectingCode(
      makeSigner({ uv: false }),
      { requireUserVerification: true },
      'UNSUPPORTED_AUTHENTICATOR',
    );
  });

  it('surfaces CONTRACT_AUTH_FAILED when the signature does not verify against the given key', async () => {
    const wrongKey = p256.getPublicKey(new Uint8Array(32).fill(3), false);
    await signExpectingCode(makeSigner(), { publicKey: wrongKey }, 'CONTRACT_AUTH_FAILED');
  });

  it('rejects a cross-origin assertion by default, and allows it with allowCrossOrigin', async () => {
    await signExpectingCode(
      makeSigner({ crossOrigin: true }),
      { origin: ORIGIN },
      'ORIGIN_MISMATCH',
    );
    const ok = await signAuthEntry(unsignedEntryXdr(), {
      ...base,
      sign: makeSigner({ crossOrigin: true }),
      verify: { origin: ORIGIN, allowCrossOrigin: true },
    });
    expect(typeof ok).toBe('string');
  });

  it('skips all pre-flight when no verify option is given (default)', async () => {
    const signed = await signAuthEntry(unsignedEntryXdr(), {
      ...base,
      sign: makeSigner({ type: 'webauthn.create', up: false, origin: 'https://evil.example' }),
    });
    expect(typeof signed).toBe('string'); // no throw — opt-in only
  });
});
