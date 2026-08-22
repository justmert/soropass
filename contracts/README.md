# contracts/

Reference Soroban smart-account contracts (Rust) for passkey (secp256r1) auth.

- **webauthn-account** (v0.2) — a multi-signer secp256r1 smart account.
  `__check_auth` binds `clientDataJSON.challenge` to the Soroban authorization
  payload, parses `clientDataJSON` (serde-json-core), enforces `type ==
"webauthn.get"`, the User-Present and User-Verified flags, and the Backup
  Eligibility/State relationship, rebuilds `sha256(authenticatorData ‖
sha256(clientDataJSON))`, and verifies it with the host-native
  `secp256r1_verify` (Protocol 21 / CAP-0051). The signature struct carries the
  `public_key` of the signer, which must be enrolled. `add_signer` and
  `remove_signer` (each gated by the account's own `__check_auth`) enroll or
  revoke further passkeys for multi-device recovery; the last signer can never
  be removed. Every authorized use extends the instance TTL.
- **account-factory** (v0.2) — deploys a `webauthn-account` deterministically
  (salt = `sha256(credential_id ‖ public_key)`) and emits `("deployed",
credential_id, public_key) -> address` so a credential can be mapped back to
  its smart-account address from on-chain events. Binding the public key into the
  salt prevents address squatting: a credential id is public, so salting by it
  alone let anyone pre-deploy at a victim's derived address with their own key.
  Because deploy is permissionless a credential id is not exclusive, so a
  resolver must verify enrollment against `public_key` (compare the event key,
  call `is_signer`, or re-derive the address) before trusting a resolved account.

The verification checklist mirrors the audited OpenZeppelin Soroban Smart Account
webauthn verifier (`references/stellar-contracts`), and the account keeps the same
`CustomAccountInterface` shape, so SDK output verifies against production accounts.
These are Rust/Soroban crates, not pnpm workspace members.

Build reproducibly with `./build.sh` (pinned toolchain in `rust-toolchain.toml`).
Deployed addresses, proof transactions, and build provenance (wasm hashes +
toolchain) are recorded in `deployments.json`.
