/**
 * Demo 2 — REAL testnet on-chain round-trip, in the browser.
 *
 * Ephemeral friendbot-funded source (sponsors fees, no value) → real WebAuthn
 * create → `factoryDeployer` deploys a fresh webauthn-account on testnet → real
 * WebAuthn sign of `protected()` → submit → on-chain `__check_auth`. A wrong-key
 * button signs with a random software key to show the on-chain rejection.
 *
 * The factory + this exact flow are proven headlessly by
 * packages/core/scripts/factory-e2e.ts.
 */
import { rpc, Contract, Keypair, Networks, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import {
  browserWebAuthnClient,
  buildCreateOptions,
  extractPublicKeyFromAttestationObject,
} from '@soropass/core/create';
import { signTransaction, browserPasskeySigner } from '@soropass/core/sign';
import { directSubmission, factoryDeployer } from '@soropass/core';
import type { AssertionResult, WebAuthnSigner } from '@soropass/core/types';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
// AccountFactory deployed to testnet — see contracts/deployments.json.
const FACTORY_ID = 'CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM';
export const EXPLORER = 'https://stellar.expert/explorer/testnet';
export const rpId = globalThis.location.hostname || 'localhost';

const server = new rpc.Server(RPC_URL);
export type Log = (msg: string) => void;

export interface OnchainWallet {
  contractId: string;
  credentialId: string;
  publicKey: Uint8Array;
  deployTx: string;
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

/** A persistent (per-session) friendbot-funded source that sponsors fees. */
async function ensureSource(log: Log): Promise<Keypair> {
  let secret = sessionStorage.getItem('soropass-demo-source');
  const kp = secret ? Keypair.fromSecret(secret) : Keypair.random();
  if (!secret) {
    sessionStorage.setItem('soropass-demo-source', kp.secret());
    secret = kp.secret();
  }
  try {
    await server.getAccount(kp.publicKey());
  } catch {
    log(`funding source ${kp.publicKey().slice(0, 6)}… via friendbot`);
    await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(kp.publicKey())}`);
    // small settle
    await new Promise((r) => setTimeout(r, 1500));
  }
  return kp;
}

/** Real WebAuthn create → factory deploys a fresh smart account on testnet. */
export async function createWalletOnchain(
  userName: string,
  report: { deploying: () => void },
  log: Log,
): Promise<OnchainWallet> {
  const source = await ensureSource(log);
  const auth = browserWebAuthnClient();
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  log('Touch ID / Windows Hello: creating a passkey…');
  const reg = await auth.create(
    buildCreateOptions({ rpId, rpName: 'Soropass Demo', userName, challenge }),
  );
  const publicKey = extractPublicKeyFromAttestationObject(reg.attestationObject);
  report.deploying();
  log('deploying a smart account through the factory…');
  const { contractId, txHash } = await factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: source.secret(),
  }).deploy({ publicKey, credentialId: reg.id });
  log(`account deployed: ${contractId}`);
  return { contractId, credentialId: reg.id, publicKey, deployTx: txHash ?? '' };
}

function softwareSigner(): WebAuthnSigner {
  const priv = p256.utils.randomPrivateKey();
  return (challenge: string): AssertionResult => {
    const rpIdHash = sha256(new TextEncoder().encode(rpId));
    const authenticatorData = concat(rpIdHash, Uint8Array.of(0x05), Uint8Array.of(0, 0, 0, 1));
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: globalThis.location.origin }),
    );
    const payload = sha256(concat(authenticatorData, sha256(clientDataJSON)));
    const der = p256.sign(payload, priv).toDERRawBytes();
    return { authenticatorData, clientDataJSON, signature: der, credentialId: new Uint8Array(16).fill(2) };
  };
}

/**
 * Build a `protected()` call on the wallet, sign its Soroban auth entry (real
 * passkey, or a wrong software key), source-sign, and submit to testnet.
 * Returns the on-chain result.
 */
export async function buildSignedProtected(
  wallet: OnchainWallet,
  wrongKey: boolean,
  log: Log,
): Promise<string> {
  const source = await ensureSource(log);
  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(wallet.contractId).call('protected'))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error('simulation failed');
  const prepared = rpc.assembleTransaction(tx, sim).build();

  // Set a future expiration on each address-credential auth entry, then inflate
  // the budget (simulate skips the expensive secp256r1_verify).
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
    sd.resourceFee(new xdr.Int64(9_000_000));
    v1.fee(10_000_000);
  }

  const signer: WebAuthnSigner = wrongKey
    ? softwareSigner()
    : browserPasskeySigner({ rpId, allowCredentials: [wallet.credentialId] });
  log(wrongKey ? 'signing with a WRONG key (software)…' : 'Touch ID / Windows Hello: signing…');
  const signedAuthXdr = await signTransaction(envelope.toXDR('base64'), {
    networkPassphrase: NETWORK,
    sign: signer,
  });

  const finalTx = TransactionBuilder.fromXDR(signedAuthXdr, NETWORK);
  finalTx.sign(source);
  return finalTx.toXDR();
}

/** Submit a signed tx to testnet and report the on-chain result. */
export async function submitTx(
  signedXdr: string,
  log: Log,
): Promise<{ status: 'SUCCESS' | 'PENDING' | 'FAILED'; hash: string }> {
  log('submitting to testnet…');
  const res = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(signedXdr);
  log(`on-chain __check_auth → ${res.status} (tx ${res.hash.slice(0, 10)}…)`);
  return { status: res.status, hash: res.hash };
}
