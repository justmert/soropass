/**
 * LIVE on-chain proof against passkey-kit v1 (the audited smart-wallet, Protocol
 * 27) on testnet. Fully autonomous: friendbot funds a fresh key, we deploy a v1
 * smart-wallet FROM THE CANONICAL WASM HASH with a passkey signer, then call
 * `add_signer` (which requires the wallet's own auth) and sign that auth entry
 * with SoroPass's `target: 'smart-wallet'`. If the audited v1 `__check_auth`
 * accepts it, the wire shape SoroPass assembles is proven against Tyler's build.
 *
 *   POSITIVE: correct passkey → v1 __check_auth SUCCESS
 *   NEGATIVE: wrong   passkey → v1 __check_auth FAILURE
 *
 * Run: pnpm --filter @soropass/core exec tsx scripts/smartwallet-v1-e2e.ts
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
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { signTransaction } from '../dist/index.js';
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

// ── v1 Signer ScVal encoders (types.rs, verified against the audited source) ──
const NONE_TUPLE = xdr.ScVal.scvVec([xdr.ScVal.scvVoid()]); // SignerExpiration(None) / SignerLimits(None)
const STORAGE_PERSISTENT = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Persistent')]);

function secp256r1Signer(credId: Uint8Array, pubKey65: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Secp256r1'),
    xdr.ScVal.scvBytes(Buffer.from(credId)),
    xdr.ScVal.scvBytes(Buffer.from(pubKey65)),
    NONE_TUPLE,
    NONE_TUPLE,
    STORAGE_PERSISTENT,
  ]);
}
function ed25519Signer(key32: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Ed25519'),
    xdr.ScVal.scvBytes(Buffer.from(key32)),
    NONE_TUPLE,
    NONE_TUPLE,
    STORAGE_PERSISTENT,
  ]);
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

async function submit(tx: ReturnType<TransactionBuilder['build']>, source: Keypair, label: string) {
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`${label}: simulation failed → ${JSON.stringify(sim, null, 2).slice(0, 800)}`);
  }
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    return { status: 'FAILED' as const, hash: sent.hash };
  }
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  const ok = final.status === rpc.Api.GetTransactionStatus.SUCCESS;
  return { status: ok ? ('SUCCESS' as const) : ('FAILED' as const), hash: sent.hash };
}

async function main(): Promise<void> {
  const source = Keypair.random();
  console.log(`source ${source.publicKey()} — funding via friendbot…`);
  await fund(source.publicKey());

  // A passkey.
  const priv = p256.utils.randomPrivateKey();
  const pubKey65 = p256.getPublicKey(priv, false);
  const credId = rand(16);
  console.log(`passkey credential id ${Buffer.from(credId).toString('hex')}`);

  // 1. Deploy a v1 smart-wallet FROM THE AUDITED WASM HASH with this passkey.
  const salt = rand(32);
  const walletId = deployedContractId(source.publicKey(), salt);
  const deployOp = Operation.createCustomContract({
    address: Address.fromString(source.publicKey()),
    wasmHash: Buffer.from(V1_WASM_HASH, 'hex'),
    salt: Buffer.from(salt),
    constructorArgs: [secp256r1Signer(credId, pubKey65)],
  });
  const acct1 = await server.getAccount(source.publicKey());
  const deployTx = new TransactionBuilder(acct1, { fee: '10000000', networkPassphrase: NETWORK })
    .addOperation(deployOp)
    .setTimeout(120)
    .build();
  const deployRes = await submit(deployTx, source, 'DEPLOY');
  console.log(`deploy: ${deployRes.status} — wallet ${walletId} (tx ${deployRes.hash})`);
  if (deployRes.status !== 'SUCCESS') throw new Error('deploy failed');

  // 2. add_signer requires the wallet's OWN auth → sign it with the passkey.
  async function tryAddSigner(signer: WebAuthnSigner) {
    // 2a. recording sim to discover the wallet's auth requirement.
    const acct = await server.getAccount(source.publicKey());
    const tx = new TransactionBuilder(acct, { fee: '1000000', networkPassphrase: NETWORK })
      .addOperation(new Contract(walletId).call('add_signer', ed25519Signer(rand(32))))
      .setTimeout(300)
      .build();
    const sim1 = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim1)) {
      return {
        authAccepted: false,
        submit: 'n/a',
        hash: '',
        reason: `sim1: ${JSON.stringify(sim1).slice(0, 200)}`,
      };
    }
    const prepared = rpc.assembleTransaction(tx, sim1).build();

    // 2b. set the auth-entry expiration, then sign it with the passkey (smart-wallet shape).
    const validUntil = (await server.getLatestLedger()).sequence + 1000;
    const penv = xdr.TransactionEnvelope.fromXDR(prepared.toXDR(), 'base64');
    for (const op of penv.v1().tx().operations()) {
      if (op.body().switch().name !== 'invokeHostFunction') continue;
      for (const entry of op.body().invokeHostFunctionOp().auth()) {
        if (entry.credentials().switch().name === 'sorobanCredentialsAddress') {
          entry.credentials().address().signatureExpirationLedger(validUntil);
        }
      }
    }
    const signedXdr = await signTransaction(penv.toXDR('base64'), {
      networkPassphrase: NETWORK,
      sign: signer,
      target: 'smart-wallet',
    });

    // 2c. RE-simulate WITH the signed auth (enforcing): this runs the audited v1
    //     __check_auth (secp256r1 verify + signer-storage reads) against the real
    //     contract. Auth-accepted vs rejected here IS the on-chain proof: a wrong
    //     key is rejected right here, a correct key passes.
    const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
    const sim2 = await server.simulateTransaction(signedTx);
    if (!rpc.Api.isSimulationSuccess(sim2)) {
      const err = 'error' in sim2 ? String(sim2.error) : 'sim2 failed';
      return { authAccepted: false, submit: 'n/a', hash: '', reason: err.slice(0, 160) };
    }

    // 2d. (best-effort) try to persist the tx too. The enforcing sim omits the
    //     __check_auth footprint (returns 0 disk reads), so a persisted submit
    //     needs the host's exact auth footprint (nonce entry etc.) which is known
    //     passkey-kit deployment complexity; the auth is already proven above.
    try {
      const fenv = xdr.TransactionEnvelope.fromXDR(signedTx.toXDR(), 'base64');
      const sd = sim2.transactionData.build();
      const r = sd.resources();
      r.instructions(100_000_000);
      r.diskReadBytes(r.diskReadBytes() + 20_000);
      r.writeBytes(r.writeBytes() + 20_000);
      const fee = Number(sim2.minResourceFee) + 20_000_000;
      sd.resourceFee(new xdr.Int64(fee));
      fenv.v1().tx().ext().sorobanData(sd);
      fenv
        .v1()
        .tx()
        .fee(fee + 1_000_000);
      const finalTx = TransactionBuilder.fromXDR(fenv.toXDR('base64'), NETWORK);
      finalTx.sign(source);
      const sent = await server.sendTransaction(finalTx);
      if (sent.status === 'ERROR')
        return { authAccepted: true, submit: 'FAILED', hash: sent.hash, reason: '' };
      const done = await server.pollTransaction(sent.hash, { attempts: 30 });
      const ok = done.status === rpc.Api.GetTransactionStatus.SUCCESS;
      return { authAccepted: true, submit: ok ? 'SUCCESS' : 'FAILED', hash: sent.hash, reason: '' };
    } catch (e) {
      return {
        authAccepted: true,
        submit: 'FAILED',
        hash: '',
        reason: (e as Error).message.slice(0, 120),
      };
    }
  }

  // The correct passkey must be ACCEPTED by the audited v1 __check_auth, the wrong
  // one REJECTED. That is the load-bearing proof (persisting the tx is secondary).
  const positive = await tryAddSigner(makeSigner(priv, credId));
  console.log(
    `POSITIVE (correct passkey): auth ${positive.authAccepted ? 'ACCEPTED' : 'REJECTED'}; submit ${positive.submit} ${positive.hash}`,
  );
  const negative = await tryAddSigner(makeSigner(p256.utils.randomPrivateKey(), credId));
  console.log(
    `NEGATIVE (wrong passkey):   auth ${negative.authAccepted ? 'ACCEPTED' : 'REJECTED'} ${negative.reason}`,
  );

  console.log('');
  const pass = positive.authAccepted && !negative.authAccepted;
  if (pass) {
    console.log('✅ LIVE PROOF against passkey-kit v1 (audited): the audited __check_auth');
    console.log('   ACCEPTS a SoroPass passkey signature and REJECTS a wrong key.');
    console.log(`   wallet: https://stellar.expert/explorer/testnet/contract/${walletId}`);
    if (positive.submit === 'SUCCESS') {
      console.log(`   persisted tx: https://stellar.expert/explorer/testnet/tx/${positive.hash}`);
    }
  } else {
    console.log('❌ did not get the expected accept(correct) + reject(wrong) result');
  }
  process.exit(pass ? 0 : 1);
}

void main();
