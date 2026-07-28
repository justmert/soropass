/**
 * LIVE testnet proof of the multi-device recovery ceremony: deploy a passkey-kit
 * v1 smart-wallet (audited, Protocol 27) with passkey A, then use the shipped core
 * `addSigner` ceremony — authorized by A — to enroll a SECOND passkey B on-chain,
 * and PERSIST the transaction. This is the "add-a-second-device runs on testnet
 * (TX on Expert)" proof for Tranche 2 D1, driven entirely by @soropass/core.
 *
 * Run: pnpm --filter @soropass/core exec tsx scripts/add-signer-e2e.ts
 */
import {
  Address,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { addSigner, buildSecp256r1Signer } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const V1_WASM_HASH = '84924c53a413318df2ce753e30de53ec651404c916d30e861718ad155c94b319';
const RP_ID = 'passkey.localhost';
const ORIGIN = 'https://passkey.localhost';

const server = new rpc.Server(RPC_URL);
const rand = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

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

/** A deterministic mock authenticator (existing device A). */
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

async function submitDeploy(tx: ReturnType<TransactionBuilder['build']>, source: Keypair) {
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`deploy sim failed → ${JSON.stringify(sim).slice(0, 400)}`);
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error('deploy submit ERROR');
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS)
    throw new Error(`deploy ${final.status}`);
  return sent.hash;
}

async function main(): Promise<void> {
  const source = Keypair.random();
  console.log(`source ${source.publicKey()} — funding via friendbot…`);
  await fund(source.publicKey());

  // Passkey A — the existing device.
  const privA = p256.utils.randomPrivateKey();
  const pubA = p256.getPublicKey(privA, false);
  const credA = rand(16);

  // 1. Deploy a v1 smart-wallet from the audited wasm hash with passkey A.
  const salt = rand(32);
  const walletId = deployedContractId(source.publicKey(), salt);
  const deployOp = Operation.createCustomContract({
    address: Address.fromString(source.publicKey()),
    wasmHash: Buffer.from(V1_WASM_HASH, 'hex'),
    salt: Buffer.from(salt),
    constructorArgs: [buildSecp256r1Signer({ credentialId: credA, publicKey: pubA })],
  });
  const acct = await server.getAccount(source.publicKey());
  const deployTx = new TransactionBuilder(acct, { fee: '10000000', networkPassphrase: NETWORK })
    .addOperation(deployOp)
    .setTimeout(120)
    .build();
  const deployHash = await submitDeploy(deployTx, source);
  console.log(`deploy: SUCCESS — wallet ${walletId} (tx ${deployHash})`);

  // Passkey B — the NEW device to enroll (only its public key goes on-chain).
  const pubB = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const credB = rand(16);

  // 2. addSigner ceremony: A authorizes enrolling B, submitted + persisted via direct.
  console.log(`enrolling second passkey ${Buffer.from(credB).toString('hex')} via addSigner…`);
  const result = await addSigner({
    walletContractId: walletId,
    newSigner: { credentialId: credB, publicKey: pubB },
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: source.secret(),
    sign: makeSigner(privA, credA),
    signatureExpirationLedgerOffset: 100,
  });

  console.log(`\naddSigner submit: ${result.status} (tx ${result.hash})`);
  if (result.errorResultXdr) console.log(`  errorResultXdr: ${result.errorResultXdr}`);
  if (result.status === 'SUCCESS') {
    console.log('✅ SECOND DEVICE ADDED ON TESTNET via @soropass/core addSigner');
    console.log(`   tx:     https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    console.log(`   wallet: https://stellar.expert/explorer/testnet/contract/${walletId}`);
  } else {
    console.log('❌ add_signer did not persist — inspect errorResultXdr above');
  }
  process.exit(result.status === 'SUCCESS' ? 0 : 1);
}

void main();
