# Security model and audit scope: SoroPass contracts

This document describes the trust model, the deliberate design decisions, and
the known limitations of the two Soroban contracts in this directory, and it
defines the scope for an external audit. It reflects an internal three-lens
review (contract security, mainnet deploy readiness, and test/crypto
correctness) completed 2026-08-22.

## Status: UNAUDITED

These contracts have NOT had an external security audit. They are proven on
testnet (including a real passkey-signed payment) and covered by unit and
integration tests, and the `__check_auth` verification path is a faithful,
slightly stricter reimplementation of the audited OpenZeppelin Stellar WebAuthn
verifier. That is not a substitute for an audit. Do not hold funds of material
value on these contracts on mainnet until an external audit is complete and its
findings are closed. The plan of record gates the mainnet deployment and the 1.0
package publish on that audit.

## What the contracts are

- `webauthn-account`: a multi-signer secp256r1 smart account. It holds funds and
  authorizes actions only when `__check_auth` verifies a WebAuthn assertion from
  an enrolled passkey public key. Enrolled devices are managed with `add_signer`
  and `remove_signer`, each gated by the account's own `__check_auth`.
- `account-factory`: deploys a `webauthn-account` per passkey at a deterministic
  address salted by `sha256(credential_id || public_key)`, and emits a
  `(deployed, credential_id, public_key) -> address` event.

## Trust model (non-custodial)

- The passkey private key never leaves the user's device authenticator. The
  contracts only ever handle the 65-byte SEC-1 public key.
- `__check_auth` is the only gate on spending. It passes only for a signature
  that verifies against a public key the account has enrolled.
- There is no admin, owner, upgrade, `set_code`, `withdraw`, or `migrate`
  function on either contract. No party (including the deployer and the SoroPass
  authors) holds a key that can move funds, freeze an account, or change the
  code. This is verifiable by reading the two `lib.rs` files.
- A separate funded account sources the fee for each transaction (a C-address
  cannot be a transaction source). That relayer can decline to submit, but it
  cannot authorize an action, so it can censor but never steal.

## Verification path (matches the audited OZ verifier)

`__check_auth` performs, in order: enrolled-signer check on the inline
`public_key` before any crypto; `clientDataJSON` length cap (1024 bytes); a real
JSON parse (serde-json-core); `type == "webauthn.get"`; challenge equals the
unpadded base64url of the Soroban `signature_payload`; `authenticatorData`
length at least 37; the User-Present and User-Verified flags; Backup
Eligibility/State consistency; and `secp256r1_verify` over `SHA256(authData ||
SHA256(clientDataJSON))`. Every check corresponds to a check in the audited
OpenZeppelin verifier (`references/stellar-contracts/.../verifiers/webauthn.rs`).

Low-S is a validity requirement, not just malleability hygiene: the Soroban host
`secp256r1_verify` rejects a high-S signature at decode, so the SDK normalizes
every signature to low-S client-side. Roughly half of Apple authenticator
assertions are high-S, so without this normalization about half of real
assertions would fail on-chain.

Replay protection comes from the Soroban auth framework. The signed challenge is
`SHA256` of the authorization preimage, which commits to the network id, the
per-address nonce, the signature expiration ledger, and the full invocation
tree, so a signature cannot be replayed across networks, accounts, time, or a
different set of operations.

## Deliberate design decisions (an auditor should confirm these are intended)

1. Flat signer model. Every enrolled passkey is co-equal and can add or remove
   any signer (the last signer can never be removed). A single compromised or
   coerced device can therefore add an attacker key and remove the others, i.e.
   take full, irreversible control. This matches the passkey-kit reference and
   is the intended model for a single-user wallet whose purpose is that any of
   the user's own devices can act and recover. It is a strong statement for a
   funds contract and is called out here so it is a conscious choice. A wallet
   integrator who wants a distinguished recovery/admin key or an N-of-M
   threshold for signer-set changes must add that on top; this contract does not
   provide it.

2. `auth_contexts` is not inspected. The account authorizes whatever the signed
   invocation tree requests. This does not broaden authorization: the challenge
   already cryptographically commits to that exact invocation tree, so a valid
   signature can never authorize more than the user signed. The consequence is
   that there is no on-chain per-signer scoping (no session keys, spending caps,
   or limited-privilege signers). Adopt the OZ context-rule/policy pattern if
   that is ever wanted.

3. User Verification is required. `__check_auth` rejects any assertion without
   the UV flag. This is safer for a funds contract and matches the audited OZ
   verifier, but it excludes authenticators that cannot produce UV (some roaming
   security keys used without a PIN or biometric).

4. Immutability. Neither contract is upgradeable. This removes any upgrade-key
   backdoor, and is stronger than passkey-kit (which ships a self-upgradeable
   `update_contract_code`). The tradeoff is that a bug found after deployment
   cannot be patched in place; funds must be migrated to a freshly deployed
   version. Given an audited freeze before mainnet, immutability is the intended
   choice.

## Account resolution: a consumer requirement (M1)

`deploy` is permissionless (to allow gasless/relayer deploys), and a credential
id is not exclusive: anyone can deploy a DIFFERENT account for the same
credential id with their own key. It lands at a different salted address (the
key is bound into the salt), so an attacker cannot occupy a victim's canonical
address, but a naive resolver that maps a credential id to "the first deployed
account" could be pointed at an attacker's account, and funds a user then sends
to it would be the attacker's. Therefore:

- The `deployed` event carries the founding `public_key` as a topic.
- A consumer resolving a credential id to an account MUST verify the user's key
  is enrolled: compare against the event's `public_key`, call `is_signer`, or
  re-derive the canonical address with `deriveAccountAddress(credential_id,
public_key)` (which is deterministic and needs no indexer). The SDK's
  `connect({ publicKey })` does this filtering; never trust the first resolved
  account with funds without this check.

## Residual risk summary

- No external audit yet (the dominant risk; gates mainnet).
- No defense in depth: a single compromised passkey drains the account or
  re-keys it. No spending limits, policies, session keys, or social recovery.
- Losing every enrolled device means the funds are unrecoverable (the
  non-custodial tradeoff; enroll a second device before losing the first).
- State archival is a liveness risk, not a theft risk: an idle account can
  archive and is then restorable (funds are not lost); the contract extends its
  own instance TTL on every successful authorization (a failed `__check_auth`
  rolls back, so it does not bump the TTL), and the shared code entry is extended
  out of band per the deploy runbook.

## Audit scope

An external auditor should focus on, in priority order:

1. The `__check_auth` verification path in `webauthn-account/src/lib.rs`: the
   digest construction, challenge binding, flag handling, the serde-json-core
   parse against adversarial `clientDataJSON`, and the `secp256r1_verify` call.
2. Signer management: `add_signer` / `remove_signer` authorization, the
   last-signer guard, the `MAX_SIGNERS` bound, and storage/TTL handling.
3. The factory salt derivation and the permissionless-deploy / resolution model
   (this document, "Account resolution").
4. The flat signer model and the `auth_contexts` decision (confirm intended).
5. Reproducible build: `contracts/build.sh` on the pinned toolchain reproduces
   the wasm hashes recorded in `deployments.json` (the contracts ship
   un-optimized so the hash reproduces from `cargo build` with no external
   wasm-opt dependency).
