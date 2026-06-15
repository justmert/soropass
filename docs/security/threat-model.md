# Threat model — `@soropass/core`

Written for the SCF Audit Bank (post-testnet) and as a credibility signal now.
**Every mitigation below references a concrete test or matrix row** — the
`security.test.ts` guard fails the build if any cited test file or anchor id
does not exist.

## On-chain verification path

A passkey assertion authorizes a Soroban smart-account call as follows:

1. The SDK computes the auth-entry preimage
   `SHA256(XDR(HashIdPreimage::SorobanAuthorization{networkId, nonce, sigExpLedger, invocation}))`
   and base64url-encodes it as the WebAuthn `challenge` (`soroban/preimage.ts`).
2. `navigator.credentials.get()` returns `authenticatorData`, `clientDataJSON`,
   and a DER ECDSA signature.
3. The SDK converts DER → 64-byte `R‖S` and **low-S normalizes** it
   (`derToCompactLowS`), then assembles the `Secp256r1Signature` struct into the
   `SorobanAuthorizationEntry` (`soroban/assemble.ts`).
4. On-chain, `__check_auth` reconstructs
   `SHA256(authenticatorData ‖ SHA256(clientDataJSON))`, runs `secp256r1_verify`
   against the stored SEC-1 public key, and asserts the `clientDataJSON.challenge`
   equals the base64url preimage (challenge-binding). Modelled faithfully by
   `referenceCheckAuth` (`checkAuth.ts`).

## Trust boundaries (for auditors)

- **Authenticator (platform/roaming):** trusted to generate/hold the P-256 key
  and gate use behind user verification. Not trusted to produce canonical (low-S)
  signatures — ~50% of Apple sigs are high-S; the SDK normalizes.
- **Client/browser (RP JS):** trusted to bind origin + RP-ID and to pass the
  correct preimage as the challenge. Compromised client ⇒ it can only authorize
  what the user approves for _this_ origin (passkeys are origin-scoped).
- **Submission/indexer infra (adapters):** **untrusted** — a malicious relayer
  or indexer cannot forge an authorization; it can at most withhold/delay
  submission or mis-report account lookups. This is why they are pluggable
  adapters (S12), not hard dependencies.
- **Soroban host fn `secp256r1_verify`:** trusted for curve math; **does not**
  enforce low-S, so canonicality is the SDK's responsibility.
- **Contract `__check_auth`:** the ultimate authority — verifies the signature
  and challenge-binding regardless of client behavior.

## Threats & mitigations

| Threat                                       | Mitigation                                                                                   | Backing test                            | Matrix / anchor                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Signature malleability (high-S)              | Client-side low-S normalization (`S > n/2 → n−S`); recommend contract reject non-canonical S | `anchors.test.ts`, `signature.test.ts`  | anchor `low-s-normalization`, matrix `es256_alg` |
| Replay / wrong-context signing               | Challenge = auth preimage; `__check_auth` + SDK reject mismatches (`CHALLENGE_MISMATCH`)     | `soroban.test.ts`, `clientData.test.ts` | —                                                |
| Non-ES256 credential (unverifiable on-chain) | RS256/other hard-fail at create-time (`ES256_NOT_SUPPORTED`)                                 | `anchors.test.ts`, `publicKey.test.ts`  | anchor `rs256-hard-fail`, matrix `es256_alg`     |
| RP-ID spoofing                               | `verifyRpIdHash`: authData.rpIdHash === SHA256(rpId) (`RP_ID_MISMATCH`)                      | `authData.test.ts`                      | matrix `webauthn`                                |
| Origin spoofing                              | clientDataJSON origin allow-list (`ORIGIN_MISMATCH`)                                         | `clientData.test.ts`                    | matrix `related_origin_requests`                 |
| Ceremony auto-trigger / Safari silent reject | User-activation guard (`USER_CANCELLED`)                                                     | `anchors.test.ts`                       | anchor `apple-user-gesture`                      |
| Lost device / localStorage                   | Discoverable-credential `recover()` → indexer resolution                                     | `ceremonies.test.ts`                    | matrix `conditional_mediation`                   |

## Detailed notes

### Low-S malleability (anchor `low-s-normalization`)

ECDSA signatures are malleable: `(r, s)` and `(r, n−s)` both verify. ~50% of
Apple Touch ID/Face ID assertions are high-S, and Soroban's `secp256r1_verify`
does **not** reject high-S. The SDK always emits canonical low-S
(`normalizeLowS`), so a verifier that _does_ enforce low-S still accepts our
signatures, and on-chain identity/replay logic keyed on the signature is stable.
We additionally recommend the contract reject non-canonical S as defense-in-depth.
Proven both directions in `anchors.test.ts` (high-S in → low-S out; a
non-normalized sig is rejected by a low-S enforcer).

### Challenge / replay binding

The signed challenge IS the auth-entry preimage hash, so a signature cannot be
replayed against a different invocation, nonce, network, or expiration ledger.
`__check_auth` re-derives the preimage and asserts equality; `referenceCheckAuth`
mirrors it. `soroban.test.ts` proves a signature over the wrong challenge (and the
wrong network passphrase) is rejected.

### signCount — advisory only

Synced passkeys (iCloud Keychain, Google Password Manager) report `signCount = 0`
or unreliable counters. We **parse** signCount (`parseAuthenticatorData`) but
**never** hard-gate on it; cloning detection via counters is not viable for synced
credentials and would break legitimate users. `authData.test.ts` asserts it is
surfaced, not enforced.

### RP-ID pinning + Related Origin Requests

Passkeys are scoped to an eTLD+1 (the RP-ID). Multi-origin products use
**Related Origin Requests** — a `/.well-known/webauthn` document listing allowed
`origins` (browsers honor ~5 labels). Risk: a passkey bound to a single domain is
unusable if that domain is lost. **Recovery best practice: register a second
signer from a different domain/device.** RoR browser support is tracked in the
living matrix (`related_origin_requests` row, with verification tier).

### Attestation — `none` by default

`buildCreateOptions` requests `attestation: 'none'`. We don't need an attestation
statement (we only need the public key for on-chain verification), it avoids
privacy/regulatory concerns, and it sidesteps brittle attestation-format parsing.
`createOptions.test.ts` pins `attestation: 'none'`.

### Recovery model

- **Synced passkeys** (default): survive device loss via the platform cloud, but
  trust that provider.
- **Device-bound**: stronger isolation, but lost with the device → require a
  backup signer.
- **Recommended:** multi-signer smart accounts — a second passkey on another
  device/domain, an Ed25519 backup key, or an OZ policy signer. The `recover()`
  ceremony (`ceremonies.test.ts`) finds all accounts a credential controls; the
  smart account itself supports multiple signers.

## Anchors index

The battle-tested anchors (`BATTLE_TESTED_ANCHORS`, S04) cross-referenced here:
`low-s-normalization`, `rs256-hard-fail`, `apple-user-gesture` — each with specs
in `anchors.test.ts`.
