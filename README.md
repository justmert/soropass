# SoroPass

Passkey sign-in for Stellar smart accounts. SoroPass lets a wallet create and
operate a Soroban smart account with a device passkey — Face ID, Touch ID, a
security key — instead of a seed phrase. The signature is a WebAuthn `secp256r1`
assertion the account contract verifies on-chain (Protocol 21 / CAP-0051).

[Website](https://soropass.dev) · [Docs](https://docs.soropass.dev) · [Live demo](https://demo.soropass.dev)

## Install

```bash
pnpm add @soropass/core
pnpm add @stellar/stellar-sdk   # peer dependency — never bundled by the SDK
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

// 3. Reconnect later from the passkey alone — no stored address needed.
const account = await connect({ rpId: 'wallet.example' })
```

Drop-in UI is optional and ships without a framework dependency:

```ts
import { mountCreateScreen } from '@soropass/ui/styled' // themeable via tokens.css
```

See the [docs](https://docs.soropass.dev) for the full API and options.

## Packages

| Package | What it does |
| --- | --- |
| `@soropass/core` | Passkey ceremonies, ES256 + low-S crypto, Soroban auth assembly, and pluggable adapters. |
| `@soropass/ui` | Headless create / sign / recover logic, plus an optional token-themeable styled layer. |
| `@soropass/wallets-kit-module` | A `PasskeyModule` for [@creit.tech/stellar-wallets-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit). |
| `contracts/` | The `webauthn-account` and `account-factory` Soroban contracts (Rust). |
| `apps/matrix` | The compatibility dataset and the virtual-authenticator CI. |
| `apps/demo` | The reference app, the embeddable preview, and the on-chain testnet demo. |

## How a passkey signs a transaction

1. The SDK derives the signing challenge from the Soroban authorization preimage
   (`sha256(XDR(HashIdPreimage::SorobanAuthorization{ … }))`), so a signature is
   bound to exactly one transaction.
2. The browser returns a WebAuthn assertion; the SDK converts the DER signature to
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

## On-chain verification (testnet)

Every step has been run against live testnet and is reproducible from
`packages/core/scripts`:

| Step | Transaction |
| --- | --- |
| Passkey-authorized payment | [58cd5d6…](https://stellar.expert/explorer/testnet/tx/58cd5d6307acc61d830bdb8b3a7299761bcf6435ddf0065f652e635457f5cc60) |
| Wrong key rejected on-chain | [2a89cc6…](https://stellar.expert/explorer/testnet/tx/2a89cc6f38b2af4c59fbea37ac77e426a0092060a6be2842ec2cb6b0b9645a61) |
| Create → deploy → `__check_auth` | [95cc269…](https://stellar.expert/explorer/testnet/tx/95cc2693764384f0b1b32bd5b0510573decc19b749a812a6292f9c3b272a55f6) |
| Smart-account contract | [CBDOCYVD…](https://stellar.expert/explorer/testnet/contract/CBDOCYVDUBEGLZKT6OFMXBFLY5MTVHHHA6X7ARWHHLLTPFT5FTE3DFQ7) |
| AccountFactory | [CBVGSJEI…](https://stellar.expert/explorer/testnet/contract/CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM) |

## Browser & device compatibility

Passkey behaviour varies across browsers, authenticators, and embedding contexts.
The full compatibility reference — what works, what breaks, and the fallback for
each case — lives in [`docs/compatibility.md`](docs/compatibility.md) and is
backed by data in `apps/matrix`.

Chrome/Chromium is verified automatically on every CI run (a virtual-authenticator
create → sign → verify grid). Firefox and Safari/WebKit are checked manually for
now; the macOS / Touch ID path has been confirmed by hand end-to-end on testnet.

## Adapters

Submission and account lookup are swappable, with zero-infrastructure defaults:

- **Submission** — `direct` (public soroban-rpc, default), `launchtube`, `openzeppelinRelayer`.
- **Indexer** — `events` (reads the factory's on-chain event, default), `mercury`.

The default `direct` + `events` pair needs no API key and no server.

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

The SDK, contracts (deployed and verified on testnet), headless and styled UI, and
the compatibility CI are in place. The `stellar-wallets-kit` module implements the
kit's `ModuleInterface` and is tested against it; the upstream pull request,
multi-device recovery, and the mainnet launch are the next milestones.

Built on the secp256r1 work from passkey-kit / smart-account-kit and kept
compatible with OpenZeppelin's audited Soroban Smart Accounts.

## License

[Apache-2.0](./LICENSE).
