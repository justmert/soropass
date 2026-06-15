/**
 * LIVE create-from-scratch proof via the on-chain AccountFactory (real testnet).
 *
 * Generates a fresh P-256 "passkey", deploys a BRAND-NEW webauthn-account through
 * the factory (`factoryDeployer`), then signs + submits a `protected()` call so
 * the just-created account's `__check_auth` runs on-chain.
 *
 *   POSITIVE: correct key → on-chain SUCCESS
 *   NEGATIVE: wrong   key → on-chain FAILURE
 *
 * This is the full "create a passkey wallet on-chain" round-trip — what Demo 2
 * does in the browser, proven here headlessly.
 *
 * Env: SOURCE_SECRET (testnet, pays fees + sources the deploy). FACTORY_ID and
 * RPC_URL default to contracts/deployments.json / soroban-testnet.
 *
 * Run: SOURCE_SECRET=… pnpm --filter @soropass/core exec tsx scripts/factory-e2e.ts
 */
import { rpc, Contract, Keypair, Networks, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { readFileSync } from 'node:fs';
import { signTransaction, directSubmission, factoryDeployer } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const SOURCE = Keypair.fromSecret(required('SOURCE_SECRET'));
const deployments = JSON.parse(
  readFileSync(new URL('../../../contracts/deployments.json', import.meta.url), 'utf8'),
) as { testnet: { accountFactory: { contractId: string } } };
const FACTORY_ID = process.env.FACTORY_ID ?? deployments.testnet.accountFactory.contractId;
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

function makeSigner(privateKey: Uint8Array): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    const rpIdHash = sha256(new TextEncoder().encode(RP_ID));
    const authenticatorData = concat(rpIdHash, Uint8Array.of(0x05), Uint8Array.of(0, 0, 0, 1));
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }),
    );
    const payload = sha256(concat(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, privateKey).toDERRawBytes();
    return { authenticatorData, clientDataJSON, signature: der, credentialId: new Uint8Array(16).fill(1) };
  };
}

async function invokeProtected(
  server: rpc.Server,
  contractId: string,
  signer: WebAuthnSigner,
  label: string,
) {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(contractId).call('protected'))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(`${label}: simulation failed`);
  const prepared = rpc.assembleTransaction(tx, sim).build();

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
  const ext = v1tx.ext();
  if (ext.switch() === 1) {
    const sorobanData = ext.sorobanData();
    const resources = sorobanData.resources();
    resources.instructions(Math.min(100_000_000, resources.instructions() * 5 + 30_000_000));
    sorobanData.resourceFee(new xdr.Int64(9_000_000));
    v1tx.fee(10_000_000);
  }

  const signedAuthXdr = await signTransaction(envelope.toXDR('base64'), {
    networkPassphrase: NETWORK,
    sign: signer,
  });
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
  console.log(`factory ${FACTORY_ID} on testnet, source ${SOURCE.publicKey()}\n`);

  // 1. Fresh "passkey": a P-256 keypair → 65-byte SEC-1 public key.
  const priv = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(priv, false);
  const credentialId = 'demo-' + Buffer.from(publicKey.slice(1, 5)).toString('hex');

  // 2. Deploy a BRAND-NEW account through the factory.
  const deployer = factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: SOURCE.secret(),
  });
  const { contractId, txHash } = await deployer.deploy({ publicKey, credentialId });
  console.log(`✅ factory deployed account ${contractId}  (deploy tx ${txHash})\n`);

  // 3. Sign + submit protected() on the new account → __check_auth runs.
  const positive = await invokeProtected(server, contractId, makeSigner(priv), 'POSITIVE');
  const negative = await invokeProtected(
    server,
    contractId,
    makeSigner(p256.utils.randomPrivateKey()),
    'NEGATIVE',
  );

  console.log('');
  let ok = true;
  if (positive.status !== 'SUCCESS') {
    console.error('❌ positive run did not SUCCEED');
    ok = false;
  }
  if (negative.status === 'SUCCESS') {
    console.error('❌ negative run (wrong key) unexpectedly SUCCEEDED');
    ok = false;
  }
  if (ok) {
    console.log('✅ CREATE-FROM-SCRATCH PROOF — factory-deployed account; correct key → SUCCESS, wrong key → FAILED.');
    console.log(`   account: https://stellar.expert/explorer/testnet/contract/${contractId}`);
    console.log(`   tx:      https://stellar.expert/explorer/testnet/tx/${positive.hash}`);
  }
  process.exit(ok ? 0 : 1);
}

void main();
