# License

**Apache-2.0** — see [`LICENSE`](../../LICENSE) at the repo root. Every package
declares `"license": "Apache-2.0"` (`packages/*`, `apps/*`).

## Why Apache-2.0

Apache-2.0 is permissive (like MIT) but adds an **explicit patent grant and
patent-retaliation clause** — important for a cryptography/authentication library
that wallet vendors will embed in commercial products: adopters get clear,
irrevocable patent rights from all contributors, lowering legal review friction
for a Creit Tech / SDF-adjacent ecosystem. It is OSI-approved, GPL-compatible
(v3), SCF-friendly, and the de-facto default across the Stellar/Soroban stack
(`@stellar/stellar-sdk`, `stellar-wallets-kit`, OpenZeppelin `stellar-contracts`),
so adopting it keeps this SDK frictionless to combine with the rest of the
toolchain. No CLA is required to contribute; the Apache-2.0 inbound=outbound
norm applies.
