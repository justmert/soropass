# SCF #43 — Submission pack

The spine of the bid: what was built, how it maps to how reviewers score, and the
budget. Everything below points at a concrete artifact in this repo or a tracked
issue. Where something is **pending** (human outreach, upstream PR) it is marked
as such — no aspirational claims.

> Note: the exact published evaluation wording and the "Ishan" reference are being
> verified in Discord (S26, human) before final submission; the crosswalk below
> uses the criteria as stated in the RFP brief.

## What already exists (proof-of-capability, this sprint)

- **Living compatibility matrix** — sourced (MDN BCD) + live feature-detection +
  virtual-authenticator CI, dated/diffable, published. (S05–S10)
- **Minimal SDK** `@soropass/core` — ES256-only, always low-S, pluggable
  adapters; **proven on testnet** (a passkey-signed auth entry passes a real
  deployed `__check_auth`). (S03–S15, `docs/security/onchain-verification.md`)
- **`PasskeyModule`** for `@creit.tech/stellar-wallets-kit` v2.2.0 (branch + tests). (S16–S17)
- **Headless + styled UI** (design-gated), token-re-themeable, a11y. (S18–S20)
- **Docs site** — quickstart + kit integration + generated API + matrix + security. (S22)
- **RFP artifacts** — license, maintenance, telemetry, decentralization. (S23)

## Budget / tranche map — $100,000 (SCF 7.0: 10 / 20 / 30 / 40)

| Tranche | %   | Amount       | Milestone (gate to release)                                                                      | Status                                                                                                   |
| ------- | --- | ------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **T0**  | 10% | $10,000      | Matrix v0 + CI spine + maintainer-coordination note                                              | ✅ built this sprint (S05–S10, S16)                                                                      |
| **T1**  | 20% | $20,000      | SDK alpha: ES256 + **low-S** anchors + Chromium/Edge virtual-auth CI + on-chain proof            | ✅ built (S03–S15)                                                                                       |
| **T2**  | 30% | $30,000      | Headless + styled UI · Firefox/WebKit coverage (WebDriver) · working kit branch · reference demo | ◐ UI + kit branch done (S18–S20, S17); Firefox/WebKit automation + demo recording remain (S08 path, S21) |
| **T3**  | 40% | $40,000      | `PasskeyModule` merged / merge-ready upstream · full docs · maintenance commitment honored       | ◐ docs + maintenance done (S22–S23); upstream PR + outreach are S25/S27 (human)                          |
|         |     | **$100,000** |                                                                                                  |                                                                                                          |

**Defensible fallback (~$75–85k)** if the panel trims scope: drop the optional
relayer adapters (Launchtube/OZ) and the Firefox/WebKit _automation_ (keep them
Tier-2 manual, already documented), and ship the SDK + Chromium/Edge CI + kit
module + docs. The load-bearing deliverables (matrix, SDK, kit module, docs)
survive the cut.

## Scope & risk

| Risk                                                                                                              | Severity        | Mitigation                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **External coordination — kit maintainers** must accept the upstream PR (the "adopted, not parallel" requirement) | **#1**          | De-risk by arriving with a finished module + demo + integration design doc (S16/S17), then opening the upstream PR and a maintainer thread on the existing Issue #90 (S25/S27, pending). The SDK is independently useful even if adoption slips. |
| Tier-2 device breadth (Safari/iOS, Android) can't be fully automated                                              | Medium          | Bounded + honest: documented cadence + sourced WebDriver upgrade path (`docs/matrix/automation-coverage.md`); never claimed as automated.                                              |
| Smart-account contract churn (kalepail vs OZ)                                                                     | Medium          | We don't ship the contract; we stay ABI-compatible and prove against a deployed one (on-chain test). The signature wire-shape is the only coupling and is isolated in `assemble.ts`.   |
| Browser/OS passkey behavior drift                                                                                 | Low (by design) | The living matrix exists precisely to catch this; opt-in field telemetry (S23) surfaces real failures.                                                                                 |

## Positioning vs prior kits (keep / optional / drop / defer)

Explicit contrast to the "monolithic" `passkey-kit` (kalepail; "demo, not
audited") and `smart-account-kit`:

| Decision                  | Item                                                                                                | Rationale                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Keep + harden**         | crypto (low-S, ES256, DER→raw, payload), ceremonies, Soroban auth assembly, the kit `PasskeyModule` | the battle-tested core; ported + re-validated, not rewritten cold                                          |
| **Make optional**         | submission/indexer adapters (Launchtube, OZ Relayer, Mercury), the styled UI layer, telemetry       | composable, never required; zero-infra defaults (`direct` + `events`) work alone                           |
| **Drop / don't reinvent** | the smart-account **contract** + factory deploy                                                     | defer to audited OZ `stellar-contracts` / kalepail `webauthn-wallet`; we stay compatible (proven on-chain) |
| **Defer to kalepail/OZ**  | on-chain `__check_auth`, contract upgrades, policy/session signers                                  | reuse the audited contract layer; our SDK is the client/UI/matrix story                                    |

## Evaluation-criteria crosswalk

Every criterion → the concrete artifact that satisfies it.

| Criterion (RFP brief)                                      | Satisfied by                                                                          | Where                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Production-grade WebAuthn** (handles the real bugs)      | low-S normalization + ES256 hard-fail + user-gesture anchors; on-chain proof          | S04 `anchors.ts`, `webauthn/signature.ts`; `docs/security/onchain-verification.md` |
| **Compatibility guide that stays fresh**                   | sourced matrix + virtual-auth CI + weekly cron; dated snapshot (auto-commit + diff: pending)          | S07/S09/S10; `apps/matrix/`, `.github/workflows/ci.yml`; `/matrix`                 |
| **Minimal, well-scoped API**                               | five-function public surface + subpath tree-shaking; `@stellar/stellar-sdk` peer-only | S13 `create`/`connect`/`recover`/`signTransaction`/`signAuthEntry`; `/api/`        |
| **Adopted into stellar-wallets-kit (not parallel)**        | `PasskeyModule implements ModuleInterface` (`packages/kit-module/`); fork branch + upstream PR pending | S16/S17 `packages/kit-module/`; S27 (human)                                        |
| **Drop-in UI without a forced design system**              | headless primitives + token-driven styled layer (re-theme by tokens only)             | S18–S20 `packages/ui/`; `docs/ui/framework-decision.md`                            |
| **Reference integration + demo**                           | demo of the flows; kit-integrated demo + recording pending                            | S21 `apps/demo/` (kit wiring + recording pending)                                  |
| **Test suite across the matrix**                           | unit + jsdom + Playwright virtual-authenticator + the live on-chain test              | S15 (136 unit tests), `apps/demo/e2e/`, `packages/core/scripts/onchain-e2e.ts`     |
| **Security / threat model**                                | low-S, challenge/replay, RP-ID, recovery — each tied to an anchor                     | S14 `docs/security/threat-model.md`                                                |
| **Small, well-maintained, permissively-licensed libs**     | Apache-2.0 + maintenance cadence + changelog + CONTRIBUTING                           | S23 `docs/rfp/{license,maintenance}.md`; `.changeset/`                             |
| **Privacy / protect users**                                | zero telemetry by default; opt-in, consented, PII-free design                         | S23 `docs/rfp/telemetry.md`                                                        |
| **No mandatory proprietary infra**                         | zero-backend defaults; optional relayers; non-custodial                               | S12/S23 `docs/rfp/decentralization-and-infra.md`                                   |
| **Maintainer coordination ("evidence of a conversation")** | integration design doc (5 maintainer questions); upstream outreach on Issue #90 pending | S16 `docs/integration/stellar-wallets-kit.md`; S25 (human, pending)              |

## Open items before submission (human — S25–S27)

1. Outreach: Issue #90 + Enrique Arrieta; coordinate Tyler & Bastian (S25).
2. Verify the "Ishan" reference + current RFP wording in Discord (S26).
3. Open the upstream `PasskeyModule` PR; finalize the SCF submission (S27).
