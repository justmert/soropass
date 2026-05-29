# contracts/

Reference Soroban `webauthn-wallet` / smart-account contracts (Rust), kept
**OZ-compatible** with the audited Smart Account contracts in
`references/stellar-contracts/`. We do **not** reinvent the contract layer — see
CLAUDE.md invariant on staying compatible.

This directory is intentionally a placeholder in the S01 skeleton. The reference
contract material is wired up alongside the Soroban auth assembly work in
S11 (YK-437). It is **not** a pnpm workspace member (it is a Rust/Soroban crate
tree, not a JS package).
