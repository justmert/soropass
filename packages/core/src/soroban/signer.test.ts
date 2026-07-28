import { describe, expect, it } from 'vitest';
import { Address, StrKey, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import {
  buildAddSignerOperation,
  buildRemoveSignerOperation,
  buildSecp256r1Signer,
} from './signer';
import { isKitError } from '../errors';

const WALLET = StrKey.encodeContract(Buffer.alloc(32, 3));
const CRED = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
const PUB = p256.getPublicKey(new Uint8Array(32).fill(7), false); // 65B SEC-1
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

function invokeArgs(op: xdr.Operation): xdr.InvokeContractArgs {
  return op.body().invokeHostFunctionOp().hostFunction().invokeContract();
}

describe('buildSecp256r1Signer — v1 Signer::Secp256r1 encoding (issue #32)', () => {
  it('encodes [Symbol, id, pubkey, SignerExpiration(None), SignerLimits(None), Storage(Persistent)]', () => {
    const v = buildSecp256r1Signer({ credentialId: CRED, publicKey: PUB }).vec()!;
    expect(v).toHaveLength(6);
    expect(v[0]!.sym().toString()).toBe('Secp256r1');
    expect(hex(new Uint8Array(v[1]!.bytes()))).toBe(hex(CRED)); // raw id, not hashed
    expect(hex(new Uint8Array(v[2]!.bytes()))).toBe(hex(PUB)); // SEC-1 pubkey in the value
    // SignerExpiration(None) and SignerLimits(None) are both scvVec([Void]).
    expect(v[3]!.vec()![0]!.switch().name).toBe('scvVoid');
    expect(v[4]!.vec()![0]!.switch().name).toBe('scvVoid');
    expect(v[5]!.vec()![0]!.sym().toString()).toBe('Persistent');
  });

  it('encodes SignerExpiration(Some(u64)) as a UNIX-seconds timestamp (v1)', () => {
    const exp = 1_900_000_000; // seconds, not a ledger sequence
    const v = buildSecp256r1Signer({ credentialId: CRED, publicKey: PUB, expiration: exp }).vec()!;
    const expInner = v[3]!.vec()![0]!;
    expect(expInner.switch().name).toBe('scvU64');
    expect(expInner.u64().toString()).toBe(String(exp));
  });

  it('honours SignerStorage::Temporary', () => {
    const v = buildSecp256r1Signer({
      credentialId: CRED,
      publicKey: PUB,
      storage: 'Temporary',
    }).vec()!;
    expect(v[5]!.vec()![0]!.sym().toString()).toBe('Temporary');
  });

  it('rejects a non-SEC-1 public key (INVALID_PUBLIC_KEY)', () => {
    try {
      buildSecp256r1Signer({ credentialId: CRED, publicKey: new Uint8Array(64) });
      expect.unreachable();
    } catch (e) {
      expect(isKitError(e) && e.code).toBe('INVALID_PUBLIC_KEY');
    }
    // Right length, wrong prefix.
    const wrongPrefix = new Uint8Array(65);
    wrongPrefix[0] = 0x02;
    expect(() => buildSecp256r1Signer({ credentialId: CRED, publicKey: wrongPrefix })).toThrow(
      /SEC-1/,
    );
  });

  it('rejects an empty credential id', () => {
    try {
      buildSecp256r1Signer({ credentialId: new Uint8Array(0), publicKey: PUB });
      expect.unreachable();
    } catch (e) {
      expect(isKitError(e) && e.code).toBe('CONTRACT_AUTH_FAILED');
    }
  });

  it('rejects a negative expiration', () => {
    expect(() =>
      buildSecp256r1Signer({ credentialId: CRED, publicKey: PUB, expiration: -1 }),
    ).toThrow(/non-negative/);
  });
});

describe('buildAddSignerOperation / buildRemoveSignerOperation', () => {
  it('builds a wallet.add_signer(signer) invoke-host operation', () => {
    const op = buildAddSignerOperation({
      walletContractId: WALLET,
      signer: { credentialId: CRED, publicKey: PUB },
    });
    const args = invokeArgs(op);
    expect(Address.fromScAddress(args.contractAddress()).toString()).toBe(WALLET);
    expect(args.functionName().toString()).toBe('add_signer');
    expect(args.args()).toHaveLength(1);
    expect(args.args()[0]!.vec()![0]!.sym().toString()).toBe('Secp256r1');
  });

  it('accepts a pre-built Signer ScVal (e.g. a non-secp256r1 signer)', () => {
    const prebuilt = buildSecp256r1Signer({ credentialId: CRED, publicKey: PUB });
    const op = buildAddSignerOperation({ walletContractId: WALLET, signer: prebuilt });
    expect(invokeArgs(op).functionName().toString()).toBe('add_signer');
  });

  it('builds a wallet.remove_signer(SignerKey::Secp256r1(id)) invoke-host operation', () => {
    const op = buildRemoveSignerOperation({ walletContractId: WALLET, credentialId: CRED });
    const args = invokeArgs(op);
    expect(args.functionName().toString()).toBe('remove_signer');
    const keyVec = args.args()[0]!.vec()!;
    expect(keyVec[0]!.sym().toString()).toBe('Secp256r1');
    expect(hex(new Uint8Array(keyVec[1]!.bytes()))).toBe(hex(CRED));
  });

  it('rejects an invalid wallet contract id', () => {
    try {
      buildAddSignerOperation({
        walletContractId: 'not-a-contract',
        signer: { credentialId: CRED, publicKey: PUB },
      });
      expect.unreachable();
    } catch (e) {
      expect(isKitError(e) && e.code).toBe('CONTRACT_AUTH_FAILED');
    }
  });
});
