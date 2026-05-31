---
title: Quickstart
description: Install @stellar-passkey/core and create / sign / recover a passkey smart account.
---

`@stellar-passkey/core` is a minimal, headless, **ES256-only** passkey SDK for
Stellar smart accounts. It owns the WebAuthn ceremonies, the crypto (SEC-1 key
extraction, **low-S** normalization), and the Soroban auth assembly. You supply a
**`deployer`** (your smart-account factory) and an **RPC URL**.

## Install

```bash
pnpm add @stellar-passkey/core @stellar/stellar-sdk
```

`@stellar/stellar-sdk` (v15+, Protocol 23) is a **peer dependency** — it is never
bundled into the SDK.

## Create a wallet

Register an ES256 passkey, extract its public key, and deploy a smart account.

```ts
import { createPasskey } from '@stellar-passkey/core/create';

const account = await createPasskey({
  rpId: 'wallet.example.com',
  rpName: 'Example Wallet',
  userName: 'alice',
  userActivation: navigator.userActivation, // enforces the Safari gesture rule
  deployer: {
    // deploy a smart account whose signer is this passkey's public key
    deploy: ({ publicKey, credentialId }) => myFactory.deploy(publicKey, credentialId),
  },
});
// → { contractId: 'C…', credentialId: '…', publicKey: Uint8Array(65) }
```

A non-ES256 device key hard-fails with `KitError('ES256_NOT_SUPPORTED')` —
Soroban only verifies secp256r1.

## Sign a transaction

`connect()` resolves the stored passkey's account; `browserPasskeySigner` wires
`navigator.credentials.get` into the signer; `signTransaction` assembles the
low-S secp256r1 authorization.

```ts
import { connect } from '@stellar-passkey/core/connect';
import { signTransaction, browserPasskeySigner } from '@stellar-passkey/core/sign';
import { directSubmission, eventsIndexer } from '@stellar-passkey/core';
import { Networks } from '@stellar/stellar-sdk';

const rpId = 'wallet.example.com';
const rpcUrl = 'https://soroban-testnet.stellar.org';
const networkPassphrase = Networks.TESTNET;

const indexer = eventsIndexer({ rpcUrl, factoryContractId: 'C…FACTORY' });
const session = await connect({ rpId, indexer }); // { contractId, credentialId } | null

// build + simulate your invocation with @stellar/stellar-sdk, then:
const sign = browserPasskeySigner({ rpId, allowCredentials: [session.credentialId] });
const signedAuthXdr = await signTransaction(preparedTxXdr, { networkPassphrase, sign });

// sign the envelope (source/fees) and submit:
const result = await directSubmission({ rpcUrl, networkPassphrase }).send(fullySignedXdr);
// → { status: 'SUCCESS' | 'FAILED' | 'PENDING', hash }
```

:::tip[Resource budget]
`simulateTransaction` records auth but does **not** run `secp256r1_verify`, so it
under-budgets CPU instructions; a naive submit fails with `ExceededLimit`. Inflate
the Soroban instruction budget + resource fee before submitting — a complete,
working example is `packages/core/scripts/onchain-e2e.ts`. Managed submitters
(Launchtube, OZ Relayer) handle this for you.
:::

## Recover on a new device

```ts
import { recover } from '@stellar-passkey/core/recover';

const accounts = await recover({ rpId, indexer }); // [{ contractId, credentialId }]
// 0 → offer createPasskey(); 1 → use it; many → let the user choose.
```

## Errors

Everything the SDK throws is a `KitError` with a stable `code`:

```ts
import { isKitError } from '@stellar-passkey/core/types';

try {
  await createPasskey(/* … */);
} catch (e) {
  if (isKitError(e)) e.code; // USER_CANCELLED | ES256_NOT_SUPPORTED | UNSUPPORTED_AUTHENTICATOR
  //  | INVALID_PUBLIC_KEY | CONTRACT_AUTH_FAILED | NETWORK_ERROR | …(10 total, see KIT_ERROR_CODES)
}
```

## Next

- **[Integrate a wallet](/integration/)** — adopt the `PasskeyModule` in
  `@creit.tech/stellar-wallets-kit`, zero → signing.
- **[API reference](/api/)** — generated from the source.
- **[Security & recovery](/security/)** — the threat model + the on-chain proof.
