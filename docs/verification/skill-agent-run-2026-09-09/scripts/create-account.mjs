// create-account.mjs. Agent-written from the skill's "Create a passkey account in the browser" recipe.
// DEVIATION: the skill's recipe uses browserWebAuthnClient() (a browser). No browser here, so the WebAuthn
// client is `mockAuthenticator` from @soropass/core/testing, which the PACKAGE type declarations export as a
// WebAuthnClient, and which the skill file does NOT document. Everything else follows the skill.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createPasskey,
  factoryDeployer,
  deriveAccountAddress,
  DEFAULT_ACCOUNT_FACTORIES,
  parseAuthenticatorData,
} from '@soropass/core';
import { mockAuthenticator } from '@soropass/core/testing';
import { Networks } from '@stellar/stellar-sdk';

const hex = (u8) => Buffer.from(u8).toString('hex');
const { secret: sourceSecret, publicKey: sponsorPk } = JSON.parse(readFileSync('sponsor.json', 'utf8'));
console.log('sponsor:', sponsorPk);
console.log('DEFAULT_ACCOUNT_FACTORIES:', DEFAULT_ACCOUNT_FACTORIES);

const rpId = 'example.com';
const seed = 'skill-agent-2026-09-09-device-A';
const auth = mockAuthenticator({ rpId, seed });
console.log('mock authenticator credentialId:', auth.credentialId);
console.log('mock authenticator publicKey (hex):', hex(auth.publicKey));

// Wrap the skill's factoryDeployer only to capture the deploy tx hash (createPasskey does not return it).
const inner = factoryDeployer({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET, // selects the deployed factory for this network
  sourceSecret, // a funded G-account secret that pays the deploy fee
});
let deployTxHash;
const deployer = {
  async deploy(input) {
    const r = await inner.deploy(input);
    deployTxHash = r.txHash;
    console.log('factoryDeployer.deploy result:', r);
    return r;
  },
};

const t0 = Date.now();
const account = await createPasskey({
  rpId,
  rpName: 'Skill Agent',
  userName: 'alice',
  deployer,
  webauthn: auth,
});
console.log('createPasskey took ms:', Date.now() - t0);
console.log('account.contractId:', account.contractId);
console.log('account.credentialId:', account.credentialId);
console.log('account.publicKey bytes:', account.publicKey.length, 'hex:', hex(account.publicKey));

// The skill says: address === account.contractId
const derived = deriveAccountAddress({
  credentialId: new TextEncoder().encode(account.credentialId), // UTF-8 bytes of the base64url id
  publicKey: account.publicKey, // 65-byte SEC-1 key, part of the v0.2 salt
  networkPassphrase: Networks.TESTNET, // selects the deployed factory; factoryContractId overrides
});
console.log('deriveAccountAddress:', derived, '| equals account.contractId:', derived === account.contractId);

// For the record: what flags the mock assertion carries (the skill says the v0.2 account requires UV on-chain).
const probe = auth.sign('AAAA');
console.log('mock assertion flags:', parseAuthenticatorData(probe.authenticatorData).flags, '| assertion.publicKey present:', !!probe.publicKey);

writeFileSync(
  'account.json',
  JSON.stringify(
    { rpId, seed, contractId: account.contractId, credentialId: account.credentialId, publicKeyHex: hex(account.publicKey), deployTxHash, derivedAddress: derived },
    null,
    2,
  ),
);
console.log('wrote account.json');
