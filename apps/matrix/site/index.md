---
layout: home
hero:
  name: Stellar Passkey
  text: Passkey sign-in for Stellar smart accounts
  tagline: Face ID / Touch ID / security keys instead of seed phrases. Minimal, headless, ES256-only — and proven on-chain on testnet.
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Integrate a wallet
      link: /integration
    - theme: alt
      text: API reference
      link: /api/
features:
  - title: Minimal SDK core
    details: '@stellar-passkey/core — ES256-only, always low-S-normalized, pluggable submission/indexer adapters. @stellar/stellar-sdk stays a peer dep (never bundled).'
  - title: Proven on-chain
    details: A passkey-signed SorobanAuthorizationEntry assembled by the SDK passes a real deployed __check_auth on testnet (positive SUCCESS, wrong-key FAILED). Not a mock.
  - title: stellar-wallets-kit module
    details: A drop-in PasskeyModule implements the kit's ModuleInterface — getAddress → C-address, sign via the SDK, isAvailable → isUVPAA in <500ms.
  - title: Headless-first UI
    details: Framework-agnostic create/sign/recover primitives (logic + a11y + i18n) plus an optional token-driven styled layer. Re-theme by overriding CSS tokens only.
  - title: Living compatibility matrix
    details: A dated, diffable WebAuthn/passkey matrix merged from MDN BCD + live feature-detection + virtual-authenticator CI — sourced, not asserted from memory.
  - title: Security, documented
    details: Low-S malleability, challenge/replay, RP-ID binding and recovery are written up in the threat model, each tied to a battle-tested anchor.
---
