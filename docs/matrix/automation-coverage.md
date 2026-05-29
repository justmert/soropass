# Matrix automation coverage (verification tiers)

**S08 (YK-434) spike — how each browser's matrix cells are verified.**
_Last reviewed: 2026-05-29._

Every cell in the published compatibility matrix (S09) is labelled with the
**tier** that explains _how it was verified_, so no cell is ambiguous:

- **Tier-1 (automated)** — exercised by machines on every release + weekly cron
  (real WebAuthn ceremonies against a virtual authenticator, each round-trip
  verified via `p256.verify`).
- **Tier-2 (manual / real-device)** — verified on a real device on a documented
  cadence (below). Automation is _feasible_ for some of these (sourced) but is
  **not yet wired** in this sprint; the upgrade path is documented per row.

## Summary

| Browser           | Platform | Tier                | Verification method (current)                            | Automatable?  |
| ----------------- | -------- | ------------------- | -------------------------------------------------------- | ------------- |
| Chromium / Chrome | desktop  | **Tier-1 (auto)**   | CDP `WebAuthn.addVirtualAuthenticator` (Playwright, S07) | yes — wired   |
| Edge              | desktop  | **Tier-1 (auto)**   | CDP `WebAuthn.addVirtualAuthenticator` (Playwright, S07) | yes — wired   |
| Firefox           | desktop  | **Tier-2 (manual)** | Real-device; **automatable via geckodriver ≥ 0.34**      | yes — planned |
| Safari / WebKit   | macOS    | **Tier-2 (manual)** | Real-device; **automatable via safaridriver capability** | yes — planned |
| Safari            | iOS      | **Tier-2 (manual)** | Real device (no desktop virtual-authenticator path)      | no            |
| Chrome            | Android  | **Tier-2 (manual)** | Real device                                              | no            |
| Firefox           | Android  | **Tier-2 (manual)** | Real device                                              | no            |
| Samsung Internet  | Android  | **Tier-2 (manual)** | Real device                                              | no            |

The machine-readable source of truth is [`apps/matrix/src/tiers.ts`](../../apps/matrix/src/tiers.ts)
(`tierFor(browser, os)`), which S09 renders onto every cell.

## Definitive, sourced findings

### Chromium / Edge — Tier-1, wired ✅

Driven via the Chrome DevTools Protocol `WebAuthn` domain
(`WebAuthn.enable` + `WebAuthn.addVirtualAuthenticator`). This is what S07
(YK-433) implements and runs in CI; the local run verified **7/7 completed grid
cells** (`{transport × residentKey × UV}`) via `p256.verify` (COSE alg -7).
Edge is the same engine + channel. Evidence: `apps/matrix/data/ci.<date>.json`.

### Firefox — Tier-2 now, Tier-1 feasible (geckodriver) 🟡

Firefox **does** implement the WebDriver virtual-authenticator extension
commands. They landed in **geckodriver 0.34.0**, wired to Mozilla's
`authenticator-rs` (`webdriver` feature), which proxies
`/session/{id}/webauthn`. (0.34.0 registered them under `/sessions/` by
mistake; fixed in a later release — use ≥ 0.35.0.) Playwright's CDP path does
**not** drive Firefox, so a Selenium/geckodriver harness is required — a
separate track from the S07 CDP harness, **not wired this sprint**.

_Spike attempt (this machine):_ stood up `selenium-webdriver` + Selenium Manager
(auto-fetches geckodriver) and called `addVirtualAuthenticator` against headless
Firefox. Headless Firefox did not launch in this sandbox (`Process unexpectedly
closed`), and `VirtualAuthenticatorOptions` is exported from
`selenium-webdriver/lib/virtual_authenticator.js` rather than the package root.
Both are environment/binding details, not capability gaps — the sources above
are authoritative. **Conclusion:** Firefox is Tier-1-automatable; we classify it
Tier-2 (manual) until the geckodriver harness is funded (see S23 maintenance).

### Safari / WebKit — Tier-2 now, Tier-1 feasible (safaridriver) 🟡

WebKit added a `VirtualAuthenticatorManager` (replacing the default
`AuthenticatorManager`) and Safari exposes the virtual-authenticator WebDriver
commands **behind an allow capability**; `safaridriver` is present on every Mac.
This requires `safaridriver --enable` (admin) + a Selenium harness, and only
covers Safari on macOS — **Safari on iOS has no desktop virtual-authenticator
path** and stays real-device. Not wired this sprint. **Conclusion:**
Safari/macOS is Tier-1-automatable; classified Tier-2 (manual) for now.

## Tier-2 manual verification protocol

For each Tier-2 row, a real-device pass is logged here with **date · OS/browser
version · tester · result** for the three ceremonies (create / sign / recover):

1. Open the reference demo (S21) on the target real device.
2. `createPasskey` → confirm a C-address smart account is created.
3. Sign a no-op auth entry → confirm on-chain `__check_auth` succeeds.
4. Record `isUVPAA` / conditional-UI / hybrid behaviour from the live panel (S06).
5. Note any high-S occurrence (Apple) — the low-S anchor (S04) must still produce
   a verifying signature.

**Cadence:** every release **and** at minimum **monthly** on the current
Safari/iOS and Firefox (the Tier-2 set), recorded in an appendix to this file.
This cadence is part of the maintenance commitment (S23, YK-449).

## Sources

- [Chrome DevTools Protocol — WebAuthn domain](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/)
- [geckodriver 0.34.0 release notes](https://github.com/mozilla/geckodriver/releases/tag/v0.34.0)
- [Mozilla bug 1676679 — connect authenticator-rs WebDriver to geckodriver](https://bugzilla.mozilla.org/show_bug.cgi?id=1676679)
- [Selenium — Virtual Authenticator](https://www.selenium.dev/documentation/webdriver/interactions/virtual_authenticator/)
- [WebKit changeset 285267 — VirtualAuthenticatorManager](https://trac.webkit.org/changeset/285267/webkit)
- [Apple — Testing with WebDriver in Safari](https://developer.apple.com/documentation/webkit/testing-with-webdriver-in-safari)
