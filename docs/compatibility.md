# Stellar Passkey Compatibility & Usage Guide

> Generated from the matrix dataset in `apps/matrix/data`. The SDK reads the same
> data to choose its runtime fallbacks, so this guide and the code stay in sync.

**Data as of 2026-06-14.** Web is the priority surface (Chrome, Safari, Firefox,
Edge); mobile guidance is included where passkey behaviour diverges.

This guide records where passkey flows for Stellar smart accounts work, why they
break when they do, and the fallback a wallet should take. Each finding links to
its source and carries a verification tier so you can see how it was confirmed.

## How to read this

**Verification tier** (how a finding was confirmed):

- **automated** — exercised by the CI virtual-authenticator harness (Playwright +
  Chrome DevTools Protocol), each round-trip verified with `p256.verify` (COSE alg −7).
- **manual-device** — confirmed by hand on a named real device.
- **documented** — sourced from MDN / W3C / passkeys.dev and not yet re-confirmed on hardware here.

**Outcome:** ✅ works · ⚠️ partial · ❌ fails · ⛔ unsupported.

## Web support summary

| Feature | Chrome | Safari | Firefox | Edge | Samsung |
| --- | --- | --- | --- | --- | --- |
| `PublicKeyCredential` (WebAuthn) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `navigator.credentials.create()` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `navigator.credentials.get()` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `isUVPAA()` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ES256 (COSE −7) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conditional UI (autofill) | ✅ | ✅ 16+ | ✅ 119+ | ✅ | ✅ |
| `getClientCapabilities()` | ✅ 133+ | ✅ 17.4+ | ✅ 135+ | ✅ 133+ | ✅ 29+ |
| Hybrid / cross-device | ✅ | ✅ | ❔ | ✅ | ✅ |
| Related Origin Requests | ✅ | ❔ | ❌ | ✅ | ✅ |
| `signalAllAcceptedCredentials()` | ✅ 132+ | ✅ 26+ | ❌ | ✅ 132+ | ✅ |

The full per-OS dataset (88 cells, with `since` versions, sources and tiers) lives
in `apps/matrix/data/matrix.<date>.json` and is re-runnable from CI.

## Usage patterns & fallbacks

Each pattern lists what happens, the fallback, what the Soropass SDK does, and the
Soroban-specific note where one applies.

### 1. WebAuthn requires a secure context (HTTPS)

⛔ unsupported on plain HTTP · `documented`

**What happens:** `navigator.credentials` is not exposed on insecure origins (except
`localhost`/`127.0.0.1`).
**Fallback:** serve the wallet over HTTPS; fail early with a clear message on HTTP.
**SDK:** the create/sign ceremonies surface `UNSUPPORTED_AUTHENTICATOR` when the API is absent.
Sources: [MDN — Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) · [W3C WebAuthn §secure-contexts](https://www.w3.org/TR/webauthn-2/#sctn-secure-contexts)

### 2. ES256 only — RS256 cannot verify on Soroban

✅ ES256 works everywhere · ⚠️ RS256 must be refused · `automated` (ES256 round-trip in CI)

**What happens:** ES256 (COSE −7) is the de-facto mandatory WebAuthn algorithm and is
supported by every platform authenticator. RS256 (−257) appears only on some Windows
Hello configurations — and **Soroban verifies secp256r1 only**, so an RS256 credential can
never authorize a smart account.
**Fallback:** offer only ES256 at registration; refuse anything else before a wallet is created.
**SDK:** registration sends `pubKeyCredParams: [{ type: 'public-key', alg: -7 }]`; a non-ES256
credential throws `KitError('ES256_NOT_SUPPORTED')`.
Source: [W3C WebAuthn §alg-identifier](https://www.w3.org/TR/webauthn-3/#sctn-alg-identifier)

### 3. Apple passkeys often return high-S signatures — always normalize to low-S

⚠️ partial without normalization · `manual-device` (macOS/Touch ID) + `automated`

**What happens:** roughly half of Apple (Touch ID / Face ID) assertions return a high-S
ECDSA signature. Soroban's host `secp256r1_verify` does **not** reject high-S, but a
malleable signature is unsafe and some verifiers reject it.
**Fallback:** normalize every signature to low-S client-side before submission.
**SDK:** `derToCompactLowS` / `normalizeLowS` run on the signing path; a unit test feeds a
real high-S signature and asserts low-S out (idempotent). This is the single most common
reason a hand-rolled Stellar passkey flow fails intermittently on iPhone/Mac.
Source: [noble-curves low-S](https://github.com/paulmillr/noble-curves)

### 4. A platform authenticator may be absent

⚠️ partial · `documented`

**What happens:** a desktop without Windows Hello, or a Linux machine without a platform
authenticator, returns `isUVPAA() === false`.
**Fallback:** offer a roaming security key or the cross-device (phone) flow.
**SDK:** the kit module's `isAvailable()` resolves `isUVPAA()` within a 500 ms budget and
never throws; the UI offers cross-device when it is false.
Source: [MDN — isUVPAA](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/isUserVerifyingPlatformAuthenticatorAvailable_static)

### 5. Conditional UI (passkey autofill) is not universal

⚠️ partial · `documented`

**What happens:** `mediation: 'conditional'` drives autofill and is gated behind
`isConditionalMediationAvailable()`; older browsers lag.
**Fallback:** feature-detect; when absent, show an explicit "Sign in with a passkey" button.
**SDK:** always renders the explicit button and layers autofill on top only where available.
Source: [web.dev — passkey autofill](https://web.dev/articles/passkey-form-autofill)

### 6. Discoverable (resident) credentials vary by authenticator

⚠️ partial · `documented`

**What happens:** platform authenticators support discoverable credentials; some roaming
keys have limited or no resident-key storage.
**Fallback:** request `residentKey: 'preferred'` and always persist the `credentialId` so it
can be passed in `allowCredentials` on sign-in.
**SDK:** stores the `credentialId` on create and uses it for `connect()`/`recover()`.
Source: [W3C WebAuthn §residentKey](https://www.w3.org/TR/webauthn-2/#dom-authenticatorselectioncriteria-residentkey)

### 7. `userVerification: 'required'` can break some authenticators

⚠️ partial · `documented`

**What happens:** forcing UV demands a biometric/PIN; a roaming key without a PIN rejects
the ceremony instead of degrading.
**Fallback:** use `'preferred'` for broad compatibility; reserve `'required'` for flows that
genuinely need guaranteed user verification.
Source: [W3C WebAuthn §userVerificationRequirement](https://www.w3.org/TR/webauthn-2/#enum-userVerificationRequirement)

### 8. Safari blocks passkey creation in cross-origin iframes

❌ fails (Safari) · `documented`

**What happens:** WebKit does not expose `credentials.create()` to cross-origin iframes.
**Fallback:** run the create flow in a popup or full-page redirect on the wallet origin;
a `get()` can stay in the frame where the permissions policy allows it.
**SDK:** the UI detects this and routes creation out of the iframe.
Source: [WebKit standards-positions #304](https://github.com/WebKit/standards-positions/issues/304)

### 9. Request no attestation

✅ works · `documented`

**What happens:** direct/enterprise attestation adds consent prompts and privacy concerns,
and platform authenticators often return `none` anyway.
**Fallback:** use `attestation: 'none'`; do not depend on attestation for the trust model.
Source: [W3C WebAuthn §attestation-convey](https://www.w3.org/TR/webauthn-2/#enum-attestation-convey)

### 10. Synced vs device-bound passkeys change recovery

✅ works (synced) · ⚠️ device-bound needs a backup · `documented`

**What happens:** iCloud Keychain and Google Password Manager sync passkeys across a user's
devices; roaming keys and some enterprise setups are device-bound and do not sync.
**Fallback:** do not assume a passkey survives device loss. For device-bound setups, enroll a
second signer up front.
**SDK / Soroban:** `recover()` re-derives a synced passkey's smart-account address by reading
the factory's on-chain `deployed` event over public soroban-rpc — no custodial lookup. Adding
a **new** passkey signer from a new device (multi-signer `add_signer`) is on the roadmap
(Tranche #2); until then, device-loss recovery depends on a synced credential.
Source: [passkeys.dev — terms](https://passkeys.dev/docs/reference/terms/)

### 11. Cross-device (hybrid) sign-in

✅ works · `documented`

**What happens:** a phone can authenticate a desktop over a QR + Bluetooth proximity check;
supported across Chromium and Safari, status on Firefox is unconfirmed.
**Fallback:** offer cross-device when no local authenticator fits; explain the Bluetooth requirement.
Source: [Google — passkey supported environments](https://developers.google.com/identity/passkeys/supported-environments)

### 12. Passkey-to-address discoverability

⚠️ partial · `documented`

**What happens:** the smart-account address derives from the passkey public key, so it is
unknown until the credential exists, and WebAuthn does not let you rename a credential to
carry the address.
**Fallback / SDK:** record the `credentialId → contract-address` mapping at creation and read
it back from the on-chain `deployed` event via the `events` indexer adapter (Mercury optional).
Source: [passkeys.dev — bootstrapping](https://passkeys.dev/docs/use-cases/bootstrapping/)

## Verified device sessions

Real-hardware tests of the reference demo; each entry records only what was confirmed.

| Date | Device | Browser | Authenticator | Outcome | Confirmed |
| --- | --- | --- | --- | --- | --- |
| 2026-06-14 | MacBook (macOS) | Safari, Chrome | Touch ID | ✅ works | Passkey created, smart account deployed, and a passkey-authorized payment signed end-to-end on testnet. |

Additional devices (iPhone/iOS, Android/Chrome, Windows/Edge) are scheduled in the Tier-2
manual protocol below and will be added with their date and result as they are run.

## How cells are verified (tiers)

- **Tier-1 (automated)** — Chromium/Edge via the CDP virtual-authenticator harness, on every
  release and a weekly cron; the local run verified 7/8 grid cells (`transport × residentKey ×
  UV`) via `p256.verify`.
- **Tier-2 (manual / real-device)** — Firefox and Safari/WebKit; automation is feasible
  (geckodriver ≥ 0.35, safaridriver) and documented, on the roadmap. iOS Safari and Android
  stay real-device.

Tier-2 protocol per device: open the demo → `createPasskey` (confirm C-address) → sign an auth
entry (confirm on-chain `__check_auth`) → record `isUVPAA` / conditional-UI / hybrid behaviour →
note any high-S occurrence (the low-S step must still produce a verifying signature).

## Maintenance

The matrix lives as structured data and is regenerated, not edited by hand. A weekly CI cron
re-runs the automated cells and opens a refresh PR; entries carry a last-verified date so a
reader can see what is fresh. Sources for every finding are listed inline above.
