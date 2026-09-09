// verify.mjs. Run with: node verify.mjs
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import { referenceCheckAuth } from '@soropass/core';
import { xdr } from '@stellar/stellar-sdk';

const NETWORK = 'Test SDF Network ; September 2015';

// 1. CREATE a passkey and deploy its smart account (in-memory, no browser).
const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
const account = await kit.createPasskey({ userName: 'alice' });
console.log('account:', account.contractId, '| key bytes:', account.publicKey.length);

// 2. SIGN a ready-made demo authorization entry with the passkey.
const signedXdr = await kit.signAuthEntry(sampleAuthEntry(account.contractId));

// 3. VERIFY the signature is accepted by __check_auth, and a wrong key is not.
const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64');
console.log(
  referenceCheckAuth(signed, account.publicKey, NETWORK).success
    ? 'PASS: create + sign verified'
    : 'FAIL',
);

const other = await createPasskeyKit({
  mode: 'mock',
  rpId: 'example.com',
  seed: 'other',
}).createPasskey();
console.log(
  !referenceCheckAuth(signed, other.publicKey, NETWORK).success
    ? 'OK: wrong key rejected'
    : 'UNEXPECTED: wrong key accepted',
);
