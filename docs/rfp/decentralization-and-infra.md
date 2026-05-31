# Decentralization & infrastructure

The SDK is built so an adopter needs **no proprietary backend** to use it — and
can add managed infra only where they want to.

## Zero mandatory backend

The only infra coupling points are two small adapter interfaces
(`SubmissionAdapter`, `IndexerAdapter` — `packages/core/src/adapters/types.ts`).
The shipped defaults need **nothing but public soroban-rpc**:

- **`directSubmission`** — submits straight to a soroban-rpc node and polls. No
  relayer, no API key. (`adapters/direct.ts`)
- **`eventsIndexer`** — resolves `credentialId → C-address` from soroban-rpc
  `getEvents` on the factory contract. No external indexing service.
  (`adapters/events.ts`)

`@stellar/stellar-sdk` is a **peer dependency** (never bundled), and the RPC URL
is adopter-chosen — point it at SDF's public RPC, your own node, or any provider.
There is no Yk-Labs server in the path.

## Optional managed infra (swap, don't couple)

Higher-throughput or fee-sponsored setups are **drop-in alternatives**, same
interfaces, one-line swap:

- **Submission** — `launchtubeSubmission` (Launchtube relay) or
  `openzeppelinRelayerSubmission` (OZ Relayer / Channels). (`adapters/launchtube.ts`,
  `adapters/ozRelayer.ts`)
- **Indexer** — `mercuryIndexer` (Mercury) instead of on-chain events.
  (`adapters/mercury.ts`)

Adopters opt into these; the SDK never requires them.

## RP-ID / related-origin strategy

Passkeys are **bound to a Relying-Party ID** (the registrable domain). The SDK
takes `rpId` explicitly and the matrix tracks `related-origin requests` /
`getClientCapabilities` support, so wallets can:

- use one `rpId` across sub-apps via **related origins** where supported, and
- fall back to per-origin passkeys where it isn't (the matrix marks which
  browsers support it, with verification tier + date).

## Domain-bound-passkey resilience

A passkey tied to one origin is a single point of failure if that domain is lost.
Mitigations the architecture supports:

- **Discoverable-credential recovery** — `recover()` finds the accounts a passkey
  controls on any device with no stored state (pairs with iCloud Keychain /
  Google Password Manager sync). Recovery is a first-class flow, not an afterthought.
- **Multiple signers per smart account** — because auth is a smart-account
  contract (`__check_auth`), a wallet can register a **second signer from a
  different origin / authenticator** (a backup passkey or a hardware key) so loss
  of one domain or device never strands the account. The on-chain proof
  ([`onchain-verification.md`](../security/onchain-verification.md)) is single-signer
  today; the multi-signer `Map<signerId, signature>` shape is the documented
  next step.
- **No custody, no escrow** — keys live on the user's authenticator; the SDK and
  any relayer only relay already-signed material.
