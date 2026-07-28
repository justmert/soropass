/**
 * Demo 2 (v1 smart-wallet) — the FULL Tranche 2 run, live in the browser on a
 * passkey-kit v1 smart-wallet (audited, Protocol 27). Nothing is mocked:
 *
 *   create   real WebAuthn → deploy a v1 smart-wallet from the canonical wasm
 *   payment  the wallet sends XLM, authorized by the passkey (sendSmartWalletTx)
 *   wrong    a wrong key is rejected by the on-chain __check_auth
 *   recover  add a SECOND passkey signer on-chain (addSigner)
 *
 * Everything after deploy is driven by @soropass/core. Proven headlessly by
 * packages/core/scripts/demo-run-e2e.ts.
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
import {
  browserWebAuthnClient,
  buildCreateOptions,
  extractPublicKeyFromAttestationObject,
} from '@soropass/core/create';
import {
  browserPasskeySigner,
  buildSecp256r1Signer,
  decodeChallenge,
  sendSmartWalletTx,
} from '@soropass/core/sign';
import { addSigner, recover } from '@soropass/core/recover';
import { smartWalletV1Indexer } from '@soropass/core';
import type { AssertionResult, SubmitResult, WebAuthnSigner } from '@soropass/core/types';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK = Networks.TESTNET;
const V1_WASM_HASH = '84924c53a413318df2ce753e30de53ec651404c916d30e861718ad155c94b319';
const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const XLM = 10_000_000n;

export const EXPLORER = 'https://stellar.expert/explorer/testnet';
export const rpId = globalThis.location.hostname || 'localhost';

const server = new rpc.Server(RPC_URL);
export type Log = (msg: string) => void;

export interface V1Wallet {
  contractId: string;
  credentialId: string;
  publicKey: Uint8Array;
  deployTx: string;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/** A per-session friendbot-funded source that sponsors fees (holds no value). */
async function ensureSource(log: Log): Promise<Keypair> {
  const stored = sessionStorage.getItem('soropass-demo-source');
  const kp = stored ? Keypair.fromSecret(stored) : Keypair.random();
  if (!stored) sessionStorage.setItem('soropass-demo-source', kp.secret());
  try {
    await server.getAccount(kp.publicKey());
  } catch {
    log(`funding source ${kp.publicKey().slice(0, 6)}… via friendbot`);
    await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(kp.publicKey())}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return kp;
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

/** Submit a source-signed tx (deploy / self-authorized SAC transfer). */
async function submitClassic(op: xdr.Operation, source: Keypair, fee: string): Promise<string> {
  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee, networkPassphrase: NETWORK })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error('simulation failed');
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error('submit ERROR');
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(String(final.status));
  return sent.hash;
}

/** A wrong-key signer: the wallet's real credential id, but a random private key
 *  → the stored signer's pubkey fails secp256r1_verify on-chain. */
function softwareSigner(credentialIdRaw: Uint8Array): WebAuthnSigner {
  const priv = p256.utils.randomPrivateKey();
  return (challenge: string): AssertionResult => {
    const authenticatorData = concat(
      sha256(new TextEncoder().encode(rpId)),
      Uint8Array.of(0x05),
      Uint8Array.of(0, 0, 0, 1),
    );
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: globalThis.location.origin }),
    );
    const payload = sha256(concat(authenticatorData, sha256(clientDataJSON)));
    return {
      authenticatorData,
      clientDataJSON,
      signature: p256.sign(payload, priv).toDERRawBytes(),
      credentialId: credentialIdRaw,
    };
  };
}

/** Real WebAuthn create → deploy a v1 smart-wallet, then fund it. */
export async function createWalletV1(
  userName: string,
  report: { deploying: () => void },
  log: Log,
): Promise<V1Wallet> {
  const source = await ensureSource(log);
  log('Touch ID / Windows Hello: creating a passkey…');
  const reg = await browserWebAuthnClient().create(
    buildCreateOptions({
      rpId,
      rpName: 'Soropass Demo',
      userName,
      challenge: crypto.getRandomValues(new Uint8Array(32)),
    }),
  );
  const publicKey = extractPublicKeyFromAttestationObject(reg.attestationObject);
  const credId = decodeChallenge(reg.id);

  report.deploying();
  log('deploying a v1 smart-wallet from the audited wasm…');
  // Deterministic salt = sha256(rawCredentialId) — the passkey-kit v1 scheme — so
  // the address derives offline and the wallet is discoverable via the indexer.
  const salt = sha256(credId);
  const walletId = deployedContractId(source.publicKey(), salt);
  const deployTx = await submitClassic(
    Operation.createCustomContract({
      address: Address.fromString(source.publicKey()),
      wasmHash: Buffer.from(V1_WASM_HASH, 'hex'),
      salt: Buffer.from(salt),
      constructorArgs: [buildSecp256r1Signer({ credentialId: credId, publicKey })],
    }),
    source,
    '10000000',
  );
  log(`wallet deployed: ${walletId}`);

  log('funding the wallet (50 XLM)…');
  await submitClassic(sacTransfer(source.publicKey(), walletId, 50n * XLM), source, '2000000');

  return { contractId: walletId, credentialId: reg.id, publicKey, deployTx };
}

/** Passkey-signed payment: the wallet sends 5 XLM to its sponsor, authorized by
 *  the passkey (or a wrong key, which the on-chain __check_auth rejects). */
export async function payFromWalletV1(
  wallet: V1Wallet,
  wrongKey: boolean,
  log: Log,
): Promise<SubmitResult> {
  const source = await ensureSource(log);
  const sign: WebAuthnSigner = wrongKey
    ? softwareSigner(decodeChallenge(wallet.credentialId))
    : browserPasskeySigner({ rpId, allowCredentials: [wallet.credentialId] });
  log(wrongKey ? 'signing the payment with a WRONG key…' : 'Touch ID / Windows Hello: signing…');
  try {
    const result = await sendSmartWalletTx({
      operation: sacTransfer(wallet.contractId, source.publicKey(), 5n * XLM),
      networkPassphrase: NETWORK,
      rpcUrl: RPC_URL,
      sourceSecret: source.secret(),
      sign,
      signatureExpirationLedgerOffset: 100,
    });
    log(`payment → ${result.status} (tx ${result.hash.slice(0, 10)}…)`);
    return result;
  } catch (e) {
    // The enforcing re-simulation runs __check_auth: a wrong key is rejected here.
    log(`payment REJECTED on-chain: ${(e as Error).message.slice(0, 80)}`);
    return { status: 'FAILED', hash: '' };
  }
}

/** Add a second passkey signer on-chain (multi-device recovery), authorized by
 *  the first device. Registers a fresh passkey, then addSigner. */
export async function addSecondDeviceV1(
  wallet: V1Wallet,
  report: { binding: () => void },
  log: Log,
): Promise<{ result: SubmitResult; signer: string }> {
  const source = await ensureSource(log);
  log('Touch ID / Windows Hello: registering a backup passkey…');
  const reg = await browserWebAuthnClient().create(
    buildCreateOptions({
      rpId,
      rpName: 'Soropass Demo',
      userName: 'backup',
      challenge: crypto.getRandomValues(new Uint8Array(32)),
    }),
  );
  const publicKey = extractPublicKeyFromAttestationObject(reg.attestationObject);

  report.binding();
  log('adding the backup signer on-chain (authorized by your first passkey)…');
  const result = await addSigner({
    walletContractId: wallet.contractId,
    newSigner: { credentialId: reg.id, publicKey },
    networkPassphrase: NETWORK,
    rpcUrl: RPC_URL,
    sourceSecret: source.secret(),
    sign: browserPasskeySigner({ rpId, allowCredentials: [wallet.credentialId] }),
    signatureExpirationLedgerOffset: 100,
  });
  log(`add-signer → ${result.status} (tx ${result.hash.slice(0, 10)}…)`);
  return { result, signer: reg.id };
}

/** Cold recovery: a discoverable passkey get() → resolve the wallet(s) it controls
 *  via the v1 events indexer. Proves a second (or returning) device can find the
 *  account from the passkey alone — no stored state. */
export async function recoverWalletV1(
  log: Log,
): Promise<{ contractId: string; credentialId: string }[]> {
  log('discoverable passkey → resolving your wallet on-chain via the v1 indexer…');
  const results = await recover({
    rpId,
    indexer: smartWalletV1Indexer({ rpcUrl: RPC_URL }),
    webauthn: browserWebAuthnClient(),
  });
  log(
    results.length
      ? `recovered ${String(results.length)} wallet(s): ${results.map((r) => r.contractId.slice(0, 8)).join(', ')}…`
      : 'no wallet found on-chain for this passkey',
  );
  return results;
}
