# Integration design — `PasskeyModule` for `@creit-tech/stellar-wallets-kit`

**Studied version: `@creit-tech/stellar-wallets-kit` `2.2.0`** (pinned; verified
against `references/Stellar-Wallets-Kit/src/types/mod.ts` and `src/sdk/kit.ts`).
This doc is the design that S17 implements and the technical substance we bring
to **Issue #90** (S25).

## Interface map (the contract a module implements)

A module is a plain class that `implements ModuleInterface` (there is **no**
abstract base class, and no separate `KitActions` type — the issue's
`ModuleInterface extends KitActions` framing is approximate; in v2.2.0 every
method lives directly on `ModuleInterface`). Metadata + the five methods:

| Member                            | Signature (v2.2.0)                                                                | PasskeyModule mapping                                                    |
| --------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `moduleType`                      | `ModuleType` enum: `HW_WALLET \| HOT_WALLET \| BRIDGE_WALLET \| AIR_GAPED_WALLET` | `HOT_WALLET` (no smart-account type exists — see open Q)                 |
| `productId`                       | `string`                                                                          | `"passkey"`                                                              |
| `productName`                     | `string`                                                                          | `"Passkey (Smart Account)"`                                              |
| `productUrl`                      | `string`                                                                          | docs URL                                                                 |
| `productIcon`                     | `string`                                                                          | icon URL                                                                 |
| `isAvailable()`                   | `Promise<boolean>` (JSDoc: <1000ms)                                               | `isUVPAA()` behind a **500 ms** timeout guard (issue budget)             |
| `getAddress(params?)`             | `Promise<{ address: string }>`                                                    | `connect()` (or `createPasskey()` if none) → **smart-account C-address** |
| `signTransaction(xdr, opts?)`     | `Promise<{ signedTxXdr; signerAddress? }>`                                        | core `signTransaction` (S11) via a WebAuthn signer                       |
| `signAuthEntry(authEntry, opts?)` | `Promise<{ signedAuthEntry; signerAddress? }>`                                    | core `signAuthEntry` (S11)                                               |
| `signMessage(message, opts?)`     | `Promise<{ signedMessage; signerAddress? }>`                                      | WebAuthn assertion over the message hash (semantics: open Q)             |
| `getNetwork()`                    | `Promise<{ network; networkPassphrase }>`                                         | configured network                                                       |

Optional members we may implement: `disconnect()`, `onChange()`,
`signAndSubmitTransaction()` (pairs naturally with our SubmissionAdapter).

Signatures align with **SEP-43** (`signTransaction`/`signAuthEntry`/`signMessage`),
which is exactly what S11's Soroban auth assembly produces.

## Registration (how the wallet is added)

```ts
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit';
import { PasskeyModule } from './passkey.module';

StellarWalletsKit.init({
  modules: [new PasskeyModule({ rpId, rpName, networkPassphrase, ...adapters }) /* …others */],
});
StellarWalletsKit.setWallet('passkey'); // selects by productId
```

`init` stores `modules`; `setWallet(productId)` selects the active module; all
subsequent kit calls delegate to it. New wallets are added **by PR** to the kit's
`src/sdk/modules/` — which is exactly the upstream PR path (S17 branch → S27 PR).

## The hard part — C-address reconciliation

The kit's `getAddress()` returns `{ address: string }` with **no G/C distinction**
and no account-type metadata (grep of v2.2.0 finds zero C-address handling). Our
passkey wallet is a **Soroban smart account**, so `getAddress()` returns a
**`C…` contract address**, not a classic `G…` account.

Consequences and our stance:

- The kit core is address-string-agnostic, so a C-address flows through fine.
- **Downstream dApps** that assume `G…` (e.g. building classic-account ops, or
  calling Horizon `accounts/{id}`) will mishandle a C-address. Adopters must use
  the **Soroban** path: build `InvokeHostFunction` ops, authorize via
  `signAuthEntry`, submit via RPC. `signTransaction` still works for a tx whose
  auth entries are ours.
- This is the single most important thing to confirm with the maintainers
  (Issue #90): does the kit want a typed signal for contract accounts?

## Sequence

```mermaid
sequenceDiagram
  participant dApp
  participant Kit as StellarWalletsKit
  participant M as PasskeyModule
  participant WA as WebAuthn / authenticator
  participant RPC as soroban-rpc

  dApp->>Kit: init({ modules:[PasskeyModule] }) ; setWallet('passkey')
  dApp->>Kit: getAddress()
  Kit->>M: getAddress()
  M->>WA: connect (silent) / create (new)
  M->>RPC: resolveByCredential (IndexerAdapter)
  M-->>dApp: { address: "C…" }  (smart account)
  dApp->>Kit: signTransaction(xdr)
  Kit->>M: signTransaction(xdr)
  M->>M: authEntryChallenge (S11 preimage)
  M->>WA: get() → assertion
  M->>M: derToCompactLowS + assemble (S11)
  M-->>dApp: { signedTxXdr }
  dApp->>RPC: submit (SubmissionAdapter)
```

## Proposed module shape

```ts
export class PasskeyModule implements ModuleInterface {
  moduleType = ModuleType.HOT_WALLET;
  productId = 'passkey';
  productName = 'Passkey (Smart Account)';
  productUrl = '…';
  productIcon = '…';

  constructor(private cfg: { rpId; rpName; networkPassphrase; indexer; submission; deployer; webauthn? }) {}

  async isAvailable() { return withTimeout(isUVPAA(), 500, false); }      // ≤500 ms
  async getAddress() { return { address: (await this.connectOrCreate()).contractId }; }
  async signTransaction(xdr, opts) {
    return { signedTxXdr: await coreSignTransaction(xdr, { networkPassphrase: opts?.networkPassphrase ?? this.cfg.networkPassphrase, sign: this.webAuthnSigner }), signerAddress: this.address };
  }
  async signAuthEntry(authEntry, opts) { return { signedAuthEntry: await coreSignAuthEntry(authEntry, { … }), signerAddress: this.address }; }
  async signMessage(message, opts) { /* WebAuthn assertion over hash(message); see open Q */ }
  async getNetwork() { return { network, networkPassphrase: this.cfg.networkPassphrase }; }
}
```

`isAvailable` budget: `withTimeout(isUVPAA(), 500, false)` resolves `false` if the
platform-authenticator probe exceeds 500 ms (well inside the spec's 1000 ms).

## Open questions for the maintainers (seed Issue #90 / S25)

1. **Contract accounts:** Is the kit open to a typed signal for C-address
   (smart-account) modules, or should `getAddress()` stay an opaque string and
   downstream dApps opt into Soroban handling?
2. **`signMessage` for a contract account:** there is no standard way to verify a
   smart-account "message signature" on-chain. Reject, or define a SEP-53-style
   envelope? What do existing consumers expect?
3. **`signAndSubmitTransaction`:** should a passkey smart-account module implement
   it (it maps cleanly onto our SubmissionAdapter), and does the kit prefer it for
   account-abstraction wallets?
4. **`path` parameter:** unused for passkeys — OK to ignore, or repurpose as a
   credential-id / signer index?
5. **`moduleType`:** none of the four enum values fit a smart-account wallet — add
   a `SMART_ACCOUNT` / `CONTRACT_WALLET` type, or keep `HOT_WALLET`?
