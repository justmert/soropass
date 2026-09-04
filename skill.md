---
name: soropass-sdk
description: Integrates the @soropass/core SDK to add passkey (WebAuthn) smart-account authentication to a Stellar app on Soroban. Use this when you need to create a passkey smart account, derive its contract (C-address), sign Soroban transactions or authorization entries with a passkey, normalize secp256r1 signatures to low-S, recover an account on a second device, mount the drop-in UI screens from @soropass/ui, or register a passkey wallet in stellar-wallets-kit. Includes a no-browser Node path for reproducing create and sign.
---

# SoroPass SDK (`@soropass/core`)

`@soropass/core` is a minimal, headless TypeScript SDK for passkey smart accounts on Stellar. It handles WebAuthn registration, DER-to-compact low-S secp256r1 conversion, the Soroban `__check_auth` authorization-entry wire shape, deterministic C-address derivation, and multi-device recovery. It ships no UI and no framework opinions, and it keeps `@stellar/stellar-sdk` as a peer dependency so it is never bundled twice.

A passkey account is a Soroban contract (a `C...` address). The account's `__check_auth` verifies a WebAuthn secp256r1 assertion on-chain, so a device passkey (Touch ID, Windows Hello, a security key) replaces a seed phrase.

## Install

```bash
npm install @soropass/core "@stellar/stellar-sdk@>=17"
```

`@stellar/stellar-sdk` is a required peer dependency. Install version 17 or newer (the `>=17` peer range): `@soropass/core@0.3.1` builds against the stellar-sdk 17 XDR API, so a plain `npm install @stellar/stellar-sdk` (which resolves to 17) is correct. On stellar-sdk 16 or older the create+sign example throws a `TypeError`; for those versions install `@soropass/core@0.2.1`, noting that 0.2.1 signs only classic address credentials, while 0.3.x also signs the `addressV2` credentials that Protocol 23 networks (testnet today) return from simulation. These examples are verified against `@soropass/core@0.3.1` with `@stellar/stellar-sdk` 17 on Node 20+. `@soropass/core` publishes ESM, CommonJS, and type declarations.

Version note. `npm install @soropass/core` installs `0.3.1`, the published `latest`. In 0.3.x: `@stellar/stellar-sdk` 17 or newer is required, `deriveAccountAddress` and single-signer signing require the signer's 65-byte SEC-1 `publicKey` (the deploy salt and the signature struct both bind it), `userVerification` defaults to `'required'`, and the account contract is multi-signer with native `add_signer` / `remove_signer` recovery. Since 0.3.1, `factoryContractId` is optional everywhere it appears: it defaults to the SoroPass-deployed `AccountFactory` for the network (`DEFAULT_ACCOUNT_FACTORIES` exports the map), and an explicit id overrides the default. The account contract is versioned separately from the npm package: `v0.2 account` in this guide names the deployed `webauthn-account` contract version, and the 0.3.x package targets exactly those v0.2 contracts (the 0.3.x changes are client-side only).

Two guarantees the SDK enforces so you do not have to:

- Registration is ES256 only (secp256r1, COSE algorithm `-7`). Any other algorithm throws `KitError("ES256_NOT_SUPPORTED")`.
- Every signature is normalized to low-S. About half of Apple passkeys produce high-S signatures, which are malleable and which strict verifiers reject; the SDK makes every signature canonical client-side.

## Reproduce create + sign in Node (no browser)

This is the fastest way to confirm the SDK works and to run a create + sign in CI or any environment without WebAuthn hardware. `@soropass/core/testing` provides `createPasskeyKit({ mode: "mock" })`, which wires a deterministic in-process authenticator and an in-memory backend. The mock path has the same shape as the live path, so the same calls work against real adapters later. One difference: the mock account's `contractId` comes from the in-memory backend, not the factory scheme, so it does not equal a `deriveAccountAddress` derivation; that check applies to real factory-deployed accounts.

```js
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
```

Save the script with a `.mjs` extension (or set `"type": "module"` in `package.json`): the top-level `import` and `await` require ES modules, and a plain `.js` file in a default project errors with "Cannot use import statement outside a module".

`createPasskey({ userName? })` returns `{ contractId, credentialId, publicKey }`: the C-address, the base64url credential id (store it to sign or reconnect later), and the 65-byte SEC-1 public key (`userName` is optional). `referenceCheckAuth` returns `{ success }`.

Expected output ends with:

```
PASS: create + sign verified
OK: wrong key rejected
```

`sampleAuthEntry(contractId)` returns a ready-to-sign demo entry, so this check does not depend on hand-built XDR. For real transactions you build your own and sign it (see "Sign a Soroban transaction in the browser" below).

`createPasskeyKit(options)`: `mode` is `"mock"` (in-process, no network) or `"live"` (supply real adapters: `webauthn` from `browserWebAuthnClient()`, `deployer` from `factoryDeployer(...)`, `indexer` from `eventsIndexer(...)`, and `signer` from `browserPasskeySigner(...)`); `rpId` is required; `rpName` and `seed` are optional, and `seed` makes the mock deterministic; `forceHighS: true` forces a high-S signature to exercise the low-S normalizer, and the result stays `PASS`.

The kit object exposes four methods with the same shape in both modes: `createPasskey({ userName? })`, `connect()`, `recover()`, and `signAuthEntry(entryXdr)`. `connect()` resolves the remembered credential to `{ contractId, credentialId }`, or `null` when nothing is remembered; `recover()` prompts for any passkey and returns every account it controls as `{ contractId, credentialId }[]`. In mock mode both run in-process, so the whole reconnect story is testable in CI:

```js
const back = await kit.connect(); // the account created above, resolved silently
const found = await kit.recover(); // [{ contractId, credentialId }]
```

## Create a passkey account in the browser

In a browser, `createPasskey` runs the real WebAuthn registration and deploys the account through an `AccountFactory`. By default, `factoryDeployer` uses the SoroPass-deployed factory for the network you name, so no contract work is needed on either network: testnet `CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH` and mainnet `CCCNRWMICVEMMUSBI7DL3IKB566QEOOQOLVDOAM5SLFDZ2KGUSRR3JVF`, both permissionless (`deploy` is not auth-gated). Pass `factoryContractId` only to deploy through your own factory instead.

```ts
import { createPasskey, factoryDeployer } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const account = await createPasskey({
  rpId: location.hostname, // your site's registrable domain
  rpName: 'My Stellar App',
  userName: 'alice',
  deployer: factoryDeployer({
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET, // selects the deployed factory for this network
    sourceSecret, // a funded G-account secret that pays the deploy fee; see "Fees and sponsorship" below
  }),
});

// account.contractId    the C-address of the smart account
// account.credentialId  store this to sign and reconnect later
// account.publicKey     SEC-1 (65-byte) secp256r1 public key
```

`createPasskey` uses `browserWebAuthnClient()` by default. `sourceSecret` funds the one-time deploy; in production a relayer or sponsor pays instead. Registration defaults `userVerification` to `'required'`, because the v0.2 account requires the User-Verified flag in `__check_auth`: a signature without UV fails on-chain. Passkey behavior varies by browser, platform, and authenticator; the compatibility matrix at https://docs.soropass.dev/docs/compatibility records what works in each case, with the recommended fallback where support diverges.

### Fees and sponsorship

Authorization and payment are separate: the passkey proves who may act, and a classic funded `G...` account sources every transaction, pays the network fee, and submits. `sourceSecret` is that fee source, and you supply it on both networks; the deployed factories are open infrastructure, not a fee service.

On testnet, fees cost nothing: fund a throwaway sponsor with friendbot, and poll the RPC before deploying, because friendbot returns before the Soroban RPC sees the new account:

```js
import { Keypair, rpc } from '@stellar/stellar-sdk';

const sponsor = Keypair.random();
await fetch(`https://friendbot.stellar.org/?addr=${sponsor.publicKey()}`);
const server = new rpc.Server('https://soroban-testnet.stellar.org');
let funded = false;
for (let i = 0; i < 30 && !funded; i++) {
  try {
    await server.getAccount(sponsor.publicKey());
    funded = true;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!funded) throw new Error('sponsor funded but not visible on the Soroban RPC after 30s');
const sourceSecret = sponsor.secret();
```

On mainnet, the same code runs with two changes: `networkPassphrase: Networks.PUBLIC` with `rpcUrl: 'https://mainnet.sorobanrpc.com'` (the default factory switches to the mainnet deployment automatically), and `sourceSecret` must be an account you fund with real XLM: your app's sponsor account (users hold no XLM, keep the secret server-side) or a relayer (OpenZeppelin Relayer). A contract account holds no base reserve, so sponsoring locks nothing per user. Measured on mainnet: ~0.05 XLM to create an account and ~0.005 XLM per passkey-signed transaction. Costs and sponsorship models: https://docs.soropass.dev/docs/sponsorship

To resolve an existing account without deploying, use `deriveAccountAddress` (synchronous and offline: it returns the C-address string directly, no `await` and no RPC) or `connect({ rpId, indexer })`. Note the encoding bridge: `createPasskey` returns `credentialId` as a base64url string, but `deriveAccountAddress` takes `Uint8Array` bytes. Pass the same bytes the factory received, which for `factoryDeployer` is the UTF-8 encoding of the base64url string, not its base64url-decoding. The options also require `publicKey`, the account's 65-byte SEC-1 key, because the v0.2 factory salts the deployed address by `sha256(credential_id ‖ public_key)`; binding the key fixes address squatting (credential ids are public, so a credential-only salt would let anyone pre-deploy at a victim's derived address with their own key).

```ts
import { deriveAccountAddress } from '@soropass/core';

const address = deriveAccountAddress({
  credentialId: new TextEncoder().encode(account.credentialId), // UTF-8 bytes of the base64url id
  publicKey: account.publicKey, // 65-byte SEC-1 key, part of the v0.2 salt
  networkPassphrase: Networks.TESTNET, // selects the deployed factory; factoryContractId overrides
});
// address === account.contractId
```

## Sign a Soroban transaction in the browser

A `C...` account cannot be a transaction's source, so build the transaction with a separate funded source account. The passkey authorizes the Soroban auth entry inside it, which `__check_auth` verifies. `browserPasskeySigner` adapts `navigator.credentials.get` into the signer `signTransaction` expects.

```ts
import { signTransaction, signAuthEntry, browserPasskeySigner } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const sign = browserPasskeySigner({
  rpId: location.hostname,
  allowCredentials: [account.credentialId], // offer the right passkey
  publicKey: account.publicKey, // echoed onto the assertion; required for the single-signer target
});

const signedTxXdr = await signTransaction(unsignedTxXdr, {
  networkPassphrase: Networks.TESTNET,
  sign,
  // Opt-in pre-flight checks. They turn an opaque on-chain failure into a typed
  // KitError at the call site. Omit `verify` to skip them.
  verify: { rpId: location.hostname, origin: location.origin, publicKey: account.publicKey },
});
```

`signTransaction` signs every Soroban address-credential auth entry in the envelope and leaves other operations untouched; a transaction that carries no Soroban auth entry comes back unchanged. Pass `signerAddress` to sign only that account's entries and leave any co-authorizer's entries alone. To sign a single entry, use `signAuthEntry(entryXdr, { networkPassphrase, sign })`. (The stellar-wallets-kit `PasskeyModule` below wraps `signTransaction` to reject a classic, no-Soroban-entry transaction loudly, since a passkey account can never be a classic source.)

The default `single-signer` target requires the signer's 65-byte SEC-1 public key: the assembled signature struct has four fields (`authenticator_data`, `client_data_json`, `public_key`, `signature`), and the v0.2 account verifies against the exact enrolled key named in it. Supply the key either as the `publicKey` option of `browserPasskeySigner` (echoed onto each assertion, shown above) or once as `SorobanSignOptions.publicKey` (which takes precedence); with neither, signing throws a `KitError`. `browserPasskeySigner` defaults `userVerification` to `'required'` because the v0.2 contract enforces the UV flag on-chain. The `target: 'smart-wallet'` path (passkey-kit v1) uses a three-field struct and resolves the key on-chain by credential id.

### A complete payment, end to end

The most common wallet transaction: move XLM out of the smart account through the native Stellar Asset Contract. The listing uses `account` from "Create a passkey account in the browser", `sourceSecret` (the sponsor) from "Fees and sponsorship", and `destination`, any funded classic account.

A fresh smart account holds no XLM, so fund it before its first outgoing payment. On testnet the sponsor seeds it with a classic SAC transfer:

```ts
import {
  Asset,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const sponsor = Keypair.fromSecret(sourceSecret);
const SAC = Asset.native().contractId(Networks.TESTNET);
const addr = (a: string) => nativeToScVal(a, { type: 'address' });

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
await server.pollTransaction((await server.sendTransaction(preparedFunding)).hash);
```

Two signatures happen in the payment itself, and both are required. The passkey signs the smart account's authorization entry (that is what `__check_auth` verifies), and the classic source account signs the envelope for fees and sequence; submitting without the envelope signature fails with `txBadAuth`. Re-simulating after the passkey signs matters too: the first simulation runs with an unsigned entry and under-budgets the on-chain `secp256r1_verify`, while the enforcing re-simulation runs the real `__check_auth` and prices it correctly.

```ts
import { signTransaction, browserPasskeySigner } from '@soropass/core';
import {
  Asset,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const sponsor = Keypair.fromSecret(sourceSecret); // the fee source from "Fees and sponsorship"
const SAC = Asset.native().contractId(Networks.TESTNET); // native XLM Stellar Asset Contract
const addr = (a: string) => nativeToScVal(a, { type: 'address' });

// 1. Build the transfer FROM the smart account, with the sponsor as the
//    transaction source, and simulate.
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

// 2. The passkey signs the smart account's authorization entry. The expiration
//    is stamped before the challenge is computed, so the signature binds it.
const validUntil = (await server.getLatestLedger()).sequence + 100;
const signedXdr = await signTransaction(assembled.toXDR(), {
  networkPassphrase: Networks.TESTNET,
  sign: browserPasskeySigner({
    rpId: location.hostname,
    allowCredentials: [account.credentialId],
    publicKey: account.publicKey,
  }),
  signatureExpirationLedger: validUntil,
});

// 3. Re-simulate with the signed entry so the budget covers secp256r1_verify.
const prepared = await server.prepareTransaction(
  TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET),
);

// 4. The classic source signs the ENVELOPE, then submit and poll.
prepared.sign(sponsor);
const sent = await server.sendTransaction(prepared);
const result = await server.pollTransaction(sent.hash);
// result.status === 'SUCCESS'
```

The opt-in `verify` pre-flight from the section above works here too: add it to the `signTransaction` options to catch an RP, origin, or key mismatch before submitting. The same build, passkey-sign, re-simulate, envelope-sign, submit sequence applies to every transaction the smart account authorizes, including the `add_signer` recovery flow below.

## Recover on a second device

### Native recovery on the v0.2 account

The v0.2 `webauthn-account` is multi-signer: the contract itself exposes `add_signer(public_key)`, `remove_signer(public_key)`, `is_signer(public_key)`, and `signer_count()`. Each add or remove is authorized by the account's own `__check_auth`, so an existing enrolled device signs the change, and the last signer can never be removed. A lost device is retired by signing `remove_signer` for it from any remaining device. The full sequence (add device B by A, sign by B, remove A by B, A rejected) is proven on testnet.

```ts
import { registerPasskey, signTransaction, browserPasskeySigner } from '@soropass/core';
import { Contract, nativeToScVal, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

// `server` and `sponsor` are the ones from "A complete payment, end to end".

// New device: register a passkey (no deploy), producing { credentialId, publicKey }.
const device2 = await registerPasskey({
  rpId: location.hostname,
  rpName: 'My Stellar App',
  userName: 'alice',
});

// Build + simulate the account-authorized add_signer invocation:
const source = await server.getAccount(sponsor.publicKey());
const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
  .addOperation(
    new Contract(account.contractId).call(
      'add_signer',
      nativeToScVal(device2.publicKey, { type: 'bytes' }),
    ),
  )
  .setTimeout(120)
  .build();
const assembled = await server.prepareTransaction(tx);

// The EXISTING enrolled device signs the account's auth entry:
const signedXdr = await signTransaction(assembled.toXDR(), {
  networkPassphrase: Networks.TESTNET,
  sign: browserPasskeySigner({
    rpId: location.hostname,
    allowCredentials: [account.credentialId],
    publicKey: account.publicKey,
  }),
});

// Then re-simulate, envelope-sign with the source, submit, and poll: steps 3
// and 4 of "A complete payment, end to end", unchanged.
```

`remove_signer(public_key)` works the same way, authorized by any remaining enrolled device.

### Recovery on a passkey-kit v1 smart-wallet

For a passkey-kit v1 smart-wallet, `addSigner` wraps the whole enroll-a-device flow (build `add_signer`, sign with the existing device, enforcing re-simulation, submit):

```ts
import { registerPasskey, addSigner, browserPasskeySigner } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const device2 = await registerPasskey({
  rpId: location.hostname,
  rpName: 'My Stellar App',
  userName: 'alice',
});

await addSigner({
  walletContractId, // a passkey-kit v1 smart-wallet C-address
  newSigner: { credentialId: device2.credentialId, publicKey: device2.publicKey },
  networkPassphrase: Networks.TESTNET,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  sourceSecret, // funded classic G-account that pays the fee
  sign: browserPasskeySigner({ rpId: location.hostname, allowCredentials: [walletCredentialId] }),
});
```

`addSigner` and `removeSigner` target the v1 smart-wallet ABI only; they do not drive the v0.2 account (use the native flow above for it).

## Reconnect a returning user

`connect` resolves the account silently, with no passkey prompt. You never pass the credential id yourself: `createPasskey` stores it under the localStorage key `stellar-passkey:<rpId>` (pass a `storage` object to both calls to keep it somewhere else), and `connect` reads it back and resolves the C-address through the indexer. It returns `null` when nothing is stored or no account resolves; send that user through `recover`. Pass the `publicKey` you persisted at create time so `connect` returns only the account founded by that exact key: factory `deploy` is permissionless, so without the key a credential id can also resolve to an account someone else pre-deployed, and you then must verify enrollment yourself before trusting the result.

```ts
import { connect, recover, eventsIndexer } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const indexer = eventsIndexer({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET, // reads the default factory's events; factoryContractId overrides
});

// Same-device return visit: silent, no prompt.
let session = await connect({
  rpId: location.hostname,
  indexer,
  publicKey: account.publicKey, // the 65-byte key persisted at create time
});

if (!session) {
  // New device or cleared storage: prompts for any passkey and lists the
  // accounts it controls. Call it from a click handler (Safari requires a
  // user gesture for the prompt).
  [session] = await recover({ rpId: location.hostname, indexer });
}
// session.contractId, session.credentialId
```

Both functions take the same `indexer`; `recover` returns `{ contractId, credentialId }[]` because one passkey can control several accounts. See the full second-device flow at https://docs.soropass.dev/docs/sdk/accounts.

## Drop-in UI screens

`@soropass/ui` ships styled screens for the five flows: create, sign, recover, connect, and add-device. It is framework-agnostic (plain DOM, no framework dependency) and installs from npm: `npm install @soropass/ui` (it depends on `@soropass/core`). Each screen pairs a headless flow (a state machine over plain async callbacks you supply) with a mount function, and every visual value is a `--pk-*` CSS custom property, so re-theming means overriding tokens, not editing components.

```ts
import { createCreatePasskeyFlow } from '@soropass/ui/headless';
import { mountCreateScreen } from '@soropass/ui/styled';
import '@soropass/ui/styled.css';

const flow = createCreatePasskeyFlow({
  userActivation: navigator.userActivation, // enforces the Safari user-gesture rule
  async create({ userName }, report) {
    // call report.deploying() when the on-chain deploy phase begins
    // the browser create call from "Create a passkey account in the browser"
    return createPasskey({ rpId: location.hostname, rpName: 'My Stellar App', userName, deployer });
  },
});
const { unmount } = mountCreateScreen(document.getElementById('slot'), { flow });
```

The same shape gives `mountSignScreen`, `mountRecoverScreen`, `mountAddDeviceScreen`, and `mountConnectScreen`. A complete framework-free example wiring all five screens to the mock kit: https://github.com/justmert/soropass/tree/main/apps/ui-example. Component and theming reference: https://docs.soropass.dev/docs/components.

## Register the passkey wallet in stellar-wallets-kit

SoroPass ships a `PasskeyModule` that implements the kit's `ModuleInterface` (`getAddress`, `signTransaction`, `signAuthEntry`, `isAvailable`), so a passkey wallet appears in the kit's own picker next to Freighter and Lobstr and signs through the kit modal.

```ts
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { Networks } from '@creit.tech/stellar-wallets-kit/types';
import { PasskeyModule, PASSKEY_ID } from '@creit.tech/stellar-wallets-kit/modules/passkey';

StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: [
    // deployer + indexer come from @soropass/core (factoryDeployer / eventsIndexer).
    // With a deployer set, getAddress creates the account on first connect.
    new PasskeyModule({ rpId, networkPassphrase, factoryContractId, deployer, indexer }),
    /* ...other modules */
  ],
});
StellarWalletsKit.setWallet(PASSKEY_ID); // PASSKEY_ID === "passkey"
const { address } = await StellarWalletsKit.getAddress();
```

The kit's API is static: call `StellarWalletsKit.init(...)` once, then the static methods. The kit's npm package is `@creit.tech/stellar-wallets-kit` (note the dot). The `PasskeyModule` is proposed upstream to `Creit-Tech/Stellar-Wallets-Kit`; the published kit (v2.6.0) does not include the `./modules/passkey` export yet, so this snippet runs once the module lands in a kit release. Until then, call the `@soropass/core` functions above directly; the module wraps exactly those calls. See https://docs.soropass.dev/docs/quickstart for configuration.

## Errors

Every failure is a typed `KitError` with a stable `code`. Detect it with `isKitError(err)` and branch on `err.code`. The full frozen set (`KIT_ERROR_CODES`) is: `USER_CANCELLED`, `ES256_NOT_SUPPORTED`, `RP_ID_MISMATCH`, `ORIGIN_MISMATCH`, `CHALLENGE_MISMATCH`, `INVALID_SIGNATURE_DER`, `INVALID_PUBLIC_KEY`, `CONTRACT_AUTH_FAILED`, `NETWORK_ERROR`, `UNSUPPORTED_AUTHENTICATOR`.

The v0.2 account contract defines its own numeric contract errors, returned on-chain from `__check_auth` and the signer methods (for example `UnknownSigner`, `UserVerifiedFlagMissing`, `LastSignerRemoval`). Those are Soroban contract errors, separate from the ten `KitError` codes above; do not treat one set as the other.

## Full reference

- API reference and adapters (OpenZeppelin Relayer, Mercury indexer): https://docs.soropass.dev
- Device/browser compatibility matrix with per-case fallbacks: https://docs.soropass.dev/docs/compatibility
- Package: https://www.npmjs.com/package/@soropass/core
- Drop-in UI screens (create, sign, recover, connect, add-device; framework-agnostic, token-themed): https://www.npmjs.com/package/@soropass/ui
