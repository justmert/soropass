# Integrating `@soropass/core`

A minimal, headless, ES256-only passkey SDK for Stellar smart accounts. This is
the practical guide: install, the three flows (create / sign / recover), errors,
adapters, and the optional UI.

> **Proven on-chain.** A passkey-signed authorization assembled by this SDK is
> accepted by a real deployed `__check_auth` on testnet — see
> [`docs/security/onchain-verification.md`](../security/onchain-verification.md).

## The 30-second mental model

The SDK owns the parts that are easy to get subtly wrong:

- **WebAuthn ceremonies** (ES256-only registration, assertions)
- **Crypto** (SEC-1 key extraction, **low-S** normalization, DER→compact)
- **Soroban auth assembly** (`SorobanAuthorizationEntry`, challenge binding)
- **Pluggable submission + indexer adapters**

You supply the two things that are deployment-specific:

- a **smart-account contract + factory deploy** (`deployer`) — the SDK never
  reinvents the audited contract layer (OZ Smart Accounts / kalepail
  webauthn-wallet);
- an **RPC URL** for the default adapters.

```
your wallet app
   │  createPasskey / connect / recover / signTransaction
   ▼
@soropass/core ── deployer (your factory) ──► smart-account contract
   │  directSubmission / eventsIndexer
   ▼
soroban-rpc (testnet/mainnet)
```

## Install

```bash
pnpm add @soropass/core @stellar/stellar-sdk
```

`@stellar/stellar-sdk` (v15+, Protocol 23) is a **peer dependency** — it is never
bundled into the SDK. Optional UI: `@soropass/ui`.

## Flow 1 — Create a wallet

Register an ES256 passkey, extract its public key, deploy a smart account for it.
You provide `deployer` (your factory call); everything else is the SDK.

```ts
import { createPasskey } from '@soropass/core/create';

const account = await createPasskey({
  rpId: 'wallet.example.com',
  rpName: 'Example Wallet',
  userName: 'alice',
  userActivation: navigator.userActivation, // enforces the Safari gesture rule
  deployer: {
    // deploy a smart account whose signer is this passkey's public key
    async deploy({ publicKey, credentialId }) {
      const { contractId, txHash } = await myFactory.deploy(publicKey, credentialId);
      return { contractId, txHash };
    },
  },
});
// → { contractId: 'C…', credentialId: '…', publicKey: Uint8Array(65) }
```

`createPasskey` throws `KitError('ES256_NOT_SUPPORTED')` if the device produced a
non-ES256 key (Soroban only verifies secp256r1) — see [Errors](#errors).

## Flow 2 — Sign a transaction with a logged-in account

`connect()` silently resolves the stored passkey's account; then sign with the
one-line `browserPasskeySigner` and submit through an adapter.

```ts
import { connect } from '@soropass/core/connect';
import { signTransaction, browserPasskeySigner } from '@soropass/core/sign';
import { directSubmission, eventsIndexer } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const rpId = 'wallet.example.com';
const rpcUrl = 'https://soroban-testnet.stellar.org';
const networkPassphrase = Networks.TESTNET;

const indexer = eventsIndexer({ rpcUrl, factoryContractId: 'C…FACTORY' });
const session = await connect({ rpId, indexer }); // { contractId, credentialId } | null
if (!session) {
  /* no passkey on this device → call recover() or createPasskey() */
}

// 1. build + simulate your invocation with @stellar/stellar-sdk (gets nonces +
//    resource fees). 2. sign the Soroban auth entries with the passkey:
const sign = browserPasskeySigner({ rpId, allowCredentials: [session.credentialId] });
const signedAuthXdr = await signTransaction(preparedTxXdr, { networkPassphrase, sign });

// 3. sign the envelope (source/fees) and submit:
const submit = directSubmission({ rpcUrl, networkPassphrase });
const result = await submit.send(fullySignedXdr); // { status, hash }
```

`signTransaction` finds every address-credential auth entry, runs the passkey
assertion, **low-S-normalizes**, and assembles the `Secp256r1Signature` the
contract's `__check_auth` consumes. `signAuthEntry(entryXdr, …)` does the same
for a single entry.

> **Resource budget caveat.** `simulateTransaction` records auth but does **not**
> run `secp256r1_verify`, so it under-budgets CPU instructions; a naive submit
> fails with `ExceededLimit`. Inflate the Soroban instruction budget + resource
> fee before submitting — a complete, working build→simulate→sign→submit example
> is [`packages/core/scripts/onchain-e2e.ts`](../../packages/core/scripts/onchain-e2e.ts).
> Managed submitters (Launchtube, OZ Relayer) handle this for you.

## Flow 3 — Recover on a new device

Discoverable assertion (no stored credential) → resolve the accounts the passkey
controls via the indexer.

```ts
import { recover } from '@soropass/core/recover';

const accounts = await recover({ rpId, indexer }); // RecoverResult[] = [{ contractId, credentialId }]
// 0 → offer createPasskey(); 1 → use it; many → let the user choose.
```

## Errors

Everything the SDK throws is a `KitError` with a stable `code`. Map it to UI copy
(the styled layer does this for you).

```ts
import { isKitError } from '@soropass/core/types';

try {
  await createPasskey(/* … */);
} catch (e) {
  if (isKitError(e)) {
    switch (e.code) {
      case 'USER_CANCELLED':
        /* user dismissed the sheet */ break;
      case 'ES256_NOT_SUPPORTED':
        /* device made a non-ES256 key */ break;
      case 'UNSUPPORTED_AUTHENTICATOR':
        /* no usable authenticator */ break;
      case 'INVALID_PUBLIC_KEY':
        /* couldn't read the key */ break;
      case 'CONTRACT_AUTH_FAILED':
        /* on-chain auth rejected */ break;
      case 'NETWORK_ERROR':
        /* RPC/connectivity */ break;
      // RP_ID_MISMATCH, ORIGIN_MISMATCH, CHALLENGE_MISMATCH, INVALID_SIGNATURE_DER
    }
  }
}
```

The full list is `KIT_ERROR_CODES` (10 codes). Dismissing the OS sheet surfaces
as `USER_CANCELLED`.

## Adapters (the only infra coupling)

Submission and indexing are pluggable; the defaults need no extra infrastructure.

| Kind       | Default (zero-infra)              | Optional alternatives                                   |
| ---------- | --------------------------------- | ------------------------------------------------------- |
| Submission | `directSubmission` (soroban-rpc)  | `launchtubeSubmission`, `openzeppelinRelayerSubmission` |
| Indexer    | `eventsIndexer` (rpc `getEvents`) | `mercuryIndexer`                                        |

All implement `SubmissionAdapter` / `IndexerAdapter` (from `@soropass/core/types`),
so swapping one is a one-line change. `defaultAdapters({ rpcUrl, factoryContractId })`
wires the zero-infra pair.

## Optional: drop-in UI

```ts
import { createCreatePasskeyFlow } from '@soropass/ui/headless';   // logic + a11y + i18n
import { mountCreateScreen } from '@soropass/ui/styled';            // styled DOM
import '@soropass/ui/styled.css';                                  // tokens + parts

const flow = createCreatePasskeyFlow({ create: /* wrap createPasskey */, userActivation: navigator.userActivation });
const { unmount } = mountCreateScreen(document.getElementById('slot')!, { flow });
```

Framework-agnostic; re-theme by overriding CSS tokens only. See
[`docs/ui/framework-decision.md`](../ui/framework-decision.md). Use `headless`
alone if you have your own components.

## Optional: stellar-wallets-kit

A `PasskeyModule` adopts this SDK into `@creit.tech/stellar-wallets-kit`. See
[`docs/integration/stellar-wallets-kit.md`](./stellar-wallets-kit.md).

## Guarantees (invariants)

- **ES256-only** — non-ES256 keys hard-fail (`ES256_NOT_SUPPORTED`).
- **Always low-S** — ~half of Apple passkeys are high-S; the SDK normalizes
  before any signature reaches a contract (Soroban does not enforce it).
- **`@stellar/stellar-sdk` is never bundled** — it's a peer dependency.
- **Minimal, tree-shakeable surface** — import from subpaths (`/create`, `/sign`,
  `/connect`, `/recover`, `/types`).
