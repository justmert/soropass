---
title: Security & recovery
description: On-chain proof, threat model, and recovery for passkey smart accounts.
---

## Proven on-chain (testnet)

A `SorobanAuthorizationEntry` **assembled and signed by `@stellar-passkey/core`**
is accepted by a real deployed `__check_auth` on Stellar testnet — and a wrong
key is rejected. This is a live round-trip, not a model.

| Run      | Key                                | On-chain result                       |
| -------- | ---------------------------------- | ------------------------------------- |
| Positive | the account's registered P-256 key | **SUCCESS**                           |
| Negative | a different P-256 key              | **FAILED** (`secp256r1_verify` traps) |

Reproducible via `packages/core/scripts/onchain-e2e.ts`; full write-up in
`docs/security/onchain-verification.md`.

## Threat model

The on-chain verification path, the threats, and the mitigations — each tied to a
battle-tested anchor — are documented in `docs/security/threat-model.md`. The
load-bearing points:

- **Low-S malleability.** `secp256r1_verify` does **not** enforce low-S and ~50%
  of Apple Touch ID / Face ID assertions are high-S. The SDK **always** low-S
  normalizes client-side before any signature reaches a contract. The
  compatibility matrix's CI authenticators emit deterministic low-S, so this is
  also called out as a tested-vs-real gap.
- **Challenge / replay.** The WebAuthn `challenge` is bound to the Soroban auth
  preimage (`SHA256(HashIdPreimage::SorobanAuthorization)`), so a signature is
  valid only for that exact nonce + expiration + invocation + network.
- **RP-ID / origin binding.** Assertions are scoped to the relying-party ID;
  cross-origin replay is rejected.
- **ES256-only.** Non-ES256 keys hard-fail (`ES256_NOT_SUPPORTED`) — Soroban
  verifies only secp256r1.

## Recovery

A passkey can be a **discoverable** (resident) credential, so a user returning on
a new device recovers without any stored state:

```ts
import { recover } from '@stellar-passkey/core/recover';
const accounts = await recover({ rpId, indexer });
```

`recover()` performs a discoverable `get()` (no `allowCredentials`) and resolves
every smart account the passkey controls via the indexer. Pair it with platform
passkey sync (iCloud Keychain, Google Password Manager) for cross-device access;
the SDK treats recovery as a first-class flow alongside create and connect.
