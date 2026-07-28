/**
 * LIVE testnet proof of remove_signer against passkey-kit v1 (audited): deploy a
 * smart-wallet with passkey A, add passkey B, then REMOVE B — all authorized by A,
 * all persisted. Closes the on-chain coverage for removeSigner.
 *
 * Run: pnpm --filter @soropass/core exec tsx scripts/remove-signer-e2e.ts
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
import { addSigner, buildSecp256r1Signer, removeSigner } from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const V1_WASM_HASH = '84924c53a413318df2ce753e30de53ec651404c916d30e861718ad155c94b319';
const RP_ID = 'passkey.localhost';
const server = new rpc.Server(RPC_URL);
const rand = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const expert = (h: string): string => `https://stellar.expert/explorer/testnet/tx/${h}`;
const cat = (...a: Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of a) {
    o.set(x, i);
    i += x.length;
  }
  return o;
};

function makeSigner(priv: Uint8Array, credId: Uint8Array): WebAuthnSigner {
  return (challenge: string): AssertionResult => {
    const authenticatorData = cat(
      sha256(new TextEncoder().encode(RP_ID)),
      Uint8Array.of(0x05),
      Uint8Array.of(0, 0, 0, 1),
    );
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: `https://${RP_ID}` }),
    );
    const payload = sha256(cat(authenticatorData, sha256(clientDataJSON)));
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

async function main(): Promise<void> {
  const source = Keypair.random();
  console.log(`source ${source.publicKey()} — funding…`);
  await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(source.publicKey())}`);

  const privA = p256.utils.randomPrivateKey();
  const pubA = p256.getPublicKey(privA, false);
  const credA = rand(16);
  const signA = makeSigner(privA, credA);

  // Deploy v1 wallet with passkey A.
  const salt = rand(32);
  const walletId = deployedContractId(source.publicKey(), salt);
  const acct = await server.getAccount(source.publicKey());
  const deployTx = new TransactionBuilder(acct, { fee: '10000000', networkPassphrase: NETWORK })
    .addOperation(
      Operation.createCustomContract({
        address: Address.fromString(source.publicKey()),
        wasmHash: Buffer.from(V1_WASM_HASH, 'hex'),
        salt: Buffer.from(salt),
        constructorArgs: [buildSecp256r1Signer({ credentialId: credA, publicKey: pubA })],
      }),
    )
    .setTimeout(120)
    .build();
  const dsim = await server.simulateTransaction(deployTx);
  if (!rpc.Api.isSimulationSuccess(dsim)) throw new Error('deploy sim failed');
  const dprep = rpc.assembleTransaction(deployTx, dsim).build();
  dprep.sign(source);
  const dsent = await server.sendTransaction(dprep);
  await server.pollTransaction(dsent.hash, { attempts: 30 });
  console.log(`deployed wallet ${walletId}`);

  // Passkey B.
  const credB = rand(16);
  const pubB = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const wiring = {
    walletContractId: walletId,
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: source.secret(),
    sign: signA,
    signatureExpirationLedgerOffset: 100,
  };

  const added = await addSigner({ ...wiring, newSigner: { credentialId: credB, publicKey: pubB } });
  if (added.status !== 'SUCCESS') throw new Error(`add_signer failed: ${JSON.stringify(added)}`);
  console.log(`1. add_signer B: SUCCESS`);

  const removed = await removeSigner({ ...wiring, credentialId: credB });
  if (removed.status !== 'SUCCESS')
    throw new Error(`remove_signer failed: ${JSON.stringify(removed)}`);
  console.log(`2. remove_signer B: SUCCESS`);

  console.log(`\n✅ remove_signer PROVEN against passkey-kit v1 on testnet`);
  console.log(`   wallet:        https://stellar.expert/explorer/testnet/contract/${walletId}`);
  console.log(`   add_signer:    ${expert(added.hash)}`);
  console.log(`   remove_signer: ${expert(removed.hash)}`);
  process.exit(0);
}

void main();
