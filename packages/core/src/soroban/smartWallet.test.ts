import { describe, expect, it } from 'vitest';
import { Address, Networks, StrKey, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import {
  buildSignerKeyScVal,
  compareSignerKeyScVal,
  referenceSmartWalletCheckAuth,
  signAuthEntry,
} from '../sign';
import type { AssertionResult, WebAuthnSigner } from '../types';
import { concatBytes } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';
import { addressCredentials, scBytes, scMap, scSymbol, scVec } from './scval';

const RP_ID = 'localhost';
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

const credsOf = (entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAddressCredentials => {
  const c = addressCredentials(entry);
  if (!c) throw new Error('expected address credentials');
  return c;
};
const vecOf = (v: xdr.ScVal): xdr.ScVal[] => {
  const x = scVec(v);
  if (!x) throw new Error('expected scvVec');
  return x;
};
const mapOf = (v: xdr.ScVal): xdr.ScMapEntry[] => {
  const x = scMap(v);
  if (!x) throw new Error('expected scvMap');
  return x;
};
const symOf = (v: xdr.ScVal): string => {
  const s = scSymbol(v);
  if (s === undefined) throw new Error('expected scvSymbol');
  return s;
};
const bytesOf = (v: xdr.ScVal): Uint8Array => {
  const b = scBytes(v);
  if (!b) throw new Error('expected scvBytes');
  return b;
};

/** A deterministic mock authenticator for a given key + credential id. */
function makeSigner(priv: Uint8Array, credentialId: Uint8Array): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    const authenticatorData = concatBytes(
      sha256(utf8ToBytes(RP_ID)),
      new Uint8Array([0x05]), // UP | UV
      new Uint8Array([0, 0, 0, 1]),
    );
    const clientDataJSON = utf8ToBytes(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: 'https://localhost' }),
    );
    const payload = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, priv).toDERRawBytes();
    return {
      authenticatorData,
      clientDataJSON,
      signature: der,
      credentialId,
      publicKey: p256.getPublicKey(priv, false),
    };
  };
}

function unsignedEntryXdr(): string {
  const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 9)));
  const credentials = new xdr.SorobanAddressCredentials({
    address: address.toScAddress(),
    nonce: 987654321n,
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

const PRIV_A = new Uint8Array(32).fill(7);
const PUB_A = p256.getPublicKey(PRIV_A, false);
const PRIV_B = new Uint8Array(32).fill(9);
const PUB_B = p256.getPublicKey(PRIV_B, false);

describe('smart-wallet ABI target (passkey-kit Signatures map — issue #32)', () => {
  it('assembles Signatures(Map<SignerKey, Signature>) and verifies in the reference __check_auth', async () => {
    const credId = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
    const signed = await signAuthEntry(unsignedEntryXdr(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credId),
      target: 'smart-wallet',
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');

    // Wire shape: signature is ScVal::Vec([ScVal::Map([...])]).
    const sig = credsOf(entry).signature;
    expect(sig.type).toBe('scvVec');
    const map = mapOf(vecOf(sig)[0]!);
    expect(map).toHaveLength(1);

    // Key is SignerKey::Secp256r1(rawCredentialId) — raw bytes, not hashed/utf8.
    const keyVec = vecOf(map[0]!.key);
    expect(symOf(keyVec[0]!)).toBe('Secp256r1');
    expect(hex(bytesOf(keyVec[1]!))).toBe(hex(credId));
    expect(hex(bytesOf(keyVec[1]!))).not.toBe(hex(sha256(credId))); // not hashed

    // Value is Signature::Secp256r1(Secp256r1Signature{...}).
    const valVec = vecOf(map[0]!.val);
    expect(symOf(valVec[0]!)).toBe('Secp256r1');
    const structFields = mapOf(valVec[1]!).map((e) => symOf(e.key));
    expect(structFields).toEqual(['authenticator_data', 'client_data_json', 'signature']);

    const result = referenceSmartWalletCheckAuth(
      entry,
      (id) => (id === hex(credId) ? PUB_A : undefined),
      Networks.TESTNET,
    );
    expect(result.success).toBe(true);
    expect(result.signers[0]?.challengeBound).toBe(true);
    expect(result.signers[0]?.signatureValid).toBe(true);
  });

  it('the bare single-signer struct does NOT satisfy the smart-wallet shape (separate ABI)', async () => {
    const credId = new Uint8Array([1, 2, 3, 4]);
    const bare = await signAuthEntry(unsignedEntryXdr(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credId),
      // default target: single-signer → bare Secp256r1Signature struct (scvMap)
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(bare, 'base64');
    expect(credsOf(entry).signature.type).toBe('scvMap');
    // The smart-wallet verifier cannot read a bare struct.
    const r = referenceSmartWalletCheckAuth(entry, () => PUB_A, Networks.TESTNET);
    expect(r.success).toBe(false);
  });

  it('merges a partially-signed entry and sorts the map by canonical ScVal byte order', async () => {
    // Two passkeys whose raw credential ids sort one way by bytes.
    const credHi = new Uint8Array([0x02, 0xff]);
    const credLo = new Uint8Array([0x02, 0x01]);
    // Sign with the higher-byte key FIRST, then merge the lower-byte key.
    const first = await signAuthEntry(unsignedEntryXdr(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credHi),
      target: 'smart-wallet',
    });
    const merged = await signAuthEntry(first, {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_B, credLo),
      target: 'smart-wallet',
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(merged, 'base64');
    const map = mapOf(vecOf(credsOf(entry).signature)[0]!);

    // Both signers preserved, and sorted so the lower bytes come first.
    expect(map).toHaveLength(2);
    const order = map.map((e) => hex(bytesOf(vecOf(e.key)[1]!)));
    expect(order).toEqual([hex(credLo), hex(credHi)]);

    // Both verify against their own keys.
    const r = referenceSmartWalletCheckAuth(
      entry,
      (id) => (id === hex(credHi) ? PUB_A : id === hex(credLo) ? PUB_B : undefined),
      Networks.TESTNET,
    );
    expect(r.success).toBe(true);
    expect(r.signers).toHaveLength(2);
  });

  it('re-signing with the same credential id replaces its entry (no duplicate)', async () => {
    const credId = new Uint8Array([5, 5, 5]);
    const once = await signAuthEntry(unsignedEntryXdr(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credId),
      target: 'smart-wallet',
    });
    const twice = await signAuthEntry(once, {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credId),
      target: 'smart-wallet',
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(twice, 'base64');
    const map = mapOf(vecOf(credsOf(entry).signature)[0]!);
    expect(map).toHaveLength(1);
  });

  it('stamps signatureExpirationLedger BEFORE signing so the challenge binds it', async () => {
    const credId = new Uint8Array([7, 7, 7, 7]);
    const signed = await signAuthEntry(unsignedEntryXdr(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credId),
      target: 'smart-wallet',
      signatureExpirationLedger: 5000, // overrides the entry's 2000
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    // The entry now carries 5000, and — since it was stamped BEFORE the challenge
    // was computed — the signature binds 5000 too (verify would fail if the sig
    // still bound the old 2000 while the entry reads 5000).
    expect(credsOf(entry).signatureExpirationLedger).toBe(5000);
    const r = referenceSmartWalletCheckAuth(
      entry,
      (id) => (id === hex(credId) ? PUB_A : undefined),
      Networks.TESTNET,
    );
    expect(r.success).toBe(true);
    expect(r.signers[0]?.challengeBound).toBe(true);
  });

  it('challenge-binding still holds: a wrong-network verify fails', async () => {
    const credId = new Uint8Array([9, 9]);
    const signed = await signAuthEntry(unsignedEntryXdr(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(PRIV_A, credId),
      target: 'smart-wallet',
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    const r = referenceSmartWalletCheckAuth(entry, () => PUB_A, Networks.PUBLIC);
    expect(r.success).toBe(false);
  });
});

describe('compareSignerKeyScVal — canonical byte order (not localeCompare)', () => {
  const key = (bytes: number[]): xdr.ScVal => buildSignerKeyScVal(new Uint8Array(bytes));

  it('orders same-variant keys by raw bytes element-wise', () => {
    expect(compareSignerKeyScVal(key([0x02, 0x01]), key([0x02, 0xff]))).toBeLessThan(0);
    expect(compareSignerKeyScVal(key([0x02, 0xff]), key([0x02, 0x01]))).toBeGreaterThan(0);
    expect(compareSignerKeyScVal(key([0x10]), key([0x10]))).toBe(0);
  });

  it('a shorter prefix sorts before a longer key (length handled, unlike a hex/localeCompare sort)', () => {
    expect(compareSignerKeyScVal(key([0x02]), key([0x02, 0x00]))).toBeLessThan(0);
    expect(compareSignerKeyScVal(key([0x02, 0x00]), key([0x02]))).toBeGreaterThan(0);
  });
});
