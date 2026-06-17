# SoroPass

**Passkey sign-in for Stellar smart accounts.** Create and operate a Soroban smart
account with a device passkey (Face ID, Touch ID, or a security key) instead of a
seed phrase. The signature is a WebAuthn `secp256r1` assertion that the account
contract verifies on-chain (Protocol 21 / CAP-0051).

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-000.svg)](https://stellar.org)
[![WebAuthn](https://img.shields.io/badge/WebAuthn-secp256r1%20ES256-7c3aed.svg)](https://www.w3.org/TR/webauthn-2/)

- **Live demo:** https://soropass.dev
- **Docs:** https://docs.soropass.dev/docs
- **Compatibility matrix:** https://docs.soropass.dev/docs/compatibility

[![SoroPass live testnet demo](https://github.com/user-attachments/assets/ae695478-4335-4ff4-b5ed-d13f20ed24af)](https://soropass.dev)

## In the open

We started the conversation upstream, in public, with the two teams whose work
this builds on:

- **Proposing a passkey module** for Stellar Wallets Kit, so any
  kit-based wallet can offer passkey sign-in by registering one module:
  [Creit-Tech/Stellar-Wallets-Kit #95](https://github.com/Creit-Tech/Stellar-Wallets-Kit/issues/95)
- **Aligning the smart-wallet auth-entry wire shape** with passkey-kit, whose
  secp256r1 work SoroPass ports and hardens:
  [kalepail/passkey-kit #32](https://github.com/kalepail/passkey-kit/issues/32)

## Proven on testnet

Every step runs against live testnet and is reproducible from
`packages/core/scripts`. A passkey-signed `SorobanAuthorizationEntry` passes a
real deployed `__check_auth` / `secp256r1_verify`, and a wrong key is rejected
on-chain:

| Step | Kind | On-chain proof (testnet) |
| --- | --- | --- |
| Passkey-authorized payment | tx | [`58cd5d6307acc61d830bdb8b3a7299761bcf6435ddf0065f652e635457f5cc60`](https://stellar.expert/explorer/testnet/tx/58cd5d6307acc61d830bdb8b3a7299761bcf6435ddf0065f652e635457f5cc60) |
| Wrong key rejected on-chain | tx | [`2a89cc6f38b2af4c59fbea37ac77e426a0092060a6be2842ec2cb6b0b9645a61`](https://stellar.expert/explorer/testnet/tx/2a89cc6f38b2af4c59fbea37ac77e426a0092060a6be2842ec2cb6b0b9645a61) |
| Create, deploy, then `__check_auth` | tx | [`95cc2693764384f0b1b32bd5b0510573decc19b749a812a6292f9c3b272a55f6`](https://stellar.expert/explorer/testnet/tx/95cc2693764384f0b1b32bd5b0510573decc19b749a812a6292f9c3b272a55f6) |
| Smart-account contract | contract | [`CBDOCYVDUBEGLZKT6OFMXBFLY5MTVHHHA6X7ARWHHLLTPFT5FTE3DFQ7`](https://stellar.expert/explorer/testnet/contract/CBDOCYVDUBEGLZKT6OFMXBFLY5MTVHHHA6X7ARWHHLLTPFT5FTE3DFQ7) |
| AccountFactory | contract | [`CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM`](https://stellar.expert/explorer/testnet/contract/CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM) |

## Install

```bash
pnpm add @soropass/core
pnpm add @stellar/stellar-sdk   # peer dependency, never bundled by the SDK
```

Runtime dependencies are only `@noble/curves` and `@noble/hashes`.

## Quick start

```ts
import {
  createPasskey,
  browserPasskeySigner,
  signTransaction,
  connect,
} from '@soropass/core'

// 1. Create a passkey and deploy its smart account (ES256 only).
const { contractId, credentialId } = await createPasskey({ rpId: 'wallet.example' })

// 2. Sign a Soroban transaction with the passkey (low-S enforced automatically).
const signer = browserPasskeySigner({ rpId: 'wallet.example', credentialId })
const signedXdr = await signTransaction(txXdr, { networkPassphrase, sign: signer })

// 3. Reconnect later from the passkey alone, no stored address needed.
const account = await connect({ rpId: 'wallet.example' })
```

Drop-in UI is optional and ships without a framework dependency:

```ts
import { mountCreateScreen } from '@soropass/ui/styled' // themeable via tokens.css
```

See the [docs](https://docs.soropass.dev/docs) for the full API and options.

## Packages

| Package | What it does |
| --- | --- |
| `@soropass/core` | Passkey ceremonies, ES256 + low-S crypto, Soroban auth assembly, and pluggable adapters. |
| `@soropass/ui` | Headless create / sign / recover logic, plus an optional token-themeable styled layer. |
| `@soropass/wallets-kit-module` | A `PasskeyModule` for [@creit.tech/stellar-wallets-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit). |
| `contracts/` | The `webauthn-account` and `account-factory` Soroban contracts (Rust). |
| `apps/landing` | The soropass.dev site and its live testnet passkey demos. |
| `apps/matrix` | The compatibility dataset and the virtual-authenticator CI. |

## How a passkey signs a transaction

1. The SDK derives the signing challenge from the Soroban authorization preimage
   (`sha256(XDR(HashIdPreimage::SorobanAuthorization{ … }))`), so a signature is
   bound to exactly one transaction.
2. The browser returns a WebAuthn assertion. The SDK converts the DER signature to
   compact `r‖s` and normalizes it to **low-S**.
3. It packs `{ authenticator_data, client_data_json, signature }` into the
   `Secp256r1Signature` value the contract expects.
4. On-chain, `webauthn-account.__check_auth` re-derives
   `sha256(authenticatorData ‖ sha256(clientDataJSON))` and verifies it with the
   host `secp256r1_verify`.

Two rules are enforced for you, because both silently break otherwise: the SDK
offers **only ES256** at registration (Soroban verifies `secp256r1`), and it
**always normalizes to low-S** (about half of Apple's authenticators return
high-S). Failures surface as a typed `KitError`.

## Browser and device compatibility

Passkey behaviour varies across browsers, authenticators, and embedding contexts.
The living [compatibility matrix](https://docs.soropass.dev/docs/compatibility)
documents what works, what breaks, and the fallback for each case. It is backed by
the data pipeline in `apps/matrix`.

Chrome and Chromium are verified automatically on every CI run, a virtual
authenticator create, sign, and verify grid. Firefox and Safari / WebKit are
checked manually for now. The macOS and Touch ID path has been confirmed by hand,
end to end, on testnet.

## Adapters

Submission and account lookup are swappable, with zero-infrastructure defaults:

- **Submission:** `direct` (public soroban-rpc, the default), `launchtube`,
  `openzeppelinRelayer`.
- **Indexer:** `events` (reads the factory's on-chain event, the default),
  `mercury`.

The default `direct` and `events` pair needs no API key and no server.

## Development

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm -r build      # tsup → ESM + CJS + types
pnpm -r test       # vitest
```

```bash
# virtual-authenticator compatibility run
pnpm --filter @soropass/matrix matrix:ci
# live testnet end-to-end (needs a funded key)
SOURCE_SECRET=... pnpm --filter @soropass/core exec tsx scripts/onchain-e2e.ts
```

## Status

The SDK, the contracts (deployed and verified on testnet), the headless and styled
UI, and the compatibility CI are in place. The `stellar-wallets-kit` module
implements the kit's `ModuleInterface` and is tested against it. The upstream pull
request, multi-device recovery, and the mainnet launch are the next milestones.

Built on the secp256r1 work from
[passkey-kit](https://github.com/kalepail/passkey-kit) and the smart-account
direction, and kept compatible with OpenZeppelin's audited Soroban Smart Accounts.

## License

[Apache-2.0](./LICENSE).
