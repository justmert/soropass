/**
 * MAINNET wrong-key rejection proof (cheap: runs against an EXISTING wallet, no deploy).
 *
 * A random (wrong) secp256r1 key signs a 0.05 XLM transfer FROM an existing passkey
 * smart account. The account's on-chain __check_auth must REJECT it: the submitted tx
 * fails. Simulation passes (recording-auth does not check the signature), so the failure
 * is the signature check on submit, exactly what we want to prove.
 *
 * Run: SOURCE_SECRET=… WALLET=C… pnpm --filter @soropass/core exec tsx scripts/wrongkey-reject-mainnet.ts
 */
import {
  rpc,
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { signTransaction, directSubmission } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL ?? 'https://mainnet.sorobanrpc.com';
const NETWORK = Networks.PUBLIC;
const SAC = Asset.native().contractId(NETWORK);
const SOURCE = Keypair.fromSecret(required('SOURCE_SECRET'));
const WALLET = process.env.WALLET ?? 'CDITI5XIV3WW6XT6PHV6OOQVCMORZPZDQXCXOGZBPJKJQJ3UO7OGHFCX';
const SEND = 500_000n; // 0.05 XLM (fits the wallet's remaining balance)
const RP_ID = 'passkey.localhost';
const ORIGIN = 'https://passkey.localhost';
const server = new rpc.Server(RPC_URL);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
function concat(...a: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}
function wrongKeySigner(): WebAuthnSigner {
  const priv = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(priv, false);
  return (challenge: string): AssertionResult => {
    const authenticatorData = concat(
      sha256(new TextEncoder().encode(RP_ID)),
      Uint8Array.of(0x05),
      Uint8Array.of(0, 0, 0, 1),
    );
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }),
    );
    const der = p256.sign(sha256(concat(authenticatorData, sha256(clientDataJSON))), priv).toDERRawBytes();
    return { authenticatorData, clientDataJSON, signature: der, credentialId: new Uint8Array(16).fill(9), publicKey };
  };
}

async function main(): Promise<void> {
  console.log(`wrong-key rejection: wallet ${WALLET}, native SAC ${SAC}`);
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(
      new Contract(SAC).call(
        'transfer',
        Address.fromString(WALLET).toScVal(),
        Address.fromString(SOURCE.publicKey()).toScVal(),
        nativeToScVal(SEND, { type: 'i128' }),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(`sim failed: ${JSON.stringify(sim)}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  const validUntil = (await server.getLatestLedger()).sequence + 1000;
  const envelope = xdr.TransactionEnvelope.fromXDR(prepared.toXDR(), 'base64');
  const v1 = envelope.v1().tx();
  for (const op of v1.operations()) {
    if (op.body().switch().name !== 'invokeHostFunction') continue;
    for (const entry of op.body().invokeHostFunctionOp().auth()) {
      if (entry.credentials().switch().name === 'sorobanCredentialsAddress') {
        entry.credentials().address().signatureExpirationLedger(validUntil);
      }
    }
  }
  const ext = v1.ext();
  if (ext.switch() === 1) {
    const sd = ext.sorobanData();
    const r = sd.resources();
    r.instructions(Math.min(100_000_000, r.instructions() * 5 + 30_000_000));
    sd.resourceFee(new xdr.Int64(10_000_000));
    v1.fee(11_000_000);
  }
  const signedXdr = await signTransaction(envelope.toXDR('base64'), {
    networkPassphrase: NETWORK,
    sign: wrongKeySigner(),
  });
  const finalTx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
  finalTx.sign(SOURCE);
  const res = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(finalTx.toXDR());

  const rejected = res.status !== 'SUCCESS';
  console.log(`wrong-key transfer: ${res.status} (tx ${res.hash})`);
  if (rejected) {
    console.log('WRONG-KEY REJECTION PROOF (mainnet) — __check_auth rejected the wrong signature.');
    console.log(`  tx: https://stellar.expert/explorer/public/tx/${res.hash}`);
  } else {
    console.error('UNEXPECTED: wrong key was accepted on-chain');
  }
  process.exit(rejected ? 0 : 1);
}

void main();
