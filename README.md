# Passkey UI — SCF #43

A pre-outreach proof-of-capability bundle for the SCF #43 "Passkey UI" RFP.
Monorepo, Apache-2.0. See [`CLAUDE.md`](./CLAUDE.md) for the architecture
invariants and the build plan.

## What's here

| Path            | Package                     | Purpose                                                         |
| --------------- | --------------------------- | --------------------------------------------------------------- |
| `packages/core` | `@stellar-passkey/core`     | Minimal, headless, **ES256-only** passkey SDK.                  |
| `packages/ui`   | `@stellar-passkey/ui`       | Headless-first UI primitives; styling is optional/token-driven. |
| `apps/matrix`   | `@stellar-passkey/matrix`   | Living compatibility-matrix **data pipeline** (MDN BCD + virtual-authenticator CI) + typedoc API generation. |
| `apps/demo`     | `@stellar-passkey/demo`     | Reference demo of the create / sign / recover flows + the `/embed` live-preview target the docs site iframes. |
| `tools/ci`      | `@stellar-passkey/ci-tools` | Virtual-authenticator harness + matrix builder.                 |
| `contracts/`    | —                           | Reference Soroban smart-account contracts (OZ-compatible).      |

## Develop

```bash
pnpm install          # Node >= 20, pnpm 10
pnpm lint             # ESLint (flat config) + run `pnpm format:check` for Prettier
pnpm typecheck        # tsc --noEmit, per package
pnpm -r build         # tsup → ESM + CJS + d.ts
pnpm -r test          # vitest
```

CI (`.github/workflows/ci.yml`) runs `lint` / `typecheck` / `test` / `build` on a
Node 20/22 matrix, plus a virtual-authenticator `matrix-ci` job. The
`matrix-publish` job currently prints a run summary; scheduled commit-back +
site deploy of the dated snapshot is pending.

## Non-negotiable invariants

ES256-only · always low-S normalize · headless-first · pluggable adapters ·
minimal API surface · never bundle `@stellar/stellar-sdk` (peer dep). Full text
in [`CLAUDE.md`](./CLAUDE.md).

## License

[Apache-2.0](./LICENSE).
