# Mainnet deploy + 1.0 publish runbook (Deliverable 2)

Human-gated. Run this only after the external audit clears the v0.2 contracts.
Every step spends real XLM or publishes an immutable package. Read each command
before you run it.

Ground truth for what is deployed and proven on testnet: `deployments.json`
(`build` and `testnetV02` blocks). The v0.2 wasm hashes there match a local
build, so a reviewer can reproduce them with `./build.sh`.

Full trust model, design decisions, and audit scope: `contracts/SECURITY.md`.

## Preconditions (all must be true)

1. External audit of `webauthn-account` and `account-factory` is complete and its
   findings are closed. No audit means no mainnet deploy.
2. `@soropass/core` public API is frozen at the v0.2 shape (the `publicKey`
   options on `deriveAccountAddress` and `SorobanSignOptions`, the four-field
   `Secp256r1Signature` struct, the UV-required default). No API changes after
   the freeze without a version bump and a re-review.
3. A funded mainnet deployer identity exists in the `stellar` CLI. Budget: the
   two wasm uploads cost about 43 XLM (webauthn-account, ~31 KB) plus 11 XLM
   (factory) from mainnet fee simulation, and the code entries carry rent (see
   Step 6). Fund the deployer with about 120 XLM to cover uploads, the factory
   deploy, the demo transactions, and the first TTL bumps.
4. `./build.sh` produces the exact wasm hashes recorded in `deployments.json`
   `build.wasm`. If they differ, stop: the source or toolchain drifted. The
   contracts are built against soroban-sdk 27.0.6 on the pinned Rust toolchain
   and are shipped UN-optimized, so `cargo build` reproduces the hash with no
   `stellar contract optimize` / wasm-opt version dependency. Do not run
   `stellar contract optimize` before recording the hash: it would change the
   bytes and break reproducibility for anyone verifying from source.

Note on the platform: mainnet is protocol 27. soroban-sdk 27 wasm is
protocol-27 native. Protocol 28 reaches mainnet 2026-09-16; per the Stellar
adapter guidance, existing deployed contracts are unaffected by a protocol bump.

## Step 1: build and verify the wasm

```
cd contracts
./build.sh
```

Confirm the printed sha256 hashes equal `deployments.json` `build.wasm`.

## Step 2: deploy the contracts to mainnet

`deploy.sh` is network-parameterized. It uploads both wasms and deploys an
`AccountFactory` whose constructor is the account wasm hash.

```
NETWORK=mainnet SOURCE=<funded-mainnet-identity> ./deploy.sh
```

Record the printed `factory_contract_id`, `factory_wasm_hash`, and
`account_wasm_hash` into a new `mainnet` block in `deployments.json`. Verify each
wasm hash on chain equals the local build hash.

RPC: the SDF runs no public mainnet Soroban RPC. `https://mainnet.sorobanrpc.com`
is on the official providers list and is acceptable for the one-off deploy
ceremony, but for anything user-facing pin a contracted provider or self-host,
and set `RPC_URL` accordingly for both `deploy.sh` and the e2e scripts.

## Step 3: prove the flow on mainnet

Run the same e2e scripts that proved testnet, pointed at mainnet. Each needs the
mainnet RPC, the mainnet passphrase, a funded `SOURCE_SECRET`, and the new
`FACTORY_ID`. The passkey-signed payment is `transfer-e2e.ts`.

```
export RPC_URL=<mainnet RPC>
export FACTORY_ID=<mainnet factory>
export SOURCE_SECRET=<funded mainnet secret>

pnpm --filter @soropass/core exec tsx scripts/factory-e2e.ts     # deploy + enrollment
pnpm --filter @soropass/core exec tsx scripts/transfer-e2e.ts    # passkey-signed PAYMENT
pnpm --filter @soropass/core exec tsx scripts/recovery-e2e.ts    # add/remove signer
pnpm --filter @soropass/core exec tsx scripts/derive-check-e2e.ts # offline derive === deployed
```

These scripts pin `NETWORK = Networks.TESTNET` and the testnet SAC/native asset
id. Before the mainnet run, thread the network passphrase and the mainnet native
SAC id through from the environment (they already read `RPC_URL`). Record the
resulting tx hashes and Stellar Expert links in `deployments.json` `mainnet`. The
demo app (`apps/demo`) also hardcodes testnet in `onchainDemo.ts` and
`v1Demo.ts`; gate the passkey-kit v1 demo OFF mainnet (that wasm is unaudited).

## Step 3b: extend the code-entry and factory-instance TTL (rent ops)

The account contract extends its OWN instance TTL on every use, but a contract
cannot extend the shared WASM CODE entry, which has a separate TTL. If the
`webauthn-account` code entry archives (about 120 days after upload at the
mainnet minimum), EVERY account stops validating until it is restored. So, right
after deploy and on a recurring schedule (at least quarterly):

```
stellar contract extend --id <factory_contract_id> --ledgers-to-expire 3110400 \
  --source <SOURCE> --rpc-url <mainnet RPC> --network-passphrase "$PASSPHRASE"
# and extend the two code entries (account wasm hash, factory wasm hash) to the max
```

Code rent at current mainnet rates is roughly 131 XLM/yr for the account wasm and
34 XLM/yr for the factory. Budget for it and calendar the re-extend.

## Step 4: publish the packages

`@soropass/core` has no workspace dependencies, so plain npm is fine:

```
cd packages/core && npm publish --access public
```

`@soropass/ui` and `@soropass/ui-react` depend on workspace packages. Publish
them with `pnpm`, which rewrites `workspace:^` to the concrete `^0.2.0` range.
Plain `npm publish` would ship a broken `workspace:^` range.

```
pnpm --filter @soropass/ui publish
pnpm --filter @soropass/ui-react publish
```

Publish order: `@soropass/core`, then `@soropass/ui`, then `@soropass/ui-react`,
so each dependency resolves on the registry before its dependents.

The publisher account (`jmert`) uses a security-key 2FA, so run these from a real
macOS Terminal where the browser WebAuthn flow can complete. The chat `!` prefix
is not a TTY and cannot complete it.

## Step 5: record and confirm

Install each package from the registry in a clean directory and import it, to
confirm the published artifact resolves. Add the mainnet contract ids, wasm
hashes, and passkey-signed mainnet tx hashes (with Stellar Expert links) to
`deployments.json`. That evidence is what closes Deliverable 2.

## Version note

Local versions are `0.2.0` (core, ui, ui-react). The funded deliverable names a
`1.0`. Ship `0.x` until the audit clears, then cut `1.0` at the freeze. Keep the
three packages on the same version line, because the contract wire shape links
them.
