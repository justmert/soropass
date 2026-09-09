// recover-v2.mjs. SECOND ATTEMPT. Same as recover.mjs except the add_signer signing now stamps
// `signatureExpirationLedger: validUntil` (step 2 of the skill's payment recipe); the first attempt, which
// followed the add_signer snippet verbatim (no stamp), failed at re-simulation with "signature has expired" (0).
// Original header follows.
// recover.mjs. The skill's "Native recovery on the v0.2 account" recipe (add device B by A), then
// "B signs alone" (the payment recipe signed by B), then a NON-enrolled device C attempting the same.
// DEVIATIONS: registerPasskey/browserPasskeySigner need a browser; the WebAuthn client + signer for each
// device is a mockAuthenticator (different seeds) from @soropass/core/testing, which the skill does not document.
// TS annotations dropped for .mjs. `signer_count()` reads are agent-added, simulate-only, for the record.
import { readFileSync, writeFileSync } from 'node:fs';
import { registerPasskey, signTransaction, isKitError } from '@soropass/core';
import { mockAuthenticator } from '@soropass/core/testing';
import { Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

const hex = (u8) => Buffer.from(u8).toString('hex');
const { secret: sourceSecret } = JSON.parse(readFileSync('sponsor.json', 'utf8'));
const account = JSON.parse(readFileSync('account.json', 'utf8'));
const rpId = account.rpId;
const authA = mockAuthenticator({ rpId, seed: account.seed }); // the enrolled device
const authB = mockAuthenticator({ rpId, seed: 'skill-agent-2026-09-09-device-B' }); // the new device
const authC = mockAuthenticator({ rpId, seed: 'skill-agent-2026-09-09-device-C' }); // never enrolled

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const sponsor = Keypair.fromSecret(sourceSecret);
const SAC = Asset.native().contractId(Networks.TESTNET);
const addr = (a) => nativeToScVal(a, { type: 'address' });
const destination = sponsor.publicKey();
const out = {};

async function signerCount() {
  const src = await server.getAccount(sponsor.publicKey());
  const t = new TransactionBuilder(src, { fee: '1000000', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(account.contractId).call('signer_count')).setTimeout(120).build();
  const sim = await server.simulateTransaction(t);
  return scValToNative(sim.result.retval);
}
console.log('signer_count before:', await signerCount());

// New device: register a passkey (no deploy), producing { credentialId, publicKey }.
const device2 = await registerPasskey({ rpId, rpName: 'Skill Agent', userName: 'alice', webauthn: authB });
console.log('device2.credentialId:', device2.credentialId, '| publicKey:', hex(device2.publicKey), '| equals authB key:', hex(device2.publicKey) === hex(authB.publicKey));

// Build + simulate the account-authorized add_signer invocation:
{
  const source = await server.getAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(account.contractId).call('add_signer', nativeToScVal(device2.publicKey, { type: 'bytes' })))
    .setTimeout(120)
    .build();
  const assembled = await server.prepareTransaction(tx);
  // Root-cause print (agent-added, best effort, never blocks the flow): what expiration does the
  // recording simulation put on the auth entry?
  try {
    const env = xdr.TransactionEnvelope.fromXDR(assembled.toXDR(), 'base64');
    for (const op of env.value().tx().operations()) {
      const inner = op.body().value();
      if (!inner || typeof inner.auth !== 'function') continue;
      for (const e of inner.auth()) {
        const c = e.credentials(); const v = c.value(); const arm = c.switch(); const armName = (arm && arm.name) || String(arm);
        console.log('auth entry from first prepareTransaction: credentials arm =', armName, '| signatureExpirationLedger =', typeof v?.signatureExpirationLedger === 'function' ? v.signatureExpirationLedger() : '(n/a)');
      }
    }
  } catch (e) { console.log('diagnostic print skipped:', e.message); }
  // The EXISTING enrolled device signs the account's auth entry. FIX vs the skill's add_signer snippet:
  // stamp the expiration exactly as the payment recipe's step 2 does.
  const validUntil = (await server.getLatestLedger()).sequence + 100;
  const signedXdr = await signTransaction(assembled.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    sign: (c) => authA.sign(c),
    publicKey: authA.publicKey,
    signatureExpirationLedger: validUntil,
  });
  // Steps 3 and 4 of the payment recipe, unchanged:
  const prepared = await server.prepareTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
  prepared.sign(sponsor);
  const sent = await server.sendTransaction(prepared);
  console.log('add_signer sendTransaction:', { status: sent.status, hash: sent.hash });
  const result = await server.pollTransaction(sent.hash);
  console.log('add_signer pollTransaction status:', result.status, '| ledger:', result.ledger);
  out.addSignerTxHash = sent.hash; out.addSignerStatus = result.status;
}
console.log('signer_count after add_signer:', await signerCount());

// Device B signs alone: the payment recipe, signed by B (1 XLM to destination).
async function paymentSignedBy(auth, label) {
  const source = await server.getAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(SAC).call('transfer', addr(account.contractId), addr(destination), nativeToScVal(10_000_000n, { type: 'i128' })))
    .setTimeout(120)
    .build();
  const assembled = await server.prepareTransaction(tx);
  const validUntil = (await server.getLatestLedger()).sequence + 100;
  const signedXdr = await signTransaction(assembled.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    sign: (c) => auth.sign(c),
    publicKey: auth.publicKey,
    signatureExpirationLedger: validUntil,
  });
  const prepared = await server.prepareTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
  prepared.sign(sponsor);
  const sent = await server.sendTransaction(prepared);
  console.log(label, 'sendTransaction:', { status: sent.status, hash: sent.hash });
  const result = await server.pollTransaction(sent.hash);
  console.log(label, 'pollTransaction status:', result.status, '| ledger:', result.ledger);
  return { hash: sent.hash, status: result.status };
}
const b = await paymentSignedBy(authB, 'payment signed by device B');
out.paymentByBTxHash = b.hash; out.paymentByBStatus = b.status;

// A never-enrolled device C tries the same. Expected: rejected.
try {
  const c = await paymentSignedBy(authC, 'payment signed by device C (not enrolled)');
  out.paymentByC = c;
  console.log('UNEXPECTED: non-enrolled device C payment status', c.status);
} catch (err) {
  out.paymentByCError = { isKitError: isKitError(err), code: err.code, name: err.name, message: String(err.message).slice(0, 2000) };
  console.log('OK: non-enrolled device C rejected. isKitError:', isKitError(err), '| code:', err.code, '| name:', err.name);
  console.log('error message:', String(err.message).slice(0, 2000));
}
console.log('signer_count at end:', await signerCount());
writeFileSync('recover-txs.json', JSON.stringify(out, null, 2));
console.log('wrote recover-txs.json');
