# Skill file acceptance test: an AI agent reproduces create + sign

Acceptance criterion from the SCF #44 Tranche 3 deliverable: "an AI agent reproduces a create + sign using only the skill file" (https://soropass.dev/skill.md).

Run date: 2026-09-09, 10:54 to 11:05 UTC. Result: **pass on the first run**, plus a real account created and a passkey-signed payment and a device recovery submitted on the Stellar testnet, all confirmed by Horizon.

## What is in this folder

| File                                                              | What it is                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`prompt.md`](./skill-agent-run-2026-09-09/prompt.md)             | The exact prompt the agent received and how it was run                                                                                                                                                                                                                     |
| [`agent-report.md`](./skill-agent-run-2026-09-09/agent-report.md) | The agent's own final report, verbatim: environment, procedure, results, deviations, verdict                                                                                                                                                                               |
| [`agent-log.md`](./skill-agent-run-2026-09-09/agent-log.md)       | Every command the agent ran with its complete output, in order, timestamped (154 KB)                                                                                                                                                                                       |
| [`scripts/`](./skill-agent-run-2026-09-09/scripts/)               | The files the agent wrote: `verify.mjs` (byte for byte from the skill), `sponsor.mjs`, `create-account.mjs`, `pay.mjs`, `recover-v2.mjs`, `extras.mjs`, the logger, `package.json` and the lockfile with the exact resolved versions. The sponsor keypair file is omitted. |

## How the agent was run

A fresh Claude Code subagent with an empty context (model `claude-fable-5-1`), an empty directory, shell and network access, and one instruction: the only allowed sources are the skill file and the npm packages it names. It was told to stop and say so if the skill file did not cover a step. The full prompt is in `prompt.md`.

## Black-box audit of the log

Checked after the run by reading `agent-log.md`, not the agent's summary:

- The only page fetched with `curl` was `https://soropass.dev/skill.md`. The other hosts in the log are the Stellar testnet RPC, friendbot, and Horizon, which the skill names, and the npm registry during install.
- The agent read two files of the installed package, its README and its type declarations. It read no repository, no docs page, and nothing outside its directory.
- The `verify.mjs` it ran is byte for byte the skill's code block (the agent proved it with `cmp` and a checksum).

## Results, checked independently on Horizon

The agent's six transaction hashes were re-fetched from `https://horizon-testnet.stellar.org/transactions/<hash>` after the run, separately from the agent's own check.

| #   | What                                               | Hash                                                                                                                       | Horizon    | Ledger  |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| 1   | Friendbot funds the sponsor                        | [`6675cf02…`](https://stellar.expert/explorer/testnet/tx/6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7) | successful | 4585572 |
| 2   | Account created through the default factory        | [`9605e63b…`](https://stellar.expert/explorer/testnet/tx/9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d) | successful | 4585593 |
| 3   | Sponsor seeds the account with 10 XLM              | [`36e4f3d5…`](https://stellar.expert/explorer/testnet/tx/36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065) | successful | 4585601 |
| 4   | Passkey-signed payment, 2.5 XLM out of the account | [`b63d9a5a…`](https://stellar.expert/explorer/testnet/tx/b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782) | successful | 4585602 |
| 5   | `add_signer`: device B enrolled by device A        | [`dde16850…`](https://stellar.expert/explorer/testnet/tx/dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39) | successful | 4585630 |
| 6   | Passkey-signed payment by device B alone           | [`ea9bd4c4…`](https://stellar.expert/explorer/testnet/tx/ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56) | successful | 4585631 |

Smart account: [`CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK`](https://stellar.expert/explorer/testnet/contract/CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK). The agent also derived this address offline with `deriveAccountAddress` and got the same value, and a never-enrolled key was rejected by the account's `__check_auth` in the enforcing simulation (no transaction, as expected).

The offline check the skill defines, `node verify.mjs`, printed exactly the expected ending:

```
account: CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5 | key bytes: 65
PASS: create + sign verified
OK: wrong key rejected
```

## What the agent found in the skill file, and what changed

The agent reported two defects, both fixed in `skill.md` after this run:

1. The `add_signer` recovery listing omitted `signatureExpirationLedger`. Run verbatim it failed at re-simulation with "signature has expired"; with the one line the payment recipe already shows, it succeeded (transaction 5). The listing now stamps the expiration.
2. The skill documented no browser-free path for the live testnet recipes. The agent used the package's `mockAuthenticator`, which its type declarations expose, and every recipe then ran unchanged. The skill now names it.

Minor notes from the report, left as they are: the payment and recovery listings are TypeScript and need one type annotation dropped in a `.mjs` file; `createPasskey` does not return the deploy transaction hash; an on-chain rejection surfaces as a stellar-sdk `Error`, not a `KitError`.

## Reproduce it

Give any coding agent an empty directory and the prompt in `prompt.md`. The offline part needs Node 18 or newer and npm; the testnet part needs network access. Expected: the verify output above on the first run, and new transactions on testnet that Horizon reports as successful.
