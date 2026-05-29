# Contributing matrix cells

The matrix is **sourced, not hand-typed** — most cells come from MDN BCD or the
virtual-authenticator CI. But real-device (Tier-2) cells — Safari/iOS, Firefox,
Android — benefit from community reports.

## Submitting a Tier-2 (real-device) result

Open a PR that appends to the Tier-2 log in
`docs/matrix/automation-coverage.md` with:

- **Date** (ISO `YYYY-MM-DD`).
- **Device / OS / browser version** (e.g. `iPhone 15, iOS 18.3, Safari`).
- **Ceremony results**: `createPasskey` ✓/✗, sign ✓/✗, recover ✓/✗ (run the
  reference demo).
- **Feature observations**: `isUVPAA`, conditional UI, hybrid (copy the "your
  device" panel output).
- **High-S note** (Apple): whether the captured signature was high-S; the SDK's
  low-S normalization must still produce a verifying signature.

## Do not hand-edit generated files

`data/*.json` and `site/matrix-table.md` are produced by `pnpm matrix:pull`,
`pnpm matrix:ci`, and `pnpm matrix:build`. Change the **sources or the builder**,
never the generated output.

## Adding a new feature row

Add the BCD path (or a curated cross-reference + source URL) to
`apps/matrix/scripts/pull-bcd.ts`, then re-run `pnpm matrix:pull && pnpm matrix:build`.
