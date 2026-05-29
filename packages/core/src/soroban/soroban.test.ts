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
import { referenceCheckAuth, signAuthEntry, signTransaction } from '../sign';
import type { AssertionResult, WebAuthnSigner } from '../types';
import { concatBytes } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';

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
    return { authenticatorData, clientDataJSON, signature: der, credentialId: CRED_ID };
  };
}

function buildUnsignedEntry(): xdr.SorobanAuthorizationEntry {
  const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 9)));
  const credentials = new xdr.SorobanAddressCredentials({
    address: address.toScAddress(),
    nonce: new xdr.Int64(987654321),
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
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(credentials),
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
    const envelope = xdr.TransactionEnvelope.fromXDR(signedTx, 'base64');
    const signedEntry = envelope.v1().tx().operations()[0]?.body().invokeHostFunctionOp().auth()[0];
    expect(signedEntry).toBeDefined();
    expect(referenceCheckAuth(signedEntry!, PUB, Networks.TESTNET).success).toBe(true);
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
});
