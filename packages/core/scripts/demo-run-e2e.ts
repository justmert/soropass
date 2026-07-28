/**
 * LIVE testnet proof of the FULL Tranche 2 D3 demo run on a passkey-kit v1
 * smart-wallet (audited, Protocol 27), all persisted with tx hashes for Expert:
 *
 *   1. create passkey A + deploy a v1 smart-wallet from the canonical wasm
 *   2. fund the wallet (native SAC transfer from the friendbot source)
 *   3. passkey-signed PAYMENT — the wallet sends XLM, authorized by A (sendSmartWalletTx)
 *   4. WRONG-KEY payment is rejected on-chain
 *   5. add a SECOND device (addSigner passkey B) — multi-device recovery
 *
 * Everything after deploy is driven by @soropass/core.
 * Run: pnpm --filter @soropass/core exec tsx scripts/demo-run-e2e.ts
 */
import {
  Address,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { addSigner, buildSecp256r1Signer, sendSmartWalletTx } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const V1_WASM_HASH = '84924c53a413318df2ce753e30de53ec651404c916d30e861718ad155c94b319';
const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const RP_ID = 'passkey.localhost';
const ORIGIN = 'https://passkey.localhost';
const XLM = 10_000_000n; // 1 XLM in stroops

const server = new rpc.Server(RPC_URL);
const rand = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const expert = (h: string): string => `https://stellar.expert/explorer/testnet/tx/${h}`;

function concat(...a: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

async function fund(pub: string): Promise<void> {
  const r = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(pub)}`);
  if (!r.ok && r.status !== 400) throw new Error(`friendbot failed: ${String(r.status)}`);
}

function makeSigner(priv: Uint8Array, credId: Uint8Array): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    const authenticatorData = concat(
      sha256(new TextEncoder().encode(RP_ID)),
      Uint8Array.of(0x05), // UP | UV
      Uint8Array.of(0, 0, 0, 1),
    );
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN }),
    );
    const payload = sha256(concat(authenticatorData, sha256(clientDataJSON)));
    return {
      authenticatorData,
      clientDataJSON,
      signature: p256.sign(payload, priv).toDERRawBytes(),
      credentialId: credId,
    };
  };
}

function deployedContractId(deployerPub: string, salt: Uint8Array): string {
  const pre = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: Buffer.from(hash(Buffer.from(NETWORK))),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(deployerPub).toScAddress(),
          salt: Buffer.from(salt),
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(pre.toXDR()));
}

/** Native SAC `transfer(from, to, amount)` invocation. */
function sacTransfer(from: string, to: string, amount: bigint): xdr.Operation {
  return new Contract(NATIVE_SAC).call(
    'transfer',
    Address.fromString(from).toScVal(),
    Address.fromString(to).toScVal(),
    nativeToScVal(amount, { type: 'i128' }),
  );
}

/** Submit a plain source-signed tx (deploy / self-authorized SAC transfer). */
async function submitClassic(
  op: xdr.Operation,
  source: Keypair,
  fee: string,
  label: string,
): Promise<string> {
  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee, networkPassphrase: NETWORK })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`${label} sim failed → ${JSON.stringify(sim).slice(0, 300)}`);
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error(`${label} submit ERROR`);
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`${label} ${final.status}`);
  }
  return sent.hash;
}

async function main(): Promise<void> {
  const hashes: Record<string, string> = {};
  const source = Keypair.random();
  const dest = Keypair.random();
  console.log(`source ${source.publicKey()} — funding source + destination…`);
  await Promise.all([fund(source.publicKey()), fund(dest.publicKey())]);

  // Passkey A — the wallet's first device.
  const privA = p256.utils.randomPrivateKey();
  const pubA = p256.getPublicKey(privA, false);
  const credA = rand(16);
  const signA = makeSigner(privA, credA);

  // 1. Deploy a v1 smart-wallet from the audited wasm with passkey A.
  const salt = rand(32);
  const walletId = deployedContractId(source.publicKey(), salt);
  const deployOp = Operation.createCustomContract({
    address: Address.fromString(source.publicKey()),
    wasmHash: Buffer.from(V1_WASM_HASH, 'hex'),
    salt: Buffer.from(salt),
    constructorArgs: [buildSecp256r1Signer({ credentialId: credA, publicKey: pubA })],
  });
  hashes.deploy = await submitClassic(deployOp, source, '10000000', 'DEPLOY');
  console.log(`1. deploy: SUCCESS — wallet ${walletId}`);

  // 2. Fund the wallet (source → wallet, 100 XLM via native SAC). from=source is
  //    the tx source, so its require_auth is covered by the source signature.
  hashes.fund = await submitClassic(
    sacTransfer(source.publicKey(), walletId, 100n * XLM),
    source,
    '2000000',
    'FUND',
  );
  console.log(`2. fund wallet: SUCCESS (100 XLM)`);

  // 3. PASSKEY-SIGNED PAYMENT — the wallet sends 10 XLM to dest, authorized by A.
  const pay = await sendSmartWalletTx({
    operation: sacTransfer(walletId, dest.publicKey(), 10n * XLM),
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: source.secret(),
    sign: signA,
    signatureExpirationLedgerOffset: 100,
  });
  if (pay.status !== 'SUCCESS') throw new Error(`payment did not persist: ${JSON.stringify(pay)}`);
  hashes.payment = pay.hash;
  console.log(`3. passkey-signed payment: SUCCESS (10 XLM → dest)`);

  // 4. WRONG-KEY payment must be REJECTED on-chain.
  const wrongPriv = p256.utils.randomPrivateKey();
  let rejected = false;
  try {
    await sendSmartWalletTx({
      operation: sacTransfer(walletId, dest.publicKey(), 10n * XLM),
      networkPassphrase: NETWORK,
      rpcUrl: RPC_URL,
      sourceSecret: source.secret(),
      sign: makeSigner(wrongPriv, credA),
      signatureExpirationLedgerOffset: 100,
    });
  } catch {
    rejected = true; // enforcing sim runs __check_auth → rejects the wrong key
  }
  console.log(`4. wrong-key payment: ${rejected ? 'REJECTED ✓' : 'ACCEPTED ✗ (BUG)'}`);

  // 5. ADD A SECOND DEVICE — enroll passkey B, authorized by A (multi-device recovery).
  const pubB = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const credB = rand(16);
  const add = await addSigner({
    walletContractId: walletId,
    newSigner: { credentialId: credB, publicKey: pubB },
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: source.secret(),
    sign: signA,
    signatureExpirationLedgerOffset: 100,
  });
  if (add.status !== 'SUCCESS')
    throw new Error(`add_signer did not persist: ${JSON.stringify(add)}`);
  hashes.addDevice = add.hash;
  console.log(`5. add second device: SUCCESS`);

  const pass = pay.status === 'SUCCESS' && rejected && add.status === 'SUCCESS';
  console.log(
    `\n${pass ? '✅' : '❌'} FULL v1 SMART-WALLET DEMO RUN ${pass ? 'PROVEN' : 'FAILED'} ON TESTNET`,
  );
  console.log(`   wallet:   https://stellar.expert/explorer/testnet/contract/${walletId}`);
  console.log(`   deploy:   ${expert(hashes.deploy)}`);
  console.log(`   fund:     ${expert(hashes.fund)}`);
  console.log(`   payment:  ${expert(hashes.payment)}`);
  console.log(`   add-dev:  ${expert(hashes.addDevice)}`);
  process.exit(pass ? 0 : 1);
}

void main();
