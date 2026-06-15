# On-chain verification — passkey auth proven on Stellar testnet (real, not mock)

This is the **live** proof that an authorization entry assembled and signed by
`@soropass/core` is accepted by a real deployed `__check_auth` on Stellar
**testnet** — closing the gap between "the crypto verifies in a JS model
(`referenceCheckAuth`)" and "the network accepts it."

## What is proven

- A `SorobanAuthorizationEntry` built by `signTransaction` / `signAuthEntry`
  (challenge bound to the Soroban auth preimage → WebAuthn assertion → **low-S**
  64-byte compact secp256r1 → `Secp256r1Signature` ScVal) passes the host
  `secp256r1_verify` inside a deployed custom-account contract's `__check_auth`.
- A **wrong key** is rejected on-chain (the host crypto traps).

| Run      | Key                                | On-chain result                      |
| -------- | ---------------------------------- | ------------------------------------ |
| Positive | the account's registered P-256 key | **SUCCESS**                          |
| Negative | a different P-256 key              | **FAILED** (`secp256r1_verify` trap) |

Reference run (testnet):

- Contract: `CB3IBD2JTLOFPLT4JFJ3KOIALDTKUMGLSSDZTOK7W2YWCZTPTZU66XB2`
- Success tx: `f256288c75f4865f40d409d22eb1ebe2e48ebd7fdb8ed028ad6d13e4d3ed8418`
  (https://stellar.expert/explorer/testnet/tx/f256288c75f4865f40d409d22eb1ebe2e48ebd7fdb8ed028ad6d13e4d3ed8418)

## The contract (`contracts/webauthn-account`)

A minimal single-signer custom account whose `__check_auth` mirrors the audited
OpenZeppelin / kalepail webauthn verifiers: it binds
`clientDataJSON.challenge == base64url(signature_payload)` and runs
`secp256r1_verify(pubkey, SHA256(authenticator_data ‖ SHA256(client_data_json)), signature)`.
It expects the signature as the plain `Secp256r1Signature` struct
(`{authenticator_data, client_data_json, signature}`) — the exact ScVal shape the
SDK now assembles (see `packages/core/src/soroban/assemble.ts`).

## How to run it yourself

Requires the `stellar` CLI, a Rust toolchain with `wasm32v1-none`, and testnet
egress.

```bash
# 1. build + deploy the contract with a P-256 public key (SEC-1, 65 bytes hex)
cd contracts/webauthn-account && stellar contract build
PUBKEY=$(node -e "import('@noble/curves/nist').then(({p256})=>process.stdout.write(Buffer.from(p256.getPublicKey(new Uint8Array(32).fill(7),false)).toString('hex')))")
stellar keys generate pk-onchain --network testnet --fund
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/webauthn_account.wasm \
  --source pk-onchain --network testnet -- --public_key "$PUBKEY")

# 2. run the live e2e (positive + negative)
cd ../../packages/core
CONTRACT_ID=$CONTRACT_ID SOURCE_SECRET=$(stellar keys show pk-onchain) \
  pnpm exec tsx scripts/onchain-e2e.ts
```

## Notes for integrators (two real gotchas this surfaced)

1. **The signature wire shape is contract-specific.** Real webauthn accounts
   (OZ, kalepail) consume the `Secp256r1Signature` struct directly (multi-signer
   wallets key it by signer id in a `Map`). The SDK assembles the single-signer
   struct; a `Map<signerId, …>` wrapper is a small per-contract addition.
2. **Simulation under-budgets `__check_auth`.** `simulateTransaction` records the
   required auth but does **not** execute `secp256r1_verify`, so the CPU
   instruction estimate is too low and a naive submit fails with
   `ExceededLimit`. Inflate the Soroban instruction budget + resource fee before
   submitting (see `scripts/onchain-e2e.ts`). Production submitters
   (Launchtube, relayers) handle this for you.

This script is **not** part of CI (it needs a live network + a deployed
contract + a funded key); it's a manual, reproducible proof.
