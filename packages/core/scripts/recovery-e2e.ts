/**
 * LIVE multi-device recovery proof on the v0.2 webauthn-account (real testnet).
 *
 * The account is native multi-signer, so recovery no longer needs passkey-kit v1:
 *   1. Factory-deploy a fresh account with founding passkey A.
 *   2. add_signer(B) authorized by A  → account holds A + B.
 *   3. add_signer(C) authorized by B   → SUCCESS (the new device can sign).
 *   4. remove_signer(A) authorized by B → account no longer holds A.
 *   5. add_signer(D) authorized by A    → FAILED (the old device is revoked).
 *
 * This is the "lost a device, enroll a new one, retire the old one" flow proven
 * end to end on our own contract.
 *
 * Env: SOURCE_SECRET (testnet, pays fees + sources the txs). FACTORY_ID and
 * RPC_URL default to contracts/deployments.json / soroban-testnet.
 *
 * Run: SOURCE_SECRET=… FACTORY_ID=… pnpm --filter @soropass/core exec tsx scripts/recovery-e2e.ts
 */
import {
  rpc,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { readFileSync } from 'node:fs';
import { signTransaction, directSubmission, factoryDeployer } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';
import { bumpSorobanFees } from './sorobanFees';

const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const SOURCE = Keypair.fromSecret(required('SOURCE_SECRET'));
const deployments = JSON.parse(
  readFileSync(new URL('../../../contracts/deployments.json', import.meta.url), 'utf8'),
) as { testnetV02: { accountFactory: { contractId: string } } };
const FACTORY_ID = process.env.FACTORY_ID ?? deployments.testnetV02.accountFactory.contractId;
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
  const publicKey = p256.getPublicKey(privateKey, false);
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
      publicKey,
    };
  };
}

/** Invoke `fn(args)` on `contractId`, signing the account auth entry with `signer`. */
async function invoke(
  server: rpc.Server,
  contractId: string,
  fn: string,
  args: xdr.ScVal[],
  signer: WebAuthnSigner,
  label: string,
): Promise<{ status: string; hash: string }> {
  const account = await server.getAccount(SOURCE.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(contractId).call(fn, ...args))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.log(`${label}: SIMFAIL`);
    return { status: 'SIMFAIL', hash: '' };
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();

  const validUntil = (await server.getLatestLedger()).sequence + 1000;
  const envelope = bumpSorobanFees(xdr.TransactionEnvelope.fromXDR(prepared.toXDR(), 'base64'), {
    resourceFee: 9_000_000n,
    txFee: 10_000_000,
  });

  const signedAuthXdr = await signTransaction(envelope.toXDR('base64'), {
    networkPassphrase: NETWORK,
    sign: signer,
    signatureExpirationLedger: validUntil,
  });
  const finalTx = TransactionBuilder.fromXDR(signedAuthXdr, NETWORK);
  finalTx.sign(SOURCE);
  const result = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(
    finalTx.toXDR(),
  );
  console.log(`${label}: ${result.status}  (tx ${result.hash})`);
  return result;
}

const pkArg = (pub: Uint8Array): xdr.ScVal => nativeToScVal(Buffer.from(pub), { type: 'bytes' });

async function main(): Promise<void> {
  const server = new rpc.Server(RPC_URL);
  console.log(`factory ${FACTORY_ID} on testnet, source ${SOURCE.publicKey()}\n`);

  const privA = p256.utils.randomPrivateKey();
  const pubA = p256.getPublicKey(privA, false);
  const privB = p256.utils.randomPrivateKey();
  const pubB = p256.getPublicKey(privB, false);
  // Fresh keys used only to prove a device can authorize a state change (each
  // add_signer runs __check_auth for the signing device).
  const pubC = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const pubD = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const credentialId = 'recover-' + Buffer.from(pubA.slice(1, 5)).toString('hex');

  // 1. Deploy a fresh account with founding key A.
  const deployer = factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: SOURCE.secret(),
  });
  const { contractId, txHash } = await deployer.deploy({ publicKey: pubA, credentialId });
  console.log(`account ${contractId}  (deploy tx ${txHash})\n`);

  // 2. A enrolls a second device B.
  const add = await invoke(
    server,
    contractId,
    'add_signer',
    [pkArg(pubB)],
    makeSigner(privA),
    'add_signer(B) by A ',
  );
  // 3. B can now authorize on its own (add_signer(C) runs __check_auth for B).
  const byB = await invoke(
    server,
    contractId,
    'add_signer',
    [pkArg(pubC)],
    makeSigner(privB),
    'add_signer(C) by B ',
  );
  // 4. B retires the lost device A.
  const remove = await invoke(
    server,
    contractId,
    'remove_signer',
    [pkArg(pubA)],
    makeSigner(privB),
    'remove_signer(A) by B',
  );
  // 5. A can no longer authorize (add_signer(D) by the revoked A must fail).
  const byA = await invoke(
    server,
    contractId,
    'add_signer',
    [pkArg(pubD)],
    makeSigner(privA),
    'add_signer(D) by A ',
  );

  console.log('');
  const ok =
    add.status === 'SUCCESS' &&
    byB.status === 'SUCCESS' &&
    remove.status === 'SUCCESS' &&
    byA.status !== 'SUCCESS';
  if (ok) {
    console.log('✅ RECOVERY PROOF — add device B, B signs, remove device A, A is revoked.');
    console.log(`   account:     https://stellar.expert/explorer/testnet/contract/${contractId}`);
    console.log(`   add tx:      https://stellar.expert/explorer/testnet/tx/${add.hash}`);
    console.log(`   remove tx:   https://stellar.expert/explorer/testnet/tx/${remove.hash}`);
  } else {
    console.error('❌ recovery proof did not hold', {
      add: add.status,
      byB: byB.status,
      remove: remove.status,
      byA: byA.status,
    });
  }
  process.exit(ok ? 0 : 1);
}

void main();
