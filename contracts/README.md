# contracts/

Reference Soroban smart-account contracts (Rust) for passkey (secp256r1) auth.

- **webauthn-account** — a single-signer secp256r1 smart account. `__check_auth`
  binds `clientDataJSON.challenge` to the Soroban authorization payload, rebuilds
  `sha256(authenticatorData ‖ sha256(clientDataJSON))`, and verifies it with the
  host-native `secp256r1_verify` (Protocol 21 / CAP-0051).
- **account-factory** — deploys a `webauthn-account` deterministically
  (salt = `sha256(credential_id)`) and emits `("deployed", credential_id) -> address`
  so a credential can be mapped back to its smart-account address from on-chain events.

Kept compatible with the audited OpenZeppelin Soroban Smart Account contracts — the
same `CustomAccountInterface` shape — so SDK output verifies against production
accounts. These are Rust/Soroban crates, not pnpm workspace members.

Deployed testnet addresses and proof transactions are recorded in `deployments.json`.
