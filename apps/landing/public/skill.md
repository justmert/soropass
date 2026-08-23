---
name: soropass-sdk
description: Integrates the @soropass/core SDK to add passkey (WebAuthn) smart-account authentication to a Stellar app on Soroban. Use this when you need to create a passkey smart account, derive its contract (C-address), sign Soroban transactions or authorization entries with a passkey, normalize secp256r1 signatures to low-S, recover an account on a second device, or register a passkey wallet in stellar-wallets-kit. Includes a no-browser Node path for reproducing create and sign.
---

# SoroPass SDK (`@soropass/core`)

`@soropass/core` is a minimal, headless TypeScript SDK for passkey smart accounts on Stellar. It handles WebAuthn registration, DER-to-compact low-S secp256r1 conversion, the Soroban `__check_auth` authorization-entry wire shape, deterministic C-address derivation, and multi-device recovery. It ships no UI and no framework opinions, and it keeps `@stellar/stellar-sdk` as a peer dependency so it is never bundled twice.

A passkey account is a Soroban contract (a `C...` address). The account's `__check_auth` verifies a WebAuthn secp256r1 assertion on-chain, so a device passkey (Touch ID, Windows Hello, a security key) replaces a seed phrase.

## Install

```bash
npm install @soropass/core @stellar/stellar-sdk
```

`@stellar/stellar-sdk` is a required peer dependency (the package declares `>=12`). These examples are verified against `@soropass/core@0.1.2` with `@stellar/stellar-sdk` v16 on Node 20+. `@soropass/core` publishes ESM, CommonJS, and type declarations.

Two guarantees the SDK enforces so you do not have to:
- Registration is ES256 only (secp256r1, COSE algorithm `-7`). Any other algorithm throws `KitError("ES256_NOT_SUPPORTED")`.
- Every signature is normalized to low-S. About half of Apple passkeys produce high-S signatures, which are malleable and which strict verifiers reject; the SDK makes every signature canonical client-side.

## Reproduce create + sign in Node (no browser)

This is the fastest way to confirm the SDK works and to run a create + sign in CI or any environment without WebAuthn hardware. `@soropass/core/testing` provides `createPasskeyKit({ mode: "mock" })`, which wires a deterministic in-process authenticator and an in-memory backend. The mock path has the same shape as the live path, so the same calls work against real adapters later.

```js
// verify.mjs. Run with: node verify.mjs
import { createPasskeyKit, sampleAuthEntry } from "@soropass/core/testing";
import { referenceCheckAuth } from "@soropass/core";
import { xdr } from "@stellar/stellar-sdk";

const NETWORK = "Test SDF Network ; September 2015";

// 1. CREATE a passkey and deploy its smart account (in-memory, no browser).
const kit = createPasskeyKit({ mode: "mock", rpId: "example.com", rpName: "Example" });
const account = await kit.createPasskey({ userName: "alice" });
console.log("account:", account.contractId, "| key bytes:", account.publicKey.length);

// 2. SIGN a ready-made demo authorization entry with the passkey.
const signedXdr = await kit.signAuthEntry(sampleAuthEntry(account.contractId));

// 3. VERIFY the signature is accepted by __check_auth, and a wrong key is not.
const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, "base64");
console.log(referenceCheckAuth(signed, account.publicKey, NETWORK).success ? "PASS: create + sign verified" : "FAIL");

const other = await createPasskeyKit({ mode: "mock", rpId: "example.com", seed: "other" }).createPasskey();
console.log(!referenceCheckAuth(signed, other.publicKey, NETWORK).success ? "OK: wrong key rejected" : "UNEXPECTED: wrong key accepted");
```

Save the script with a `.mjs` extension (or set `"type": "module"` in `package.json`): the top-level `import` and `await` require ES modules, and a plain `.js` file in a default project errors with "Cannot use import statement outside a module".

`createPasskey({ userName? })` returns `{ contractId, credentialId, publicKey }`: the C-address, the base64url credential id (store it to sign or reconnect later), and the 65-byte SEC-1 public key (`userName` is optional). `referenceCheckAuth` returns `{ success }`.

Expected output ends with:

```
PASS: create + sign verified
OK: wrong key rejected
```

`sampleAuthEntry(contractId)` returns a ready-to-sign demo entry, so this check does not depend on hand-built XDR. For real transactions you build your own and sign it (see "Sign a Soroban transaction in the browser" below).

`createPasskeyKit(options)`: `mode` is `"mock"` (in-process, no network) or `"live"` (supply real `webauthn`, `deployer`, `indexer`, and `signer`); `rpId` is required; `rpName` and `seed` are optional, and `seed` makes the mock deterministic; `forceHighS: true` forces a high-S signature to exercise the low-S normalizer, and the result stays `PASS`.

## Create a passkey account in the browser

In a browser, `createPasskey` runs the real WebAuthn registration and deploys the account through a factory. Use `factoryDeployer` for a real network. The testnet `AccountFactory` is `CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM`.

```ts
import { createPasskey, factoryDeployer } from "@soropass/core";
import { Networks } from "@stellar/stellar-sdk";

const account = await createPasskey({
  rpId: location.hostname,          // your site's registrable domain
  rpName: "My Stellar App",
  userName: "alice",
  deployer: factoryDeployer({
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    factoryContractId: "CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM",
    sourceSecret,                   // a funded G-account secret that pays the deploy fee
  }),
});

// account.contractId    the C-address of the smart account
// account.credentialId  store this to sign and reconnect later
// account.publicKey     SEC-1 (65-byte) secp256r1 public key
```

`createPasskey` uses `browserWebAuthnClient()` by default. `sourceSecret` funds the one-time deploy; in production a relayer or sponsor pays instead.

To resolve an existing account without deploying, use `deriveAccountAddress` (synchronous and offline: it returns the C-address string directly, no `await` and no RPC) or `connect({ rpId, indexer })`. Note the encoding bridge: `createPasskey` returns `credentialId` as a base64url string, but `deriveAccountAddress` takes `Uint8Array` bytes. Pass the same bytes the factory received, which for `factoryDeployer` is the UTF-8 encoding of the base64url string, not its base64url-decoding:

```ts
import { deriveAccountAddress } from "@soropass/core";

const address = deriveAccountAddress({
  factoryContractId: "CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM",
  credentialId: new TextEncoder().encode(account.credentialId), // UTF-8 bytes of the base64url id
  networkPassphrase: Networks.TESTNET,
});
// address === account.contractId
```

## Sign a Soroban transaction in the browser

A `C...` account cannot be a transaction's source, so build the transaction with a separate funded source account. The passkey authorizes the Soroban auth entry inside it, which `__check_auth` verifies. `browserPasskeySigner` adapts `navigator.credentials.get` into the signer `signTransaction` expects.

```ts
import { signTransaction, signAuthEntry, browserPasskeySigner } from "@soropass/core";
import { Networks } from "@stellar/stellar-sdk";

const sign = browserPasskeySigner({
  rpId: location.hostname,
  allowCredentials: [account.credentialId], // offer the right passkey
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

## Recover on a second device

An account can hold more than one passkey signer, so a lost device never locks the user out. On the new device, register a passkey without deploying, then authorize it from an existing device.

```ts
import { registerPasskey, addSigner, browserPasskeySigner } from "@soropass/core";
import { Networks } from "@stellar/stellar-sdk";

// New device: register a passkey (no deploy), producing its signer material.
const device2 = await registerPasskey({ rpId: location.hostname, rpName: "My Stellar App", userName: "alice" });

// Existing device: authorize adding device2 as a signer on-chain.
await addSigner({
  walletContractId: account.contractId,
  newSigner: { credentialId: device2.credentialId, publicKey: device2.publicKey },
  networkPassphrase: Networks.TESTNET,
  rpcUrl: "https://soroban-testnet.stellar.org",
  sourceSecret,   // funded classic G-account that pays the fee
  sign: browserPasskeySigner({ rpId: location.hostname, allowCredentials: [account.credentialId] }),
});
```

`connect({ rpId, indexer })` resolves an account from a remembered credential id. `recover({ rpId, indexer })` prompts for any passkey and returns the accounts that credential controls, as `{ contractId, credentialId }[]`. Both take an `indexer` (for example `eventsIndexer({ rpcUrl, factoryContractId })`). See the full second-device flow at https://docs.soropass.dev/docs/sdk/accounts.

## Register the passkey wallet in stellar-wallets-kit

SoroPass ships a `PasskeyModule` that implements the kit's `ModuleInterface` (`getAddress`, `signTransaction`, `signAuthEntry`, `isAvailable`), so a passkey wallet appears in the kit's own picker next to Freighter and Lobstr and signs through the kit modal.

```ts
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { PasskeyModule, PASSKEY_ID } from "@creit.tech/stellar-wallets-kit/modules/passkey";

StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: [
    new PasskeyModule({ rpId, networkPassphrase, factoryContractId }),
    /* ...other modules */
  ],
});
StellarWalletsKit.setWallet(PASSKEY_ID); // PASSKEY_ID === "passkey"
const { address } = await StellarWalletsKit.getAddress();
```

The kit's API is static: call `StellarWalletsKit.init(...)` once, then the static methods. The kit's npm package is `@creit.tech/stellar-wallets-kit` (note the dot). The `PasskeyModule` is proposed to the `Creit-Tech/Stellar-Wallets-Kit` maintainers (issue #95); the published kit (v2.5.0) does not include the `./modules/passkey` export yet, so this snippet runs once the module lands in a kit release. Until then, call the `@soropass/core` functions above directly; the module wraps exactly those calls. See https://docs.soropass.dev/docs/quickstart for configuration.

## Errors

Every failure is a typed `KitError` with a stable `code`. Detect it with `isKitError(err)` and branch on `err.code`. The full frozen set (`KIT_ERROR_CODES`) is: `USER_CANCELLED`, `ES256_NOT_SUPPORTED`, `RP_ID_MISMATCH`, `ORIGIN_MISMATCH`, `CHALLENGE_MISMATCH`, `INVALID_SIGNATURE_DER`, `INVALID_PUBLIC_KEY`, `CONTRACT_AUTH_FAILED`, `NETWORK_ERROR`, `UNSUPPORTED_AUTHENTICATOR`.

## Full reference

- API reference, adapters (Launchtube, OpenZeppelin Relayer, Mercury indexer), and the device/browser compatibility matrix: https://docs.soropass.dev
- Package: https://www.npmjs.com/package/@soropass/core
