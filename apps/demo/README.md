# SoroPass demo: passkey wallet inside Stellar Wallets Kit

Live at [demo.soropass.dev](https://demo.soropass.dev). A guided testnet test run for the
`PasskeyModule`: five steps, each a `StellarWalletsKit` call the page verifies itself
(connect through the kit picker, sign, wrong key rejected on-chain, reconnect, returning
visitor with offline derivation), plus one row per remaining kit call with its response.

Every button calls `StellarWalletsKit`, never the module directly, so what the page
exercises is the integration.

## The vendored kit (`./kit`)

The `PasskeyModule` is not merged upstream yet, so `@creit.tech/stellar-wallets-kit`
resolves to `./kit`: the npm build (`deno task build-npm`) of our fork with the module
included. `@soropass/core` resolves to the workspace package through a root pnpm
override, because the kit build declares `^0.2.0` and that version is not published yet.
When the upstream PR merges and core publishes, the vendored copy and the override go
away in favor of the real packages.

To refresh the vendored build after changing the module in the fork:

```bash
cd references/swk-main/src && deno task build-npm
rm -rf apps/demo/kit && cp -R references/swk-main/src/dist apps/demo/kit
```

## Run it

```bash
pnpm install
pnpm --filter @soropass/core build
pnpm --filter @soropass/demo dev    # http://localhost:5273
```

## Networks and modes

The page runs on testnet. It creates a throwaway friendbot-funded account in
`sessionStorage` to pay fees, deploys a real v0.2.1 smart account through the factory in
`src/backends.ts`, and submits real transactions. The transaction the passkey authorizes
is `add_signer` (enrolling a new device key), the account's own auth-gated call, which
needs no XLM in the account itself.

Two more modes exist for the automated suite only, selected with `?mode=` and never
offered in the UI: `?mode=mock` (in-memory accounts, deterministic in-process
authenticator) and `?mode=local` (in-memory accounts, real WebAuthn). Steps 3 and 5 need
the chain and are disabled there.

## Automated tests

```bash
pnpm --filter @soropass/demo exec playwright test
```

12 tests in Chromium drive the kit's real modal with a CDP virtual authenticator in
`?mode=local`; 3 more run in each of Firefox and WebKit. They cannot cover a real
authenticator, a phone, a security key, or the chain, which is what the five steps on the
page are for.
