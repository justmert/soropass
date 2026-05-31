# Integration guide (wallet teams)

This walks a wallet team from **zero → signing** by adopting the **`PasskeyModule`**
into [`@creit-tech/stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit).
The module is a thin adapter over `@stellar-passkey/core` — it implements the
kit's `ModuleInterface`, so a passkey smart account behaves like any other wallet
in the kit.

## What you provide

The SDK is contract-agnostic on purpose. You bring:

| You provide                                         | Why                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| a **smart-account contract + factory** (`deployer`) | the SDK never reinvents the audited contract layer (OZ Smart Accounts / kalepail webauthn-wallet) |
| an **indexer** (`IndexerAdapter`)                   | resolve `credentialId → C-address` (the default `eventsIndexer` uses soroban-rpc `getEvents`)     |
| an **RPC URL** + network passphrase                 | submission + indexing                                                                             |

## 1. Install

```bash
pnpm add @creit-tech/stellar-wallets-kit @stellar-passkey/core @stellar/stellar-sdk
# the PasskeyModule ships from this repo (packages/kit-module); upstream PR is S27
```

## 2. Construct the module

```ts
import { PasskeyModule } from '@stellar-passkey/wallets-kit-module';
import { eventsIndexer } from '@stellar-passkey/core';
import { Networks } from '@stellar/stellar-sdk';

const rpcUrl = 'https://soroban-testnet.stellar.org';

const passkey = new PasskeyModule({
  rpId: 'wallet.example.com',
  rpName: 'Example Wallet',
  networkPassphrase: Networks.TESTNET,
  network: 'TESTNET',
  indexer: eventsIndexer({ rpcUrl, factoryContractId: 'C…FACTORY' }),
  deployer: {
    // your factory: deploy a smart account for this passkey's public key
    deploy: ({ publicKey, credentialId }) => myFactory.deploy(publicKey, credentialId),
  },
  // optional: inject `webauthn` / `signer` / `storage`; sensible browser defaults otherwise
});
```

## 3. Register it with the kit

```ts
import { StellarWalletsKit, WalletNetwork } from '@creit-tech/stellar-wallets-kit';

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  modules: [passkey /* , ...other wallet modules */],
});
```

`isAvailable()` resolves `isUserVerifyingPlatformAuthenticatorAvailable()` within a
**500 ms budget** (never throws), so the kit can show/hide the passkey option
without hanging.

## 4. Create an account

`createAccount()` runs the ES256 registration, extracts the SEC-1 key, and calls
your `deployer` to mint the smart account.

```ts
const { contractId, credentialId, publicKey } = await passkey.createAccount('alice');
// contractId is the smart-account C-address
```

## 5. Get the address (connect)

`getAddress()` returns the connected **C-address**, silently connecting via the
indexer when needed:

```ts
const { address } = await passkey.getAddress(); // 'C…' — or throws if none; create first
```

This is the kit's `ModuleInterface` contract: smart accounts surface their
**contract (C-) address**, not a classic G-address. Display/truncate it as the
account identity; there is no separate public key to show.

## 6. Sign

Through the kit, or the module directly — both wrap the SDK's low-S secp256r1
auth assembly:

```ts
const { signedTxXdr } = await passkey.signTransaction(preparedTxXdr, {
  networkPassphrase: Networks.TESTNET,
});
// then submit (directSubmission / Launchtube / OZ Relayer) — see Adapters below
```

::: warning Prepare + budget the transaction first
`signTransaction` signs the Soroban **auth entries** in a prepared tx. Build and
**simulate** the invocation first (to populate nonces + resource fees), set a
valid `signatureExpirationLedger`, and — because simulation skips
`secp256r1_verify` — **inflate the instruction budget + resource fee** before
submitting. A complete, runnable build → simulate → sign → submit reference is
[`packages/core/scripts/onchain-e2e.ts`](https://github.com/), which is the same
flow proven on testnet in [Security & recovery](/security).
:::

`signAuthEntry(xdr, opts)` does the same for a single `SorobanAuthorizationEntry`.
`signMessage()` returns the low-S WebAuthn assertion signature (smart-account
message verification is application-defined).

## 7. Recover / reconnect

A returning user with no local credential recovers by discoverable assertion:

```ts
import { recover } from '@stellar-passkey/core/recover';
const accounts = await recover({ rpId: 'wallet.example.com', indexer }); // [{ contractId, credentialId }]
```

## Adapters (swap infra without touching flows)

| Kind       | Default (zero-infra)              | Optional                                                |
| ---------- | --------------------------------- | ------------------------------------------------------- |
| Submission | `directSubmission` (soroban-rpc)  | `launchtubeSubmission`, `openzeppelinRelayerSubmission` |
| Indexer    | `eventsIndexer` (rpc `getEvents`) | `mercuryIndexer`                                        |

All implement the `SubmissionAdapter` / `IndexerAdapter` interfaces, so swapping
one is a one-line change. `defaultAdapters({ rpcUrl, factoryContractId })` wires
the zero-infra pair.

## Errors

Map `KitError.code` to UI copy (the styled UI does this for you):
`USER_CANCELLED`, `UNSUPPORTED_AUTHENTICATOR`, `ES256_NOT_SUPPORTED`,
`INVALID_PUBLIC_KEY`, `CONTRACT_AUTH_FAILED`, `NETWORK_ERROR`, … (10 total).

## Don't want the kit?

Use `@stellar-passkey/core` directly — see the [Quickstart](/quickstart) — or the
headless/styled UI primitives in `@stellar-passkey/ui`.
