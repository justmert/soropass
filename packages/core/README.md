# @soropass/core

[![npm](https://img.shields.io/npm/v/@soropass/core.svg)](https://www.npmjs.com/package/@soropass/core)
[![license](https://img.shields.io/npm/l/@soropass/core.svg)](./LICENSE)

Minimal, headless, ES256-only passkey SDK for Stellar smart accounts. It turns a WebAuthn passkey (Face ID, Touch ID, a security key) into the signer of a Soroban smart account, and handles the parts that are easy to get wrong: ES256 enforcement, DER-to-compact low-S conversion, the `__check_auth` authorization-entry wire shape, deterministic C-address derivation, and multi-device recovery.

It ships no UI and no framework opinions, and keeps `@stellar/stellar-sdk` as a peer dependency so it is never bundled twice. For drop-in create/sign/recover screens, see [`@soropass/ui`](https://www.npmjs.com/package/@soropass/ui). To register a passkey wallet in [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit), see the [integration guide](https://docs.soropass.dev/docs/wallets-kit).

## Why a passkey needs a smart account

A passkey signs with secp256r1 (ES256); a classic Stellar account (`G...`) only verifies Ed25519. So a passkey controls a Soroban **smart-account contract** (`C...`) whose `__check_auth` verifies the WebAuthn assertion on-chain via the host `secp256r1_verify`. This SDK owns that `C` side: create, sign, recover, add a signer.

## Install

```bash
npm install @soropass/core "@stellar/stellar-sdk@>=17"
```

`@stellar/stellar-sdk` is a required peer dependency. Install version 17 or newer (the `>=17` peer range): this release builds against the stellar-sdk 17 XDR API. If you must stay on stellar-sdk 12 through 16, install `@soropass/core@0.2.1` instead; 0.2.1 signs only classic address credentials, while 0.3.0 also signs the `addressV2` credentials that Protocol 23 networks return from simulation. `@soropass/core` publishes ESM, CommonJS, and type declarations, and runs without a `Buffer` polyfill.

## Quick start (no browser)

Reproduce a create + sign in Node or CI with the built-in mock authenticator, no WebAuthn hardware and no network. Save as `verify.mjs` and run `node verify.mjs`:

```js
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import { referenceCheckAuth } from '@soropass/core';
import { xdr } from '@stellar/stellar-sdk';

const NETWORK = 'Test SDF Network ; September 2015';

// Create a passkey and deploy its smart account (in-memory).
const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
const account = await kit.createPasskey({ userName: 'alice' });

// Sign a demo auth entry, then verify it the way the on-chain __check_auth does.
const signed = xdr.SorobanAuthorizationEntry.fromXDR(
  await kit.signAuthEntry(sampleAuthEntry(account.contractId)),
  'base64',
);
console.log(referenceCheckAuth(signed, account.publicKey, NETWORK).success ? 'PASS' : 'FAIL');
```

## Create a real account in the browser

```ts
import { createPasskey, factoryDeployer } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const account = await createPasskey({
  rpId: location.hostname,
  rpName: 'My Stellar App',
  userName: 'alice',
  deployer: factoryDeployer({
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
    factoryContractId: 'C...', // your AccountFactory
    sourceSecret, // a funded account that pays the one-time deploy fee
  }),
});
// account.contractId · account.credentialId · account.publicKey
```

Sign a transaction with `signTransaction` / `browserPasskeySigner`, resolve a returning user offline with `deriveAccountAddress`, and add a backup device with `registerPasskey` + `add_signer`. The full flows are in the [SDK reference](https://docs.soropass.dev/docs/sdk).

## What you get

- **ES256-only.** Registration pins `pubKeyCredParams` to alg `-7`; anything else throws `KitError('ES256_NOT_SUPPORTED')`.
- **Always low-S.** Roughly half of Apple passkeys emit high-S signatures; the SDK normalizes every signature to canonical low-S so it verifies on-chain.
- **Tree-shakeable subpaths.** Import only what you use; the heavy crypto is pulled only by `/create` and `/sign`.
- **Pluggable adapters** for submission (direct, Launchtube, OpenZeppelin Relayer) and indexing (on-chain events, Mercury).
- **One typed error taxonomy.** Every throw is a `KitError` with a code from a frozen 10-code set.

| Subpath                  | Contents                                                                          |
| ------------------------ | --------------------------------------------------------------------------------- |
| `.`                      | Full public surface                                                               |
| `@soropass/core/create`  | `createPasskey`, `registerPasskey`, `deriveAccountAddress`, public-key extraction |
| `@soropass/core/sign`    | `signTransaction`, `signAuthEntry`, `browserPasskeySigner`, low-S helpers         |
| `@soropass/core/connect` | `connect`                                                                         |
| `@soropass/core/recover` | `recover`, `addSigner`, `removeSigner`                                            |
| `@soropass/core/types`   | `KitError`, `KIT_ERROR_CODES`, `isKitError`                                       |
| `@soropass/core/testing` | `createPasskeyKit` mock mode, `sampleAuthEntry` (dev only)                        |

## Documentation

- Full docs and API reference: [docs.soropass.dev](https://docs.soropass.dev)
- Quickstart (three integration paths): [docs.soropass.dev/docs/quickstart](https://docs.soropass.dev/docs/quickstart)
- Compatibility matrix (device / browser / hardware): [docs.soropass.dev/docs/compatibility](https://docs.soropass.dev/docs/compatibility)

## License

Apache-2.0
