# Black-box reproduction of https://soropass.dev/skill.md

Date of run: 2026-09-09, 10:54 to 11:05 UTC. Working directory: `<workdir>`. Sole information sources: the skill file (fetched with curl, saved as `skill.md`) and the npm packages it says to install (their README and type declarations under `node_modules/`). Every command and its complete output is in `agent-log.md`.

## Environment

| Item                     | Value                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS                       | Darwin 25.4.0, arm64 (macOS)                                                                                                                                                                                                                                                                                                                                         |
| Node                     | v24.13.1                                                                                                                                                                                                                                                                                                                                                             |
| npm                      | 11.8.0                                                                                                                                                                                                                                                                                                                                                               |
| Skill file               | 28096 bytes, 447 lines, HTTP 200 from https://soropass.dev/skill.md                                                                                                                                                                                                                                                                                                  |
| `@soropass/core`         | 0.3.1 (resolved from https://registry.npmjs.org/@soropass/core/-/core-0.3.1.tgz; peer `@stellar/stellar-sdk >=17`)                                                                                                                                                                                                                                                   |
| `@stellar/stellar-sdk`   | 17.0.1 (resolved from https://registry.npmjs.org/@stellar/stellar-sdk/-/stellar-sdk-17.0.1.tgz)                                                                                                                                                                                                                                                                      |
| Transitive (lockfile v3) | @noble/curves 1.9.7, @noble/hashes 1.8.0 (and 2.4.0 nested under stellar-sdk), @noble/ed25519 3.2.0, @stellar/js-xdr 5.0.0, @exodus/bytes 1.15.1, axios 1.18.0, bignumber.js 11.1.5, commander 14.0.3, eventsource 4.1.1, feaxios 0.0.23, smol-toml 1.8.0, uint8array-extras 1.5.0, @types/json-schema 7.0.15, plus axios' own subtree (full list in `agent-log.md`) |
| Install command          | `npm install @soropass/core "@stellar/stellar-sdk@>=17"` (verbatim from the skill), after `npm init -y`                                                                                                                                                                                                                                                              |
| Network                  | Stellar testnet: friendbot.stellar.org, soroban-testnet.stellar.org (RPC), horizon-testnet.stellar.org (verification only)                                                                                                                                                                                                                                           |

The first five lines of the skill file:

```
---
name: soropass-sdk
description: Integrates the @soropass/core SDK to add passkey (WebAuthn) smart-account authentication to a Stellar app on Soroban. Use this when you need to create a passkey smart account, derive its contract (C-address), sign Soroban transactions or authorization entries with a passkey, normalize secp256r1 signatures to low-S, recover an account on a second device, mount the drop-in UI screens from @soropass/ui, or register a passkey wallet in stellar-wallets-kit. Includes a no-browser Node path for reproducing create and sign.
---

```

## Procedure

### Task 1: fetch the skill file

`curl -sS -L -o skill.md https://soropass.dev/skill.md` returned HTTP 200, 28096 bytes, 447 lines. Read in full.

### Task 2: create + sign in Node (no browser), skill only

1. `npm init -y`, then the skill's install line verbatim. Resolved `@soropass/core@0.3.1` and `@stellar/stellar-sdk@17.0.1`.
2. Extracted the fenced `verify.mjs` block (skill lines 32 to 64) with `sed -n "32,64p" skill.md > verify.mjs` and confirmed it byte for byte with `cmp` (IDENTICAL; sha256 `3489e0f2695467f13e37151043140420172ce9e3b09862da53ca8afad0c43cdc`, 1288 bytes).
3. `node verify.mjs`: exit 0, output matches the skill's expected ending (see Results).
4. Extra, assembled only from claims the skill makes about the same mock kit (`extras.mjs`): `forceHighS: true` still verifies; `kit.connect()` and `kit.recover()` return the created account; `seed` is deterministic; `userName` is optional. All confirmed.

### Task 3: testnet recipe, end to end

1. **Sponsor (skill only).** The skill's friendbot snippet (lines 122 to 137) was copied verbatim into `sponsor.mjs` (confirmed IDENTICAL with `cmp`), with five agent-added lines to print the address and persist the keypair to `sponsor.json` for the later scripts. It funded `GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T` (10000 XLM) and the RPC poll saw the account.
2. **Headless gap in the skill.** The skill's account-creation recipe is `createPasskey(...)`, which "uses `browserWebAuthnClient()` by default", and its signing recipes use `browserPasskeySigner(...)`; both need a browser. The only headless path the skill documents is `createPasskeyKit({ mode: 'mock' })`, which it describes as "in-process, no network" with a `contractId` that "comes from the in-memory backend, not the factory scheme". The skill's `mode: 'live'` description lists only `browserWebAuthnClient()` and `browserPasskeySigner(...)` for the `webauthn` and `signer` slots. So, from the skill file alone, the testnet create + sign cannot be reproduced without a browser. This is stated precisely in Deviations.
3. **Package-declared headless path (deviation, clearly labeled).** The installed package's own type declarations (`node_modules/@soropass/core/dist/testing.d.ts`, an allowed source) export `mockAuthenticator({ rpId, seed })`, typed as a `WebAuthnClient` with a `sign(challenge)` method typed as a `WebAuthnSigner`, and `create.d.ts` shows `createPasskey` and `registerPasskey` accept a `webauthn?: WebAuthnClient` option. I used that adapter in place of the two browser adapters and otherwise followed the skill's recipes verbatim. The skill file itself never mentions `mockAuthenticator` or the `webauthn` option.
4. **Create (`create-account.mjs`).** `createPasskey({ rpId: 'example.com', rpName, userName: 'alice', deployer: factoryDeployer({ rpcUrl, networkPassphrase: Networks.TESTNET, sourceSecret }), webauthn: mockAuthenticator(...) })`. No `factoryContractId` was passed; the default testnet factory was used. The deployer was wrapped only to print the deploy tx hash (`createPasskey` does not return it). Then `deriveAccountAddress(...)` exactly as in the skill, to test its claim `address === account.contractId`.
5. **Payment (`pay.mjs`).** The skill's two listings from "A complete payment, end to end" transcribed to JavaScript (one TS annotation dropped), signer replaced as in step 3, `destination` = the sponsor's own G-address. Funding transfer of 10 XLM from the sponsor to the smart account, then a passkey-signed 2.5 XLM transfer out of the smart account: build, simulate, passkey-sign with `signatureExpirationLedger`, re-simulate, envelope-sign, submit, poll.
6. **Recovery (`recover.mjs`, then `recover-v2.mjs`).** The skill's "Native recovery on the v0.2 account" recipe: `registerPasskey` for device B (second mock authenticator), build `add_signer(device2.publicKey)`, sign with device A, re-simulate, envelope-sign, submit. The first attempt, following the snippet verbatim, failed at re-simulation (see Deviations). The second attempt added `signatureExpirationLedger: validUntil` to the `add_signer` signing call and succeeded. It then ran the payment recipe signed by device B alone, and a third, never-enrolled mock device C, which was rejected. `signer_count()` was read by simulation before and after (1, then 2).
7. **Horizon checks.** Every transaction hash produced was fetched from `https://horizon-testnet.stellar.org/transactions/<hash>` and its `successful` field recorded. The sponsor's transaction history on Horizon was also listed to confirm the set is complete.

## Results

### Task 2: verify script output, verbatim (`node verify.mjs`, exit 0)

```
account: CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5 | key bytes: 65
PASS: create + sign verified
OK: wrong key rejected
```

The skill says the expected output ends with `PASS: create + sign verified` and `OK: wrong key rejected`. The output matches. First run, no edits, no retries.

Additional mock-mode claims from the skill (`node extras.mjs`, exit 0):

```
forceHighS result: { success: true, challengeBound: true, signatureValid: true }
PASS: forceHighS still verifies (low-S normalized)
connect(): { contractId: 'CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5', credentialId: 'QXzZ6st2JsMxvWCoKQcqYQ' } | equals created: true
recover(): [ { contractId: 'CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5', credentialId: 'QXzZ6st2JsMxvWCoKQcqYQ' } ] | includes created: true
seed determinism (same contractId, credentialId, key): true true true
```

### Task 3: testnet

| Item                                                            | Value                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sponsor (friendbot-funded, skill snippet)                       | `GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T`                                                                           |
| Default testnet factory used (from `DEFAULT_ACCOUNT_FACTORIES`) | `CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH` (matches the skill's stated testnet factory)                              |
| Smart account (real, factory-deployed)                          | `CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK`                                                                           |
| Founding credential id (base64url)                              | `bDl6vfHGh1FADhvHv1XIjQ`                                                                                                             |
| Founding public key (SEC-1, 65 bytes, hex)                      | `048d362a193d5cc8e318ad94322ba93daac67962335077e28e91ccb51ddd49afb6d017c663cae8d72a56fd7f525c40d21b61d59ba0b92415c9c7f1523656d5f91e` |
| `deriveAccountAddress(...)`                                     | `CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK`, equal to `account.contractId` (true)                                     |
| Device B public key (hex)                                       | `0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545` |
| `signer_count()` before / after add_signer                      | 1 / 2                                                                                                                                |

Every transaction produced, in ledger order, with the Horizon `successful` field:

| #   | What                                                                                 | Hash                                                               | Horizon `successful` | Ledger  | Stellar Expert                                                                                              |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Friendbot funds the sponsor                                                          | `6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7` | true                 | 4585572 | https://stellar.expert/explorer/testnet/tx/6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7 |
| 2   | `factory.deploy` creates the smart account (via `createPasskey` + `factoryDeployer`) | `9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d` | true                 | 4585593 | https://stellar.expert/explorer/testnet/tx/9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d |
| 3   | Sponsor seeds the smart account, 10 XLM SAC transfer                                 | `36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065` | true                 | 4585601 | https://stellar.expert/explorer/testnet/tx/36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065 |
| 4   | Passkey-signed payment, 2.5 XLM out of the smart account (device A)                  | `b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782` | true                 | 4585602 | https://stellar.expert/explorer/testnet/tx/b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782 |
| 5   | `add_signer(device B)` authorized by device A                                        | `dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39` | true                 | 4585630 | https://stellar.expert/explorer/testnet/tx/dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39 |
| 6   | Passkey-signed payment, 1 XLM, signed by device B alone                              | `ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56` | true                 | 4585631 | https://stellar.expert/explorer/testnet/tx/ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56 |

RPC `pollTransaction` reported `SUCCESS` for transactions 2 through 6 at submit time, and Horizon confirms all six. The sponsor's Horizon transaction history contains exactly these six, so no transaction is missing from the table.

Rejected attempt (no hash, never submitted): a never-enrolled device C signed the same payment; the enforcing re-simulation (`server.prepareTransaction` on the signed envelope) threw

```
HostError: Error(Auth, InvalidAction)
... data:["failed account authentication with error", CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, Error(Contract, #3)]
```

with the account's `__check_auth` called and failing on-chain in simulation. The thrown value is a plain `Error` from `@stellar/stellar-sdk` (`isKitError` false), not a `KitError`.

Fees charged, from Horizon (testnet, in stroops): deploy 651039; seed transfer 108415; passkey payment 23158; add_signer 287931; payment by B 23167.

## Deviations

Anything I did that the skill did not say, and anything in the skill that was wrong or unclear.

1. **No headless testnet path in the skill file (missing).** The skill's create recipe says: "`createPasskey` uses `browserWebAuthnClient()` by default." Its signing recipes use `browserPasskeySigner` ("adapts `navigator.credentials.get` into the signer `signTransaction` expects"). Its only headless path is mock mode: "`mode` is `\"mock\"` (in-process, no network) or `\"live\"` (supply real adapters: `webauthn` from `browserWebAuthnClient()`, `deployer` from `factoryDeployer(...)`, `indexer` from `eventsIndexer(...)`, and `signer` from `browserPasskeySigner(...)`)". Nothing in the skill names a Node-usable WebAuthn client or signer for the live path, and mock mode does not touch the chain ("the mock account's `contractId` comes from the in-memory backend, not the factory scheme"). Following the skill alone, Task 3 stops at "sponsor funded". Everything on-chain in the Results came from the next item.
2. **Adapter taken from the package's type declarations, not the skill.** `mockAuthenticator` from `@soropass/core/testing` (typed as a `WebAuthnClient` with a `sign` method typed as a `WebAuthnSigner`) and the undocumented `webauthn?: WebAuthnClient` option of `createPasskey` and `registerPasskey`. Used as `webauthn: auth` at create/register time and `sign: (c) => auth.sign(c)` plus `publicKey: auth.publicKey` at sign time. The `publicKey` option itself is documented in the skill ("or once as `SorobanSignOptions.publicKey` (which takes precedence)"). Each device was a separate `mockAuthenticator` seed. The mock assertion carried flags `up: true, uv: true`, which the v0.2 account accepted on-chain. A sentence in the skill pointing at `mockAuthenticator` for CI runs against testnet would close this gap.
3. **The `add_signer` recipe fails as written (wrong).** The skill's "Native recovery on the v0.2 account" listing signs with
   ```ts
   const signedXdr = await signTransaction(assembled.toXDR(), {
     networkPassphrase: Networks.TESTNET,
     sign: browserPasskeySigner({ ... }),
   });
   ```
   and then says: "Then re-simulate, envelope-sign with the source, submit, and poll: steps 3 and 4 of \"A complete payment, end to end\", unchanged." Run verbatim (with the mock signer), the re-simulation threw `HostError: Error(Auth, InvalidInput)` with the diagnostic `["signature has expired", CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, 4585612, 0]`: the signed entry carried `signatureExpirationLedger` 0. The payment recipe's step 2 stamps `signatureExpirationLedger: validUntil` ("The expiration is stamped before the challenge is computed, so the signature binds it"), and the `add_signer` listing omits it. Adding the one option (`recover-v2.mjs`) made the same code succeed (tx 5). The skill's own sentence "The same build, passkey-sign, re-simulate, envelope-sign, submit sequence applies to every transaction the smart account authorizes, including the `add_signer` recovery flow below" is correct only if step 2's expiration stamp is included, which the listing does not show.
4. **TypeScript listings are not runnable JavaScript (unclear, minor).** The payment and recovery listings are `ts` blocks containing `const addr = (a: string) => ...`; in a `.mjs` file the annotation had to be dropped. The skill flags the `.mjs` requirement for the verify script but does not say the later listings are TypeScript.
5. **`createPasskey` does not expose the deploy transaction hash (unclear, minor).** The skill documents the return as `{ contractId, credentialId, publicKey }`. To record the deploy hash I wrapped `factoryDeployer`'s `deploy` (its result carries `txHash`). Without that, the hash is only findable through the sponsor's transaction history.
6. **Persisting the sponsor (agent addition).** The skill's friendbot snippet is inline; I appended lines to print the public key and write `sponsor.json` so `sourceSecret` could be reused across scripts. The 16 snippet lines themselves were unchanged (verified with `cmp`).
7. **`destination` (agent choice).** The skill says "`destination`, any funded classic account"; I used the sponsor's own address.
8. **On-chain rejection is not a `KitError` (unclear).** The Errors section says "Every failure is a typed `KitError` with a stable `code`" and, for contract errors, names examples like `UnknownSigner` without numeric codes. The wrong-key rejection surfaced as a plain `Error` from `server.prepareTransaction` carrying `Error(Contract, #3)`; the skill gives no way to map `#3` to a name. This is not a contradiction (the throw came from stellar-sdk, not the SDK), but a reader following the recipe meets a non-`KitError` on the most common failure.
9. **Package README lags the skill (observation, package source).** `node_modules/@soropass/core/README.md` shows `factoryContractId: 'C...', // your AccountFactory` in its browser example, while the skill says it "is optional everywhere it appears" since 0.3.1. The skill is right: my deploy passed no `factoryContractId` and used the default testnet factory.
10. **Skill claims confirmed on a real factory-deployed account.** `deriveAccountAddress` with `credentialId: new TextEncoder().encode(account.credentialId)` and `publicKey` equals the deployed `contractId`; the default factory ids printed by `DEFAULT_ACCOUNT_FACTORIES` match the two addresses the skill states; the enforcing re-simulation, envelope signature, and `pollTransaction` flow behave as described; `signer_count()` went from 1 to 2 after `add_signer`, and the newly added device signs alone.

## Verdict

**Did "create + sign using only the skill file" succeed on the first run? Yes.** Task 2 is the skill's own definition of that check: the byte-for-byte `verify.mjs` against the packages its install line resolves (`@soropass/core@0.3.1`, `@stellar/stellar-sdk@17.0.1`) printed `PASS: create + sign verified` and `OK: wrong key rejected` on the first run, with no edits and no outside information. The skill's further mock-mode claims (`forceHighS`, `connect`, `recover`, `seed`) also held.

**The testnet recipe did not succeed from the skill file alone, and the recovery recipe did not succeed as written.** Two qualifications:

- The skill offers no headless WebAuthn client or signer for its live path, so a browser-less agent cannot create a real account or sign a real transaction from the skill text; the sponsor-funding snippet is the last step reachable. Substituting the package-declared `mockAuthenticator` (not in the skill) let every subsequent skill recipe run unchanged: a real account was deployed through the default factory, a passkey-signed payment succeeded, and Horizon reports `successful: true` for all six transactions.
- The `add_signer` listing is missing `signatureExpirationLedger`; run verbatim it fails at re-simulation with "signature has expired". With that one line taken from the skill's own payment recipe, the full recovery sequence (enroll B by A, B signs alone, non-enrolled key rejected) succeeded on testnet.
