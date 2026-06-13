# Maintenance & update cadence

How the SDK **and** the compatibility matrix stay current — this is the
"how does the guide not go stale" answer. Most items below already exist in the
repo; the two still being wired (auto-commit of dated snapshots + site deploy)
are flagged **pending** rather than presented as done.

## Automated (Tier-1) — every release + weekly

- **On every push to `main` and every pull request**, CI runs lint, typecheck,
  build, the full test suite (Node 20 + 22), and the **virtual-authenticator
  matrix job** (`matrix-ci`) — real `create()`→`get()` ceremonies against a CDP
  virtual authenticator, each signature verified with `p256.verify`.
- **Weekly cron** (`0 6 * * 1`, Mondays 06:00 UTC) re-runs the matrix job against
  current Chromium (Edge best-effort) so cells are re-verified without a release.
  (`.github/workflows/ci.yml`: `on.schedule`, jobs `matrix-ci` + `matrix-publish`.)
- Each run produces a **dated snapshot** (`apps/matrix/data/matrix.<date>.json`),
  sorted so successive dates diff cleanly. **Pending:** a scheduled job to commit
  each run's snapshot back to git + render the date-to-date diff, so staleness
  becomes visible in history and the published site auto-updates. (Today the
  snapshot is produced on demand and committed manually.)

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
  [`apps/matrix/site/content/docs/contributing.md`](../../apps/matrix/site/content/docs/contributing.md).

## Post-award commitment

We commit to **active maintenance across the SCF tranche period and for 12 months
after the final tranche**: the automated Tier-1 cadence above runs continuously,
the Tier-2 fleet is re-checked on the stated cadence, **security-relevant fixes
are prioritized** (see [`telemetry.md`](./telemetry.md) for how field failures are
surfaced opt-in), and the upstream `PasskeyModule` PR is kept in sync with
`@creit.tech/stellar-wallets-kit` releases.
