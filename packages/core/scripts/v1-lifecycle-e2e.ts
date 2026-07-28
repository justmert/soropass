/**
 * LIVE testnet proof of the full v1 account-lifecycle through the SDK adapters:
 *   1. smartWalletV1Deployer.deploy() → a v1 wallet at a DETERMINISTIC address
 *   2. deriveSmartWalletAddress() (offline) === the deployed address
 *   3. smartWalletV1Indexer.resolveByCredential(founding) → the wallet (recovery)
 *   4. addSigner(second device) → resolveByCredential(second) → the SAME wallet
 * This is what makes connect / recover / getAddress v1-native.
 *
 * Run: pnpm --filter @soropass/core exec tsx scripts/v1-lifecycle-e2e.ts
 */
import { Keypair, Networks, rpc } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import {
  addSigner,
  deriveSmartWalletAddress,
  encodeChallenge,
  smartWalletV1Deployer,
  smartWalletV1Indexer,
} from '../dist/index.js';
import type { AssertionResult, WebAuthnSigner } from '../dist/index.js';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const RP_ID = 'passkey.localhost';
const server = new rpc.Server(RPC_URL);
const rand = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
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

async function resolveWithRetry(
  indexer: { resolveByCredential(id: string): Promise<{ contractId: string }[]> },
  credId: string,
  want: string,
): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    const found = await indexer.resolveByCredential(credId);
    if (found.some((a) => a.contractId === want)) return true;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

async function main(): Promise<void> {
  const deployer = Keypair.random();
  console.log(`deployer ${deployer.publicKey()} — funding…`);
  await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(deployer.publicKey())}`);
  await new Promise((r) => setTimeout(r, 1500));

  const privA = p256.utils.randomPrivateKey();
  const pubA = p256.getPublicKey(privA, false);
  const credA = rand(16);
  const credA64 = encodeChallenge(credA);

  const startLedger = (await server.getLatestLedger()).sequence;

  // 1. Deploy via the SDK deployer.
  const deployerAdapter = smartWalletV1Deployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    deployerSecret: deployer.secret(),
  });
  const { contractId, txHash } = await deployerAdapter.deploy({
    publicKey: pubA,
    credentialId: credA64,
  });
  console.log(`1. deployed v1 wallet: ${contractId} (tx ${txHash})`);

  // 2. Offline derivation must match.
  const derived = deriveSmartWalletAddress({
    deployer: deployer.publicKey(),
    credentialId: credA64,
    networkPassphrase: NETWORK,
  });
  const derivOk = derived === contractId;
  console.log(`2. offline getAddress matches deploy? ${derivOk ? 'YES ✓' : `NO ✗ (${derived})`}`);

  // 3. Indexer resolves the FOUNDING credential → wallet (recovery).
  const indexer = smartWalletV1Indexer({ rpcUrl: RPC_URL, startLedger });
  const foundA = await resolveWithRetry(indexer, credA64, contractId);
  console.log(`3. resolveByCredential(founding) → wallet? ${foundA ? 'YES ✓' : 'NO ✗'}`);

  // 4. Add a second device, then resolve the SECOND credential → same wallet.
  const credB = rand(16);
  const credB64 = encodeChallenge(credB);
  const pubB = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  const add = await addSigner({
    walletContractId: contractId,
    newSigner: { credentialId: credB, publicKey: pubB },
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: deployer.secret(),
    sign: makeSigner(privA, credA),
    signatureExpirationLedgerOffset: 100,
  });
  console.log(`4a. add second device: ${add.status} (tx ${add.hash})`);
  const foundB = await resolveWithRetry(indexer, credB64, contractId);
  console.log(`4b. resolveByCredential(second device) → same wallet? ${foundB ? 'YES ✓' : 'NO ✗'}`);

  const pass = derivOk && foundA && add.status === 'SUCCESS' && foundB;
  console.log(
    `\n${pass ? '✅' : '❌'} v1 ACCOUNT-LIFECYCLE ${pass ? 'PROVEN' : 'INCOMPLETE'} ON TESTNET`,
  );
  console.log(`   wallet: https://stellar.expert/explorer/testnet/contract/${contractId}`);
  process.exit(pass ? 0 : 1);
}

void main();
