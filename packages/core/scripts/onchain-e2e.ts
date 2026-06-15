/**
 * LIVE on-chain proof (real Stellar testnet — NOT a mock).
 *
 * Proves that an auth entry assembled + signed by `@soropass/core`
 * (`signTransaction` → low-S compact secp256r1 + `Secp256r1Signature` ScVal +
 * challenge bound to the Soroban auth preimage) actually passes the deployed
 * `__check_auth` of a real custom-account contract on testnet.
 *
 *   POSITIVE: correct P-256 key  → on-chain SUCCESS
 *   NEGATIVE: wrong   P-256 key  → on-chain FAILURE (host secp256r1_verify traps)
 *
 * Env: CONTRACT_ID, SOURCE_SECRET (testnet account that pays fees). RPC defaults
 * to soroban-testnet. The passkey key is the fixed seed the contract was
 * deployed with (0x07*32); the negative run uses 0x09*32.
 *
 * Run: CONTRACT_ID=… SOURCE_SECRET=… pnpm --filter @soropass/core exec tsx scripts/onchain-e2e.ts
 */
import { rpc, Contract, Keypair, Networks, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { signTransaction, directSubmission } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const CONTRACT_ID = required('CONTRACT_ID');
const SOURCE = Keypair.fromSecret(required('SOURCE_SECRET'));
const RP_ID = 'passkey.localhost';
const ORIGIN = 'https://passkey.localhost';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/** A P-256 "passkey" signer mirroring a real authenticator's signed payload. */
function makeSigner(privateKey: Uint8Array): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    const rpIdHash = sha256(new TextEncoder().encode(RP_ID));
    const authenticatorData = concat(rpIdHash, Uint8Array.of(0x05), Uint8Array.of(0, 0, 0, 1));
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }),
    );
    const payload = sha256(concat(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, privateKey).toDERRawBytes(); // may be high-S; SDK normalizes
    return {
      authenticatorData,
      clientDataJSON,
      signature: der,
      credentialId: new Uint8Array(16).fill(1),
    };
  };
}

async function invokeProtected(server: rpc.Server, signer: WebAuthnSigner, label: string) {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(CONTRACT_ID).call('protected'))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`${label}: simulation failed: ${JSON.stringify(sim)}`);
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();

  // Set a valid future expiration ledger on every address-credential auth entry,
  // THEN sign — the challenge binds nonce+expiration+invocation+networkId.
  const validUntil = (await server.getLatestLedger()).sequence + 1000;
  const envelope = xdr.TransactionEnvelope.fromXDR(prepared.toXDR(), 'base64');
  const v1tx = envelope.v1().tx();
  for (const op of v1tx.operations()) {
    if (op.body().switch().name !== 'invokeHostFunction') continue;
    for (const entry of op.body().invokeHostFunctionOp().auth()) {
      if (entry.credentials().switch().name === 'sorobanCredentialsAddress') {
        entry.credentials().address().signatureExpirationLedger(validUntil);
      }
    }
  }

  // Simulation runs `__check_auth` in recording mode and never executes the
  // expensive `secp256r1_verify`, so it under-budgets CPU instructions. Inflate
  // the Soroban instruction budget + resource fee so the real verification fits.
  const ext = v1tx.ext();
  if (ext.switch() === 1) {
    const sorobanData = ext.sorobanData();
    const resources = sorobanData.resources();
    resources.instructions(Math.min(100_000_000, resources.instructions() * 5 + 30_000_000));
    sorobanData.resourceFee(new xdr.Int64(9_000_000));
    v1tx.fee(10_000_000);
  }

  // SDK signs the Soroban auth entries (passkey → low-S → Secp256r1Signature ScVal).
  const signedAuthXdr = await signTransaction(envelope.toXDR('base64'), {
    networkPassphrase: NETWORK,
    sign: signer,
  });

  // Source signs the envelope (fees/sequence) and we submit via the SDK's adapter.
  const finalTx = TransactionBuilder.fromXDR(signedAuthXdr, NETWORK);
  finalTx.sign(SOURCE);
  const result = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(
    finalTx.toXDR(),
  );
  console.log(`${label}: ${result.status}  (tx ${result.hash})`);
  return result;
}

async function main(): Promise<void> {
  const server = new rpc.Server(RPC_URL);
  console.log(`contract ${CONTRACT_ID} on testnet, source ${SOURCE.publicKey()}\n`);

  const positive = await invokeProtected(
    server,
    makeSigner(new Uint8Array(32).fill(7)),
    'POSITIVE',
  );
  const negative = await invokeProtected(
    server,
    makeSigner(new Uint8Array(32).fill(9)),
    'NEGATIVE',
  );

  console.log('');
  let ok = true;
  if (positive.status !== 'SUCCESS') {
    console.error('❌ positive run did not SUCCEED on-chain');
    ok = false;
  }
  if (negative.status === 'SUCCESS') {
    console.error('❌ negative run (wrong key) unexpectedly SUCCEEDED on-chain');
    ok = false;
  }
  if (ok) {
    console.log('✅ ON-CHAIN PROOF — correct passkey signature → SUCCESS; wrong key → FAILED.');
    console.log(`   verify: https://stellar.expert/explorer/testnet/tx/${positive.hash}`);
  }
  process.exit(ok ? 0 : 1);
}

void main();
