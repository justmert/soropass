// pay.mjs. The skill's "A complete payment, end to end", transcribed from its two TS listings.
// DEVIATIONS: (1) `.mjs` is JavaScript, so the TS annotation `(a: string)` became `(a)`;
// (2) browserPasskeySigner(...) needs a browser, so the signer is the same mockAuthenticator (same seed)
//     used at create time: `sign: (c) => auth.sign(c)` plus `publicKey` via SorobanSignOptions.publicKey
//     (the skill documents that option; mockAuthenticator itself is not in the skill);
// (3) `destination` = the sponsor's own G-address ("any funded classic account").
import { readFileSync, writeFileSync } from 'node:fs';
import { signTransaction } from '@soropass/core';
import { mockAuthenticator } from '@soropass/core/testing';
import {
  Asset,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';

const hex = (u8) => Buffer.from(u8).toString('hex');
const { secret: sourceSecret } = JSON.parse(readFileSync('sponsor.json', 'utf8'));
const account = JSON.parse(readFileSync('account.json', 'utf8'));
const auth = mockAuthenticator({ rpId: account.rpId, seed: account.seed });
console.log('re-created mock authenticator matches account key:', hex(auth.publicKey) === account.publicKeyHex, '| credentialId matches:', auth.credentialId === account.credentialId);
const publicKey = auth.publicKey;

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const sponsor = Keypair.fromSecret(sourceSecret);
const SAC = Asset.native().contractId(Networks.TESTNET);
const addr = (a) => nativeToScVal(a, { type: 'address' });
const destination = sponsor.publicKey();
console.log('SAC:', SAC, '| smart account:', account.contractId, '| destination:', destination);

// ---- Funding: sponsor seeds the smart account with a classic SAC transfer (10 XLM) ----
const funding = new TransactionBuilder(await server.getAccount(sponsor.publicKey()), {
  fee: '1000000',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    new Contract(SAC).call(
      'transfer',
      addr(sponsor.publicKey()),
      addr(account.contractId),
      nativeToScVal(100_000_000n, { type: 'i128' }), // 10 XLM
    ),
  )
  .setTimeout(120)
  .build();
const preparedFunding = await server.prepareTransaction(funding);
preparedFunding.sign(sponsor);
const fundingSent = await server.sendTransaction(preparedFunding);
console.log('funding sendTransaction:', { status: fundingSent.status, hash: fundingSent.hash });
const fundingResult = await server.pollTransaction(fundingSent.hash);
console.log('funding pollTransaction status:', fundingResult.status, '| ledger:', fundingResult.ledger);

// ---- Payment: 2.5 XLM FROM the smart account, authorized by the passkey ----
// 1. Build the transfer FROM the smart account, with the sponsor as the transaction source, and simulate.
const source = await server.getAccount(sponsor.publicKey());
const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
  .addOperation(
    new Contract(SAC).call(
      'transfer',
      addr(account.contractId), // from: the smart account
      addr(destination), // to: any funded account
      nativeToScVal(25_000_000n, { type: 'i128' }), // 2.5 XLM in stroops
    ),
  )
  .setTimeout(120)
  .build();
const assembled = await server.prepareTransaction(tx);

// 2. The passkey signs the smart account's authorization entry.
const validUntil = (await server.getLatestLedger()).sequence + 100;
const signedXdr = await signTransaction(assembled.toXDR(), {
  networkPassphrase: Networks.TESTNET,
  sign: (challenge) => auth.sign(challenge),
  publicKey,
  signatureExpirationLedger: validUntil,
});

// 3. Re-simulate with the signed entry so the budget covers secp256r1_verify.
const prepared = await server.prepareTransaction(
  TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET),
);

// 4. The classic source signs the ENVELOPE, then submit and poll.
prepared.sign(sponsor);
const sent = await server.sendTransaction(prepared);
console.log('payment sendTransaction:', { status: sent.status, hash: sent.hash });
const result = await server.pollTransaction(sent.hash);
console.log('payment pollTransaction status:', result.status, '| ledger:', result.ledger);
console.log(result.status === 'SUCCESS' ? 'PASS: passkey-signed payment succeeded on testnet' : 'FAIL: payment status ' + result.status);

writeFileSync(
  'txs.json',
  JSON.stringify({ fundingTxHash: fundingSent.hash, fundingStatus: fundingResult.status, paymentTxHash: sent.hash, paymentStatus: result.status, validUntil }, null, 2),
);
console.log('wrote txs.json');
