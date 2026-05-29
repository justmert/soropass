# Living compatibility-matrix — CI architecture

The matrix is **sourced and machine-verified**, not hand-maintained. Two tiers
feed one dated, diffable artifact. Every solid node below maps to a real script
or committed file (see the table) — there are no aspirational boxes; the only
dashed node is an explicitly-planned expansion.

```mermaid
flowchart TB
  OS["OS / browser release"]

  subgraph T1["Tier 1 — automated · every release + weekly cron"]
    BCD["matrix:pull<br/>MDN BCD → bcd.&lt;date&gt;.json"]
    LIVE["detectCapabilities()<br/>live feature-detect"]
    CI["matrix:ci<br/>Playwright + CDP virtual authenticator<br/>Chromium + Edge → ci.&lt;date&gt;.json"]
    BUILD["matrix:build<br/>merge + tier-tag → matrix.&lt;date&gt;.json"]
    SITE["VitePress site<br/>dated · diffable · 'your device' panel"]
    BCD --> BUILD
    LIVE --> CI
    CI --> BUILD
    BUILD --> SITE
  end

  subgraph T2["Tier 2 — structured manual · monthly + &le;14d after OS release"]
    FLEET["real-device fleet<br/>iOS latest+prior · Android · macOS Safari · Windows Hello · &ge;1 hardware key"]
    LOG["dated results appended<br/>automation-coverage.md"]
    FLEET --> LOG
  end

  WD["WebDriver Firefox / Safari<br/>feasible per S08 — planned Tier-1"]

  OS --> CI
  OS --> FLEET
  LOG --> BUILD
  WD -. planned .-> CI
  SITE --> DIFF["git diff over time"]
  DIFF -. on next run .-> BUILD

  classDef planned stroke-dasharray:5 5,color:#777;
  class WD planned;
```

## How this stays fresh

Tier-1 runs on **every release and a weekly cron**: `matrix:pull` re-ingests
MDN BCD, `matrix:ci` re-verifies Chromium + Edge by driving real
`create()`→`get()` ceremonies against CDP virtual authenticators (each signature
checked with `p256.verify`), and `matrix:build` merges them into a new dated
snapshot that the site renders and git diffs over time. Tier-2 covers what
machines can't: a real-device fleet (latest + prior iOS/Android, macOS Safari,
Windows Hello, ≥1 hardware key) re-checked **monthly and within 14 days of a
major OS/browser release**, with dated results appended to the coverage doc.
**Honest limits:** virtual authenticators don't reproduce biometrics, the Apple
Secure Enclave, the real ~50% high-S signature distribution, or in-app WebView
breakage — and Firefox/WebKit automation (feasible via WebDriver per S08) is
**not yet wired**, so those stay Tier-2 manual until the geckodriver/safaridriver
harness lands.

## Node → implementation (no aspirational boxes)

| Diagram node               | Built in  | Artifact                                                                  |
| -------------------------- | --------- | ------------------------------------------------------------------------- |
| `matrix:pull` (MDN BCD)    | S05       | `apps/matrix/scripts/pull-bcd.ts` → `data/bcd.*.json`                     |
| `detectCapabilities()`     | S06       | `apps/matrix/src/featureDetect.ts`                                        |
| `matrix:ci` (CDP CI)       | S07       | `apps/matrix/ci/run-matrix-ci.ts` → `data/ci.*.json` + GH `matrix-ci` job |
| `matrix:build` (merge)     | S09       | `apps/matrix/scripts/build-matrix.ts` → `data/matrix.*.json`              |
| VitePress site             | S09       | `apps/matrix/site/**` (`pnpm -F matrix build`)                            |
| Tier-2 fleet + coverage    | S08       | `docs/matrix/automation-coverage.md` + `src/tiers.ts`                     |
| _WebDriver Firefox/Safari_ | _planned_ | _feasible per S08; harness not yet wired (dashed)_                        |
