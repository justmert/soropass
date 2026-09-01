import { describe, expect, it } from 'vitest';
import {
  Account,
  Address,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { authorizeEntry } from '@stellar/stellar-sdk';
import { referenceCheckAuth, signAuthEntry, signTransaction } from '../sign';
import { authEntryChallengeBytes } from './preimage';
import type { AssertionResult, WebAuthnSigner } from '../types';
import { concatBytes } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';
import { addressCredentials, scBytes, scMap, scSymbol, withAddressCredentials } from './scval';

const credsOf = (entry: xdr.SorobanAuthorizationEntry): xdr.SorobanAddressCredentials => {
  const c = addressCredentials(entry);
  if (!c) throw new Error('expected address credentials');
  return c;
};

function firstAuthEntry(envelopeXdr: string): xdr.SorobanAuthorizationEntry | undefined {
  let envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, 'base64');
  if (envelope.type === 'envelopeTypeTxFeeBump') {
    const inner = envelope.feeBump.tx.innerTx;
    if (inner.type !== 'envelopeTypeTx') throw new Error('expected a v1 inner tx');
    envelope = inner;
  }
  if (envelope.type !== 'envelopeTypeTx') throw new Error('expected a v1 envelope');
  const body = envelope.v1.tx.operations[0]?.body;
  if (!body || body.type !== 'invokeHostFunction') throw new Error('expected invokeHostFunction');
  return body.invokeHostFunctionOp.auth[0];
}

const PRIV = new Uint8Array(32).fill(7);
const PUB = p256.getPublicKey(PRIV, false); // 65-byte SEC-1
const CRED_ID = new Uint8Array([1, 2, 3, 4]);
const RP_ID = 'localhost';

/** A deterministic mock authenticator: signs the given challenge (or an override). */
function makeSigner(overrideChallenge?: string): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    const rpIdHash = sha256(utf8ToBytes(RP_ID));
    const authenticatorData = concatBytes(
      rpIdHash,
      new Uint8Array([0x05]), // UP | UV
      new Uint8Array([0, 0, 0, 1]), // counter
    );
    const clientDataJSON = utf8ToBytes(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: overrideChallenge ?? challenge,
        origin: 'https://localhost',
      }),
    );
    const payload = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, PRIV).toDERRawBytes(); // may be high-S → pipeline low-S normalizes
    return {
      authenticatorData,
      clientDataJSON,
      signature: der,
      credentialId: CRED_ID,
      publicKey: PUB,
    };
  };
}

function buildUnsignedEntry(
  variant: 'address' | 'addressV2' = 'address',
): xdr.SorobanAuthorizationEntry {
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
        functionName: 'increment',
        args: [],
      }),
    ),
    subInvocations: [],
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials:
      variant === 'addressV2'
        ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(credentials)
        : xdr.SorobanCredentials.sorobanCredentialsAddress(credentials),
    rootInvocation: invocation,
  });
}

describe('Soroban auth assembly (S11)', () => {
  it('GATE: a bare auth-entry sign verifies in the reference __check_auth → SUCCESS', async () => {
    const entryXdr = buildUnsignedEntry().toXDR('base64');
    const signed = await signAuthEntry(entryXdr, {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    const result = referenceCheckAuth(entry, PUB, Networks.TESTNET);
    expect(result.challengeBound).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.success).toBe(true);
  });

  it('GATE: a tx-root sign verifies in the reference __check_auth → SUCCESS', async () => {
    const unsigned = buildUnsignedEntry();
    const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 9)));
    const op = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: address.toScAddress(),
          functionName: 'increment',
          args: [],
        }),
      ),
      auth: [unsigned],
    });
    const account = new Account(Keypair.random().publicKey(), '0');
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const signedTx = await signTransaction(tx.toXDR(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
    });
    const signedEntry = firstAuthEntry(signedTx);
    expect(signedEntry).toBeDefined();
    expect(referenceCheckAuth(signedEntry!, PUB, Networks.TESTNET).success).toBe(true);
  });

  it('reference model rejects a high-S signature, matching the host (F-A2)', async () => {
    // The Soroban host REJECTS high-S at decode, so referenceCheckAuth models it
    // with lowS:true. The low-S signature the SDK emits verifies; its high-S
    // mirror (n - s) must not, or the model would accept what the chain rejects.
    const entryXdr = buildUnsignedEntry().toXDR('base64');
    const signed = await signAuthEntry(entryXdr, {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    expect(referenceCheckAuth(entry, PUB, Networks.TESTNET).signatureValid).toBe(true);

    const creds = credsOf(entry);
    const map = scMap(creds.signature)!;
    const sigField = map.find((e) => scSymbol(e.key) === 'signature')!;
    const low = scBytes(sigField.val)!;
    const s = p256.Signature.fromCompact(low);
    const high = new p256.Signature(s.r, p256.CURVE.n - s.s).toCompactRawBytes();
    // v17 XDR values are immutable: rebuild the entry with the tampered field.
    const tampered = withAddressCredentials(entry, creds, {
      signature: xdr.ScVal.scvMap(
        map.map((e) =>
          scSymbol(e.key) === 'signature'
            ? new xdr.ScMapEntry({ key: e.key, val: xdr.ScVal.scvBytes(high) })
            : e,
        ),
      ),
    });
    expect(referenceCheckAuth(tampered, PUB, Networks.TESTNET).signatureValid).toBe(false);
  });

  it('challenge-binding: a signature over the wrong challenge is rejected', async () => {
    const entryXdr = buildUnsignedEntry().toXDR('base64');
    const signed = await signAuthEntry(entryXdr, {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner('a-different-challenge-not-the-preimage'),
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    const result = referenceCheckAuth(entry, PUB, Networks.TESTNET);
    expect(result.challengeBound).toBe(false); // bound to the wrong challenge
    expect(result.success).toBe(false);
  });

  it('network-binding: verifying against the wrong network passphrase fails the binding', async () => {
    const entryXdr = buildUnsignedEntry().toXDR('base64');
    const signed = await signAuthEntry(entryXdr, {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    expect(referenceCheckAuth(entry, PUB, Networks.PUBLIC).success).toBe(false);
  });

  it('signs the auth entries inside a fee-bump envelope (not just a v1 tx)', async () => {
    const unsigned = buildUnsignedEntry();
    const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 9)));
    const op = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: address.toScAddress(),
          functionName: 'increment',
          args: [],
        }),
      ),
      auth: [unsigned],
    });
    const inner = new TransactionBuilder(new Account(Keypair.random().publicKey(), '0'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();
    inner.sign(Keypair.random());
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      Keypair.random(),
      '200',
      inner,
      Networks.TESTNET,
    );

    const signed = await signTransaction(feeBump.toXDR(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
    });
    const signedEntry = firstAuthEntry(signed);
    expect(signedEntry).toBeDefined();
    expect(referenceCheckAuth(signedEntry!, PUB, Networks.TESTNET).success).toBe(true);
  });
});

describe('Protocol 23 addressV2 credentials (CAP-71)', () => {
  it('GATE: signing an addressV2 entry verifies in the reference __check_auth and stays V2', async () => {
    const signed = await signAuthEntry(buildUnsignedEntry('addressV2').toXDR('base64'), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
    });
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signed, 'base64');
    expect(entry.credentials.type).toBe('sorobanCredentialsAddressV2');
    const result = referenceCheckAuth(entry, PUB, Networks.TESTNET);
    expect(result.challengeBound).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.success).toBe(true);
  });

  it('the V2 challenge binds the address: it differs from the classic challenge on identical fields', () => {
    const classic = authEntryChallengeBytes(buildUnsignedEntry('address'), Networks.TESTNET);
    const v2 = authEntryChallengeBytes(buildUnsignedEntry('addressV2'), Networks.TESTNET);
    expect(Buffer.from(v2).equals(Buffer.from(classic))).toBe(false);
  });

  it('matches the stellar-sdk authorizeEntry payload for BOTH credential variants (cross-check)', async () => {
    for (const variant of ['address', 'addressV2'] as const) {
      const entry = buildUnsignedEntry(variant);
      let sdkPayload: Uint8Array | undefined;
      await authorizeEntry(
        entry,
        (_preimage: unknown, payload: Uint8Array) => {
          sdkPayload = payload;
          throw new Error('captured');
        },
        2000, // the entry's own signatureExpirationLedger, so the preimages align
        Networks.TESTNET,
      ).catch(() => undefined);
      expect(sdkPayload).toBeDefined();
      expect(Buffer.from(sdkPayload!).toString('hex')).toBe(
        Buffer.from(authEntryChallengeBytes(entry, Networks.TESTNET)).toString('hex'),
      );
    }
  });

  it('signTransaction signs an addressV2 entry inside an envelope (regression: was silently skipped)', async () => {
    const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 9)));
    const op = Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: address.toScAddress(),
          functionName: 'increment',
          args: [],
        }),
      ),
      auth: [buildUnsignedEntry('addressV2')],
    });
    const tx = new TransactionBuilder(new Account(Keypair.random().publicKey(), '0'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();
    const signedTx = await signTransaction(tx.toXDR(), {
      networkPassphrase: Networks.TESTNET,
      sign: makeSigner(),
      signatureExpirationLedger: 5000,
    });
    const entry = firstAuthEntry(signedTx);
    expect(entry).toBeDefined();
    expect(entry!.credentials.type).toBe('sorobanCredentialsAddressV2');
    const creds = entry!.credentials;
    if (creds.type !== 'sorobanCredentialsAddressV2') throw new Error('unreachable');
    expect(creds.addressV2.signatureExpirationLedger).toBe(5000);
    expect(creds.addressV2.signature.type).toBe('scvMap');
    expect(referenceCheckAuth(entry!, PUB, Networks.TESTNET).success).toBe(true);
  });
});
