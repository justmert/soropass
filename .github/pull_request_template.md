<!--
  Conventional-commit title required, e.g. `feat(core): low-S normalization (YK-430)`.
  Reference the YK issue id this PR closes.
-->

## Summary

<!-- What changed and why. -->

Closes: YK-\_\_\_

## Acceptance criteria

<!-- Copy the issue's "Acceptance criteria" checklist and tick each item. -->

- [ ] …

## Validation gate

<!-- Paste the passing test / simulator output that proves the gate. This is a hard stop. -->

```

```

## Invariant checklist (Passkey UI)

- [ ] ES256-only (`alg: -7`); throws `ES256_NOT_SUPPORTED` otherwise
- [ ] Signatures always low-S normalized client-side
- [ ] No `@stellar/stellar-sdk` bundled into SDK output (peer dep)
- [ ] API surface stayed minimal — no scope creep
