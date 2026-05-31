# Maintenance & update cadence

How the SDK **and** the living compatibility matrix stay current — this is the
"how does the guide not go stale" answer, and every item below is a mechanism
that already exists in the repo, not a promise.

## Automated (Tier-1) — every release + weekly

- **On every push to `main` and every pull request**, CI runs lint, typecheck,
  build, the full test suite (Node 20 + 22), and the **virtual-authenticator
  matrix job** (`matrix-ci`) — real `create()`→`get()` ceremonies against a CDP
  virtual authenticator, each signature verified with `p256.verify`.
- **Weekly cron** (`0 6 * * 1`, Mondays 06:00 UTC) re-runs the matrix job against
  current Chromium/Edge so cells are re-verified without a release.
  (`.github/workflows/ci.yml`: `on.schedule`, jobs `matrix-ci` + `matrix-publish`.)
- Each run writes a **dated, diffable snapshot** (`apps/matrix/data/matrix.<date>.json`)
  committed to git, so staleness is visible in history and the published site
  always reflects the latest verified state.

## Structured manual (Tier-2) — real devices

What machines can't reach (biometrics, iOS/Android, Safari, hardware keys) is
re-verified on a **documented cadence**: **monthly**, and **within 14 days of a
major iOS / Android / Chrome / Safari release**, with dated results appended to
[`docs/matrix/automation-coverage.md`](../matrix/automation-coverage.md). The
Firefox/WebKit WebDriver upgrade path (geckodriver / safaridriver) is sourced
there for moving rows from Tier-2 → Tier-1.

## Versioning, changelog, contributions

- **Changesets** (`.changeset/`) drive semver + a generated changelog
  (`@changesets/cli`); `@stellar-passkey/core` and `@stellar-passkey/ui` are the
  published surface (matrix/demo/ci-tools are `ignore`d).
- **Conventional Commits** + the five CI gates gate every change.
- Community matrix cells and fixes have a contribution path —
  [`apps/matrix/site/CONTRIBUTING.md`](../../apps/matrix/site/CONTRIBUTING.md).

## Post-award commitment

We commit to **active maintenance across the SCF tranche period and for 12 months
after the final tranche**: the automated Tier-1 cadence above runs continuously,
the Tier-2 fleet is re-checked on the stated cadence, **security-relevant fixes
are prioritized** (see [`telemetry.md`](./telemetry.md) for how field failures are
surfaced opt-in), and the upstream `PasskeyModule` PR is kept in sync with
`@creit-tech/stellar-wallets-kit` releases.
