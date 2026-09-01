import { describe, expect, it } from 'vitest';
import {
  Account,
  Address,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { type AssertionResult, signAuthEntry, signTransaction } from './sign';
import { isLowS } from '../webauthn/signature';
import { sampleAuthEntry } from '../testing/sampleAuthEntry';

const NETWORK = Networks.TESTNET;
const ACCOUNT_A = 'CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5';
const ACCOUNT_B = 'CCZ3WXFI4ZT7H5DEPNPV5IU3RFKN22PUR2LHITGWUD2BUCIT6TEUGAAA';
const SOURCE_G = 'GAZ2XFTUW6TPHTAIZ5QWS2BEILLHGMPPZUWCOVIJG5FHNWRU635T2ROD';

const TEST_PUB = (() => {
  const k = new Uint8Array(65);
  k[0] = 0x04;
  return k;
})();

function assertion(signature: Uint8Array): AssertionResult {
  return {
    authenticatorData: new Uint8Array(37),
    clientDataJSON: new TextEncoder().encode('{"type":"webauthn.get"}'),
    signature,
    credentialId: new Uint8Array(16),
    publicKey: TEST_PUB,
  };
}

function sigSwitch(entry: xdr.SorobanAuthorizationEntry): string {
  const creds = entry.credentials;
  if (creds.type !== 'sorobanCredentialsAddress') throw new Error('expected address credentials');
  return creds.address.signature.type;
}

function twoEntryTx(): string {
  const scAddr = new Address(ACCOUNT_A).toScAddress();
  const op = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeInvokeContract(
      new xdr.InvokeContractArgs({ contractAddress: scAddr, functionName: 'protected', args: [] }),
    ),
    auth: [
      xdr.SorobanAuthorizationEntry.fromXDR(sampleAuthEntry(ACCOUNT_A), 'base64'),
      xdr.SorobanAuthorizationEntry.fromXDR(sampleAuthEntry(ACCOUNT_B), 'base64'),
    ],
  });
  return new TransactionBuilder(new Account(SOURCE_G, '0'), {
    fee: '100',
    networkPassphrase: NETWORK,
  })
    .addOperation(op)
    .setTimeout(60)
    .build()
    .toXDR();
}

function authEntries(signedXdr: string): xdr.SorobanAuthorizationEntry[] {
  const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, 'base64');
  if (envelope.type !== 'envelopeTypeTx') throw new Error('expected a v1 envelope');
  const body = envelope.v1.tx.operations[0]!.body;
  if (body.type !== 'invokeHostFunction') throw new Error('expected invokeHostFunction');
  return body.invokeHostFunctionOp.auth;
}

describe('signAuthEntry / signTransaction hardening', () => {
  it('low-S normalizes an already-compact high-S signature (invariant #2, H2)', async () => {
    // A real, valid high-S signature (S > n/2). p256.sign() may return either
    // parity, so normalize to low-S first, THEN flip to the guaranteed-high-S
    // form (n - s). Without this, the fixture is high-S only ~half the time and
    // the precondition assert flakes.
    const raw = p256.sign(new Uint8Array(32).fill(3), p256.utils.randomPrivateKey());
    const low = raw.s > p256.CURVE.n / 2n ? new p256.Signature(raw.r, p256.CURVE.n - raw.s) : raw;
    const highCompact = new p256.Signature(low.r, p256.CURVE.n - low.s).toCompactRawBytes();
    expect(isLowS(highCompact)).toBe(false);

    const signedXdr = await signAuthEntry(sampleAuthEntry(ACCOUNT_A), {
      networkPassphrase: NETWORK,
      sign: () => assertion(highCompact),
    });
    const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64');
    const creds = signed.credentials;
    if (creds.type !== 'sorobanCredentialsAddress') throw new Error('expected address credentials');
    const sig = creds.address.signature;
    if (sig.type !== 'scvMap') throw new Error('expected an scvMap signature');
    const field = sig.map!.find(
      (e) => e.key.type === 'scvSymbol' && e.key.sym.toString() === 'signature',
    )!;
    if (field.val.type !== 'scvBytes') throw new Error('expected scvBytes signature field');
    const outSig = new Uint8Array(field.val.bytes.toBytes());
    expect(outSig).toHaveLength(64);
    expect(isLowS(outSig)).toBe(true);
  });

  it("signTransaction with signerAddress signs only that account's auth entries (H1)", async () => {
    const signedXdr = await signTransaction(twoEntryTx(), {
      networkPassphrase: NETWORK,
      sign: () => assertion(new Uint8Array(64).fill(1)),
      signerAddress: ACCOUNT_A,
    });
    const auth = authEntries(signedXdr);
    expect(sigSwitch(auth[0]!)).toBe('scvMap'); // A: signed
    expect(sigSwitch(auth[1]!)).toBe('scvVoid'); // B: left untouched
  });

  it('signTransaction without signerAddress signs every entry (back-compat)', async () => {
    const signedXdr = await signTransaction(twoEntryTx(), {
      networkPassphrase: NETWORK,
      sign: () => assertion(new Uint8Array(64).fill(1)),
    });
    const auth = authEntries(signedXdr);
    expect(sigSwitch(auth[0]!)).toBe('scvMap');
    expect(sigSwitch(auth[1]!)).toBe('scvMap');
  });
});
