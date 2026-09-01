/**
 * EMPIRICAL probe of the DEPLOYED v0.13.0 smart-wallet (wasm 84924c53) on testnet:
 * (1) deploy with a DETERMINISTIC salt = sha256(rawCredentialId) so the address is
 *     offline-derivable, and confirm the derivation matches; (2) add a second
 *     signer; (3) getEvents on the wallet and DUMP the real topic/data shape — so
 *     we build the v1 indexer from what the chain actually emits (the cloned
 *     reference is v0.12.0 with a different event scheme).
 *
 * Run: pnpm --filter @soropass/core exec tsx scripts/v1-events-probe.ts
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
  scValToNative,
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
const server = new rpc.Server(RPC_URL);
const rand = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
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

/** Soroban createCustomContract address from a deployer address + salt. */
function deriveContractId(deployer: string, salt: Uint8Array): string {
  const pre = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: Buffer.from(hash(Buffer.from(NETWORK))),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(deployer).toScAddress(),
          salt: Buffer.from(salt),
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(pre.toXDR()));
}

function describe(sv: xdr.ScVal): string {
  let native = '';
  try {
    const n = scValToNative(sv);
    native =
      n instanceof Uint8Array
        ? `bytes(${hex(n)})`
        : typeof n === 'object'
          ? JSON.stringify(n)
          : String(n);
  } catch {
    native = '(undecodable)';
  }
  return `${sv.type} → ${native}`;
}

async function main(): Promise<void> {
  const deployer = Keypair.random();
  console.log(`deployer ${deployer.publicKey()} — funding…`);
  await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(deployer.publicKey())}`);
  await new Promise((r) => setTimeout(r, 1500));

  const privA = p256.utils.randomPrivateKey();
  const pubA = p256.getPublicKey(privA, false);
  const credA = rand(16);

  // DETERMINISTIC salt = sha256(raw credential id) — passkey-kit scheme.
  const salt = sha256(credA);
  const walletId = deriveContractId(deployer.publicKey(), salt);
  console.log(`\ncredA = ${hex(credA)}`);
  console.log(`derived (offline) wallet id: ${walletId}`);

  const startLedger = (await server.getLatestLedger()).sequence;

  // Deploy with the deterministic salt.
  const acct = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(acct, { fee: '10000000', networkPassphrase: NETWORK })
    .addOperation(
      Operation.createCustomContract({
        address: Address.fromString(deployer.publicKey()),
        wasmHash: Buffer.from(V1_WASM_HASH, 'hex'),
        salt: Buffer.from(salt),
        constructorArgs: [buildSecp256r1Signer({ credentialId: credA, publicKey: pubA })],
      }),
    )
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error('deploy sim failed');
  const prep = rpc.assembleTransaction(tx, sim).build();
  prep.sign(deployer);
  const sent = await server.sendTransaction(prep);
  const fin = await server.pollTransaction(sent.hash, { attempts: 30 });
  const deployedId =
    (fin as { returnValue?: xdr.ScVal }).returnValue &&
    scValToNative((fin as { returnValue: xdr.ScVal }).returnValue);
  console.log(`deployed. returnValue address: ${String(deployedId)}`);
  console.log(
    `OFFLINE DERIVATION MATCHES DEPLOYED? ${String(deployedId) === walletId ? 'YES ✓' : 'NO ✗'}`,
  );

  // Add a SECOND signer B.
  const credB = rand(16);
  const pubB = p256.getPublicKey(p256.utils.randomPrivateKey(), false);
  console.log(`\ncredB = ${hex(credB)} — adding as second signer…`);
  const added = await addSigner({
    walletContractId: walletId,
    newSigner: { credentialId: credB, publicKey: pubB },
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: deployer.secret(),
    sign: makeSigner(privA, credA),
    signatureExpirationLedgerOffset: 100,
  });
  console.log(`add_signer B: ${added.status}`);

  // DUMP the real events emitted by this wallet.
  console.log(`\n=== getEvents on ${walletId} from ledger ${startLedger} ===`);
  const resp = await server.getEvents({
    startLedger,
    filters: [{ type: 'contract', contractIds: [walletId] }],
  });
  console.log(`event count: ${resp.events.length}\n`);
  for (const [i, ev] of resp.events.entries()) {
    console.log(`--- event #${i} (type=${ev.type}) ---`);
    (ev.topic ?? []).forEach((t, j) => console.log(`  topic[${j}]: ${describe(t)}`));
    console.log(`  value:    ${describe(ev.value)}`);
    // Highlight which credential id appears (founding vs added).
    const blob = [ev.value, ...(ev.topic ?? [])].map((v) => v.toXDR('hex')).join('|');
    const which = blob.includes(hex(credA))
      ? 'credA'
      : blob.includes(hex(credB))
        ? 'credB'
        : '(none)';
    console.log(`  contains credential: ${which}\n`);
  }
  process.exit(0);
}

void main();
