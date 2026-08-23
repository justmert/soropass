/**
 * LIVE passkey-authorized XLM TRANSFER on MAINNET (real, small: 0.2 XLM).
 *
 * fresh passkey → factory deploys a smart account → fund it 0.3 XLM → the passkey
 * authorizes a 0.2 XLM transfer from the smart account via the native SAC.
 * Correct key → SUCCESS and the wallet balance drops 0.2 XLM; wrong key → FAILED.
 *
 * The proof is the WALLET's own balance delta (0.2 XLM out), so the destination is
 * just the funded deployer account (which already exists on mainnet).
 *
 * Run: SOURCE_SECRET=… pnpm --filter @soropass/core exec tsx scripts/transfer-e2e-mainnet.ts
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
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { readFileSync } from 'node:fs';
import { signTransaction, directSubmission, factoryDeployer } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL ?? 'https://mainnet.sorobanrpc.com';
const NETWORK = Networks.PUBLIC;
const SAC = Asset.native().contractId(NETWORK); // native XLM SAC (mainnet)
const SOURCE = Keypair.fromSecret(required('SOURCE_SECRET'));
const deployments = JSON.parse(
  readFileSync(new URL('../../../contracts/deployments.json', import.meta.url), 'utf8'),
) as { mainnet: { accountFactory: { contractId: string } } };
const FACTORY_ID = process.env.FACTORY_ID ?? deployments.mainnet.accountFactory.contractId;
const RP_ID = 'passkey.localhost';
const ORIGIN = 'https://passkey.localhost';
const FUND = 3_000_000n; // 0.3 XLM into the wallet
const SEND = 2_000_000n; // 0.2 XLM passkey-signed transfer
const server = new rpc.Server(RPC_URL);

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
function makeSigner(privateKey: Uint8Array): WebAuthnSigner {
  const publicKey = p256.getPublicKey(privateKey, false); // 65-byte SEC-1
  return (challenge: string): AssertionResult => {
    const rpIdHash = sha256(new TextEncoder().encode(RP_ID));
    const authenticatorData = concat(rpIdHash, Uint8Array.of(0x05), Uint8Array.of(0, 0, 0, 1));
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }),
    );
    const payload = sha256(concat(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, privateKey).toDERRawBytes();
    return {
      authenticatorData,
      clientDataJSON,
      signature: der,
      credentialId: new Uint8Array(16).fill(1),
      publicKey, // v0.2 single-signer account verifies against the inline key
    };
  };
}

const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const addr = (s: string) => Address.fromString(s).toScVal();

/** Read a native-SAC balance (i128 stroops) for an address via simulation. */
async function sacBalance(who: string): Promise<bigint> {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(SAC).call('balance', addr(who)))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) return -1n;
  return BigInt(scValToNative(sim.result.retval) as bigint);
}

/** source-authorized SAC transfer (no passkey) — used to fund the wallet. */
async function fund(to: string, stroops: bigint, label: string) {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK })
    .addOperation(
      new Contract(SAC).call('transfer', addr(SOURCE.publicKey()), addr(to), i128(stroops)),
    )
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim))
    throw new Error(`${label}: sim failed ${JSON.stringify(sim)}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(SOURCE);
  const res = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(
    prepared.toXDR(),
  );
  console.log(`${label}: ${res.status} (tx ${res.hash})`);
  return res;
}

/** passkey-authorized SAC transfer FROM the smart account. */
async function transferFromWallet(
  wallet: string,
  to: string,
  stroops: bigint,
  signer: WebAuthnSigner,
  label: string,
) {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(SAC).call('transfer', addr(wallet), addr(to), i128(stroops)))
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim))
    throw new Error(`${label}: sim failed ${JSON.stringify(sim)}`);
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
    sign: signer,
  });
  const finalTx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
  finalTx.sign(SOURCE);
  const res = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(
    finalTx.toXDR(),
  );
  console.log(`${label}: ${res.status} (tx ${res.hash})`);
  return res;
}

async function main(): Promise<void> {
  console.log(`mainnet transfer proof: factory ${FACTORY_ID}, native SAC ${SAC}`);
  const priv = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(priv, false);
  const credentialId = 'demo-' + Buffer.from(publicKey.slice(1, 5)).toString('hex');

  const { contractId: wallet } = await factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: SOURCE.secret(),
  }).deploy({ publicKey, credentialId });
  console.log(`wallet (smart account): ${wallet}`);

  await fund(wallet, FUND, 'FUND wallet 0.3 XLM');

  const dest = SOURCE.publicKey(); // an account that already exists on mainnet
  // Wrong key FIRST, while the wallet still holds the full balance, so the failure is the
  // on-chain __check_auth rejecting the signature, not an insufficient-balance sim error.
  const negative = await transferFromWallet(
    wallet,
    dest,
    SEND,
    makeSigner(p256.utils.randomPrivateKey()),
    'TRANSFER wrong key',
  );
  const walletBefore = await sacBalance(wallet);
  const positive = await transferFromWallet(
    wallet,
    dest,
    SEND,
    makeSigner(priv),
    'TRANSFER correct key (0.2 XLM)',
  );
  const walletAfter = await sacBalance(wallet);

  console.log('');
  const moved = walletBefore - walletAfter;
  console.log(`wallet balance delta: ${moved.toString()} stroops (expect ${SEND.toString()})`);
  const ok = positive.status === 'SUCCESS' && negative.status !== 'SUCCESS' && moved === SEND;
  if (ok) {
    console.log('PASSKEY TRANSFER PROOF (mainnet) — passkey moved 0.2 XLM on-chain; wrong key -> FAILED.');
    console.log(`  wallet:       ${wallet}`);
    console.log(`  transfer tx:  https://stellar.expert/explorer/public/tx/${positive.hash}`);
    console.log(`  wrong-key tx: https://stellar.expert/explorer/public/tx/${negative.hash}`);
  } else {
    console.error('unexpected result', {
      positive: positive.status,
      negative: negative.status,
      moved: moved.toString(),
    });
  }
  process.exit(ok ? 0 : 1);
}

void main();
