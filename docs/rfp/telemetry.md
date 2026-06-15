# Telemetry — opt-in, privacy-respecting

## Today: zero telemetry

The SDK ships **no telemetry**. There is no analytics SDK, no network beacon, no
phone-home — grep the source: `packages/**` contains no `fetch`/`sendBeacon`/
analytics call outside the explicit, user-configured submission/indexer adapters
(which talk only to the RPC URL the adopter provides). Installing
`@soropass/core` sends nothing anywhere by default.

## If/when field data is added: opt-in by design

Browser/OS passkey behavior shifts under us (the exact reason the matrix exists),
so aggregate field data is valuable — but it must never compromise users. The
design constraints, should an adopter enable it:

- **Off by default. Explicit consent required** — a wallet must call an
  `enableTelemetry({ endpoint })` opt-in; nothing is collected until it does.
- **No PII, ever** — no addresses, no user handles, no IPs retained.
- **No credential data** — never the credential id, public key, `authenticatorData`,
  `clientDataJSON`, challenge, or signature. Cryptographic material never leaves
  the device.
- **Minimal aggregate only** — `{ flow, outcome (success | KitErrorCode), browser,
os }`. That is enough to spot "Create fails on Safari 19 / iOS" without
  identifying anyone.
- **Self-host option** — the endpoint is adopter-supplied; no data flows to us by
  default. A reference aggregator can be self-hosted; no proprietary service.
- **Transparent + revocable** — documented schema, one call to disable, honors
  Global Privacy Control / Do-Not-Track.

This keeps the "protect users" bar: the privacy-preserving default is **collect
nothing**, and any collection is opt-in, consented, aggregate, and PII-free.
