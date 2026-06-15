/**
 * Live testnet ceremony for the landing demo — a REAL passkey-authorized XLM
 * transfer. Ephemeral friendbot-funded source → real WebAuthn create → factory
 * deploys a smart account → fund it → the passkey authorizes a real XLM transfer
 * to a freshly-created destination via the native SAC. A wrong key is rejected
 * on-chain. Proven headlessly by packages/core/scripts/transfer-e2e.ts.
 */
import {
  rpc,
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
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
const FACTORY_ID = 'CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM';
const SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'; // native XLM SAC (testnet)
const FUND_STROOPS = 1_000_000_000n; // 100 XLM into the new wallet
export const TRANSFER_XLM = 25;
const TRANSFER_STROOPS = 250_000_000n; // 25 XLM passkey-transferred out
export const EXPLORER = 'https://stellar.expert/explorer/testnet';
export const rpId = globalThis.location.hostname || 'localhost';

const server = new rpc.Server(RPC_URL);
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const addr = (s: string) => Address.fromString(s).toScVal();

export type DemoEvent =
  | { kind: 'passkey' }
  | { kind: 'deployed'; account: string; tx: string }
  | { kind: 'dest'; account: string }
  | { kind: 'funded'; tx: string }
  | { kind: 'transferred'; status: 'SUCCESS' | 'FAILED'; tx: string };
export type OnEvent = (e: DemoEvent) => void;

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

async function ensureSource(): Promise<Keypair> {
  const secret = sessionStorage.getItem('soropass-source');
  const kp = secret ? Keypair.fromSecret(secret) : Keypair.random();
  if (!secret) sessionStorage.setItem('soropass-source', kp.secret());
  try {
    await server.getAccount(kp.publicKey());
  } catch {
    await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(kp.publicKey())}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return kp;
}

/** A fresh, friendbot-funded destination account (the "newly created account"). */
async function ensureDest(): Promise<string> {
  const stored = sessionStorage.getItem('soropass-dest');
  if (stored) return stored;
  const dest = Keypair.random();
  sessionStorage.setItem('soropass-dest', dest.publicKey());
  await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(dest.publicKey())}`);
  await new Promise((r) => setTimeout(r, 1500));
  return dest.publicKey();
}

export function destAddress(): string | null {
  return sessionStorage.getItem('soropass-dest');
}

async function sourceTransfer(source: Keypair, to: string, stroops: bigint): Promise<string> {
  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(SAC).call('transfer', addr(source.publicKey()), addr(to), i128(stroops)))
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error('fund simulation failed');
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const res = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(prepared.toXDR());
  return res.hash;
}

/** Real passkey create → factory deploy → fund the new wallet (+ prepare a destination). */
export async function createWalletOnchain(
  userName: string,
  report: { deploying: () => void },
  onEvent: OnEvent,
): Promise<OnchainWallet> {
  const source = await ensureSource();
  const auth = browserWebAuthnClient();
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const reg = await auth.create(buildCreateOptions({ rpId, rpName: 'Soropass Demo', userName, challenge }));
  onEvent({ kind: 'passkey' });
  const publicKey = extractPublicKeyFromAttestationObject(reg.attestationObject);
  report.deploying();
  const { contractId, txHash } = await factoryDeployer({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK,
    factoryContractId: FACTORY_ID,
    sourceSecret: source.secret(),
  }).deploy({ publicKey, credentialId: reg.id });
  onEvent({ kind: 'deployed', account: contractId, tx: txHash ?? '' });
  const dest = await ensureDest();
  onEvent({ kind: 'dest', account: dest });
  const fundTx = await sourceTransfer(source, contractId, FUND_STROOPS);
  onEvent({ kind: 'funded', tx: fundTx });
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

/** Build the passkey-authorized SAC transfer (wallet → destination). */
export async function buildSignedTransfer(wallet: OnchainWallet, wrongKey: boolean): Promise<string> {
  const source = await ensureSource();
  const dest = await ensureDest();
  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: '2000000', networkPassphrase: NETWORK })
    .addOperation(new Contract(SAC).call('transfer', addr(wallet.contractId), addr(dest), i128(TRANSFER_STROOPS)))
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error('transfer simulation failed');
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
  const signer: WebAuthnSigner = wrongKey
    ? softwareSigner()
    : browserPasskeySigner({ rpId, allowCredentials: [wallet.credentialId] });
  const signedAuthXdr = await signTransaction(envelope.toXDR('base64'), { networkPassphrase: NETWORK, sign: signer });
  const finalTx = TransactionBuilder.fromXDR(signedAuthXdr, NETWORK);
  finalTx.sign(source);
  return finalTx.toXDR();
}

export async function submitTransfer(
  signedXdr: string,
  onEvent: OnEvent,
): Promise<{ status: 'SUCCESS' | 'PENDING' | 'FAILED'; hash: string }> {
  const res = await directSubmission({ rpcUrl: RPC_URL, networkPassphrase: NETWORK }).send(signedXdr);
  onEvent({ kind: 'transferred', status: res.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED', tx: res.hash });
  return { status: res.status, hash: res.hash };
}
