# `@stellar-passkey/core` — test coverage

Regenerate: `pnpm --filter @stellar-passkey/core test:coverage` (vitest + v8).

Latest run — **65 unit tests**:

| Metric     | %     |
| ---------- | ----- |
| Statements | 75.89 |
| Branches   | 71.96 |
| Functions  | 82.79 |
| Lines      | 75.89 |

Unit-covered: crypto primitives (S03), the three battle-tested anchors (S04),
Soroban auth assembly (S11), the adapter contracts + swaps (S12), the
create/connect/recover ceremonies (S13), and the deterministic mock kit (S15).

The uncovered remainder is intentionally exercised outside Node unit tests:

- `ceremonies/browserClient.ts` — the `navigator.credentials` path only runs in a
  real browser (S07 virtual-authenticator CI; S21 demo). Mock mode covers the
  ceremony orchestration itself.
- adapter network paths (`direct` / `events` / `launchtube` / `ozRelayer` /
  `mercury`) — live RPC/HTTP, exercised against testnet in S17 / S21.
