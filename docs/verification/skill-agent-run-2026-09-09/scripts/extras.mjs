// extras.mjs. Agent-assembled from the skill's other documented mock-mode claims (no chain, no browser):
//  (a) `forceHighS: true` "forces a high-S signature to exercise the low-S normalizer, and the result stays PASS";
//  (b) the reconnect story: `kit.connect()` / `kit.recover()` (skill lines 84-87);
//  (c) `seed` makes the mock deterministic; `userName` optional.
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import { referenceCheckAuth, isLowS, parseAuthenticatorData } from '@soropass/core';
import { xdr } from '@stellar/stellar-sdk';
const NETWORK = 'Test SDF Network ; September 2015';

// (a) forceHighS
const hs = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example', seed: 'hs', forceHighS: true });
const acc = await hs.createPasskey({ userName: 'alice' });
const signedXdr = await hs.signAuthEntry(sampleAuthEntry(acc.contractId));
const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64');
const r = referenceCheckAuth(signed, acc.publicKey, NETWORK);
console.log('forceHighS result:', r);
console.log(r.success ? 'PASS: forceHighS still verifies (low-S normalized)' : 'FAIL: forceHighS');

// (b) reconnect story
const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
const account = await kit.createPasskey({ userName: 'alice' });
const back = await kit.connect(); // the account created above, resolved silently
const found = await kit.recover(); // [{ contractId, credentialId }]
console.log('connect():', back, '| equals created:', back && back.contractId === account.contractId && back.credentialId === account.credentialId);
console.log('recover():', found, '| includes created:', found.some((f) => f.contractId === account.contractId));

// (c) determinism + optional userName
const s1 = await createPasskeyKit({ mode: 'mock', rpId: 'example.com', seed: 'det' }).createPasskey();
const s2 = await createPasskeyKit({ mode: 'mock', rpId: 'example.com', seed: 'det' }).createPasskey();
console.log('seed determinism (same contractId, credentialId, key):', s1.contractId === s2.contractId, s1.credentialId === s2.credentialId, Buffer.from(s1.publicKey).equals(Buffer.from(s2.publicKey)));
