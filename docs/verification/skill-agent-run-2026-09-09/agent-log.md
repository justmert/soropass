# agent-log.md

Black-box reproduction of https://soropass.dev/skill.md. Every command below was run from the working directory
<workdir>
through ./runlog.sh (which records the UTC timestamp, the exact command, the exit code and the complete stdout+stderr).
Outputs longer than 300 lines are shown as first 150 + last 150 lines, and that is stated where it happens.

## 2026-09-09T10:54:00Z (approximate UTC; run before the logger existed)

```
$ mkdir -p <workdir> && cd <workdir> && pwd && ls -la
```

```
<workdir>
total 0
drwxr-xr-x@ 2 user  wheel   64 Sep  9 13:54 .
drwx------@ 8 user  wheel  256 Sep  9 13:54 ..
```

## (same time) created ./runlog.sh (the logger) and this file with heredocs; no other output.

## 2026-09-09T10:55:14Z

```
$ date -u; node --version; npm --version; uname -a
```

exit code: 0

```
Wed Sep  9 10:55:14 UTC 2026
v24.13.1
11.8.0
Darwin host 25.4.0 Darwin Kernel Version 25.4.0: Thu Mar 19 19:33:25 PDT 2026; root:xnu-12377.101.15~1/RELEASE_ARM64_T6041 arm64
```

## 2026-09-09T10:55:23Z

```
$ curl -sS -L -o skill.md -w "http_code=%{http_code} size_download=%{size_download} url_effective=%{url_effective}\n" https://soropass.dev/skill.md && wc -c skill.md && wc -l skill.md && head -n 5 skill.md
```

exit code: 0

```
http_code=200 size_download=28096 url_effective=https://soropass.dev/skill.md
   28096 skill.md
     447 skill.md
---
name: soropass-sdk
description: Integrates the @soropass/core SDK to add passkey (WebAuthn) smart-account authentication to a Stellar app on Soroban. Use this when you need to create a passkey smart account, derive its contract (C-address), sign Soroban transactions or authorization entries with a passkey, normalize secp256r1 signatures to low-S, recover an account on a second device, mount the drop-in UI screens from @soropass/ui, or register a passkey wallet in stellar-wallets-kit. Includes a no-browser Node path for reproducing create and sign.
---

```

## 2026-09-09T10:55:28Z

```
$ cat -n skill.md
```

exit code: 0

Output was 447 lines; showing the first 150 and last 150 lines.

```
     1	---
     2	name: soropass-sdk
     3	description: Integrates the @soropass/core SDK to add passkey (WebAuthn) smart-account authentication to a Stellar app on Soroban. Use this when you need to create a passkey smart account, derive its contract (C-address), sign Soroban transactions or authorization entries with a passkey, normalize secp256r1 signatures to low-S, recover an account on a second device, mount the drop-in UI screens from @soropass/ui, or register a passkey wallet in stellar-wallets-kit. Includes a no-browser Node path for reproducing create and sign.
     4	---
     5	
     6	# SoroPass SDK (`@soropass/core`)
     7	
     8	`@soropass/core` is a minimal, headless TypeScript SDK for passkey smart accounts on Stellar. It handles WebAuthn registration, DER-to-compact low-S secp256r1 conversion, the Soroban `__check_auth` authorization-entry wire shape, deterministic C-address derivation, and multi-device recovery. It ships no UI and no framework opinions, and it keeps `@stellar/stellar-sdk` as a peer dependency so it is never bundled twice.
     9	
    10	A passkey account is a Soroban contract (a `C...` address). The account's `__check_auth` verifies a WebAuthn secp256r1 assertion on-chain, so a device passkey (Touch ID, Windows Hello, a security key) replaces a seed phrase.
    11	
    12	## Install
    13	
    14	```bash
    15	npm install @soropass/core "@stellar/stellar-sdk@>=17"
    16	```
    17	
    18	`@stellar/stellar-sdk` is a required peer dependency. Install version 17 or newer (the `>=17` peer range): `@soropass/core@0.3.1` builds against the stellar-sdk 17 XDR API, so a plain `npm install @stellar/stellar-sdk` (which resolves to 17) is correct. On stellar-sdk 16 or older the create+sign example throws a `TypeError`; for those versions install `@soropass/core@0.2.1`, noting that 0.2.1 signs only classic address credentials, while 0.3.x also signs the `addressV2` credentials that Protocol 23 networks (testnet today) return from simulation. These examples are verified against `@soropass/core@0.3.1` with `@stellar/stellar-sdk` 17 on Node 20+. `@soropass/core` publishes ESM, CommonJS, and type declarations.
    19	
    20	Version note. `npm install @soropass/core` installs `0.3.1`, the published `latest`. In 0.3.x: `@stellar/stellar-sdk` 17 or newer is required, `deriveAccountAddress` and single-signer signing require the signer's 65-byte SEC-1 `publicKey` (the deploy salt and the signature struct both bind it), `userVerification` defaults to `'required'`, and the account contract is multi-signer with native `add_signer` / `remove_signer` recovery. Since 0.3.1, `factoryContractId` is optional everywhere it appears: it defaults to the SoroPass-deployed `AccountFactory` for the network (`DEFAULT_ACCOUNT_FACTORIES` exports the map), and an explicit id overrides the default. The account contract is versioned separately from the npm package: `v0.2 account` in this guide names the deployed `webauthn-account` contract version, and the 0.3.x package targets exactly those v0.2 contracts (the 0.3.x changes are client-side only).
    21	
    22	Two guarantees the SDK enforces so you do not have to:
    23	
    24	- Registration is ES256 only (secp256r1, COSE algorithm `-7`). Any other algorithm throws `KitError("ES256_NOT_SUPPORTED")`.
    25	- Every signature is normalized to low-S. About half of Apple passkeys produce high-S signatures, which are malleable and which strict verifiers reject; the SDK makes every signature canonical client-side.
    26	
    27	## Reproduce create + sign in Node (no browser)
    28	
    29	This is the fastest way to confirm the SDK works and to run a create + sign in CI or any environment without WebAuthn hardware. `@soropass/core/testing` provides `createPasskeyKit({ mode: "mock" })`, which wires a deterministic in-process authenticator and an in-memory backend. The mock path has the same shape as the live path, so the same calls work against real adapters later. One difference: the mock account's `contractId` comes from the in-memory backend, not the factory scheme, so it does not equal a `deriveAccountAddress` derivation; that check applies to real factory-deployed accounts.
    30	
    31	```js
    32	// verify.mjs. Run with: node verify.mjs
    33	import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
    34	import { referenceCheckAuth } from '@soropass/core';
    35	import { xdr } from '@stellar/stellar-sdk';
    36	
    37	const NETWORK = 'Test SDF Network ; September 2015';
    38	
    39	// 1. CREATE a passkey and deploy its smart account (in-memory, no browser).
    40	const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
    41	const account = await kit.createPasskey({ userName: 'alice' });
    42	console.log('account:', account.contractId, '| key bytes:', account.publicKey.length);
    43	
    44	// 2. SIGN a ready-made demo authorization entry with the passkey.
    45	const signedXdr = await kit.signAuthEntry(sampleAuthEntry(account.contractId));
    46	
    47	// 3. VERIFY the signature is accepted by __check_auth, and a wrong key is not.
    48	const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64');
    49	console.log(
    50	  referenceCheckAuth(signed, account.publicKey, NETWORK).success
    51	    ? 'PASS: create + sign verified'
    52	    : 'FAIL',
    53	);
    54	
    55	const other = await createPasskeyKit({
    56	  mode: 'mock',
    57	  rpId: 'example.com',
    58	  seed: 'other',
    59	}).createPasskey();
    60	console.log(
    61	  !referenceCheckAuth(signed, other.publicKey, NETWORK).success
    62	    ? 'OK: wrong key rejected'
    63	    : 'UNEXPECTED: wrong key accepted',
    64	);
    65	```
    66	
    67	Save the script with a `.mjs` extension (or set `"type": "module"` in `package.json`): the top-level `import` and `await` require ES modules, and a plain `.js` file in a default project errors with "Cannot use import statement outside a module".
    68	
    69	`createPasskey({ userName? })` returns `{ contractId, credentialId, publicKey }`: the C-address, the base64url credential id (store it to sign or reconnect later), and the 65-byte SEC-1 public key (`userName` is optional). `referenceCheckAuth` returns `{ success }`.
    70	
    71	Expected output ends with:
    72	
    73	```
    74	PASS: create + sign verified
    75	OK: wrong key rejected
    76	```
    77	
    78	`sampleAuthEntry(contractId)` returns a ready-to-sign demo entry, so this check does not depend on hand-built XDR. For real transactions you build your own and sign it (see "Sign a Soroban transaction in the browser" below).
    79	
    80	`createPasskeyKit(options)`: `mode` is `"mock"` (in-process, no network) or `"live"` (supply real adapters: `webauthn` from `browserWebAuthnClient()`, `deployer` from `factoryDeployer(...)`, `indexer` from `eventsIndexer(...)`, and `signer` from `browserPasskeySigner(...)`); `rpId` is required; `rpName` and `seed` are optional, and `seed` makes the mock deterministic; `forceHighS: true` forces a high-S signature to exercise the low-S normalizer, and the result stays `PASS`.
    81	
    82	The kit object exposes four methods with the same shape in both modes: `createPasskey({ userName? })`, `connect()`, `recover()`, and `signAuthEntry(entryXdr)`. `connect()` resolves the remembered credential to `{ contractId, credentialId }`, or `null` when nothing is remembered; `recover()` prompts for any passkey and returns every account it controls as `{ contractId, credentialId }[]`. In mock mode both run in-process, so the whole reconnect story is testable in CI:
    83	
    84	```js
    85	const back = await kit.connect(); // the account created above, resolved silently
    86	const found = await kit.recover(); // [{ contractId, credentialId }]
    87	```
    88	
    89	## Create a passkey account in the browser
    90	
    91	In a browser, `createPasskey` runs the real WebAuthn registration and deploys the account through an `AccountFactory`. By default, `factoryDeployer` uses the SoroPass-deployed factory for the network you name, so no contract work is needed on either network: testnet `CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH` and mainnet `CCCNRWMICVEMMUSBI7DL3IKB566QEOOQOLVDOAM5SLFDZ2KGUSRR3JVF`, both permissionless (`deploy` is not auth-gated). Pass `factoryContractId` only to deploy through your own factory instead.
    92	
    93	```ts
    94	import { createPasskey, factoryDeployer } from '@soropass/core';
    95	import { Networks } from '@stellar/stellar-sdk';
    96	
    97	const account = await createPasskey({
    98	  rpId: location.hostname, // your site's registrable domain
    99	  rpName: 'My Stellar App',
   100	  userName: 'alice',
   101	  deployer: factoryDeployer({
   102	    rpcUrl: 'https://soroban-testnet.stellar.org',
   103	    networkPassphrase: Networks.TESTNET, // selects the deployed factory for this network
   104	    sourceSecret, // a funded G-account secret that pays the deploy fee; see "Fees and sponsorship" below
   105	  }),
   106	});
   107	
   108	// account.contractId    the C-address of the smart account
   109	// account.credentialId  store this to sign and reconnect later
   110	// account.publicKey     SEC-1 (65-byte) secp256r1 public key
   111	```
   112	
   113	`createPasskey` uses `browserWebAuthnClient()` by default. `sourceSecret` funds the one-time deploy; in production a relayer or sponsor pays instead. Registration defaults `userVerification` to `'required'`, because the v0.2 account requires the User-Verified flag in `__check_auth`: a signature without UV fails on-chain. Passkey behavior varies by browser, platform, and authenticator; the compatibility matrix at https://docs.soropass.dev/docs/compatibility records what works in each case, with the recommended fallback where support diverges.
   114	
   115	### Fees and sponsorship
   116	
   117	Authorization and payment are separate: the passkey proves who may act, and a classic funded `G...` account sources every transaction, pays the network fee, and submits. `sourceSecret` is that fee source, and you supply it on both networks; the deployed factories are open infrastructure, not a fee service.
   118	
   119	On testnet, fees cost nothing: fund a throwaway sponsor with friendbot, and poll the RPC before deploying, because friendbot returns before the Soroban RPC sees the new account:
   120	
   121	```js
   122	import { Keypair, rpc } from '@stellar/stellar-sdk';
   123	
   124	const sponsor = Keypair.random();
   125	await fetch(`https://friendbot.stellar.org/?addr=${sponsor.publicKey()}`);
   126	const server = new rpc.Server('https://soroban-testnet.stellar.org');
   127	let funded = false;
   128	for (let i = 0; i < 30 && !funded; i++) {
   129	  try {
   130	    await server.getAccount(sponsor.publicKey());
   131	    funded = true;
   132	  } catch {
   133	    await new Promise((r) => setTimeout(r, 1000));
   134	  }
   135	}
   136	if (!funded) throw new Error('sponsor funded but not visible on the Soroban RPC after 30s');
   137	const sourceSecret = sponsor.secret();
   138	```
   139	
   140	On mainnet, the same code runs with two changes: `networkPassphrase: Networks.PUBLIC` with `rpcUrl: 'https://mainnet.sorobanrpc.com'` (the default factory switches to the mainnet deployment automatically), and `sourceSecret` must be an account you fund with real XLM: your app's sponsor account (users hold no XLM, keep the secret server-side) or a relayer (OpenZeppelin Relayer). A contract account holds no base reserve, so sponsoring locks nothing per user. Measured on mainnet: ~0.05 XLM to create an account and ~0.005 XLM per passkey-signed transaction. Costs and sponsorship models: https://docs.soropass.dev/docs/sponsorship
   141	
   142	To resolve an existing account without deploying, use `deriveAccountAddress` (synchronous and offline: it returns the C-address string directly, no `await` and no RPC) or `connect({ rpId, indexer })`. Note the encoding bridge: `createPasskey` returns `credentialId` as a base64url string, but `deriveAccountAddress` takes `Uint8Array` bytes. Pass the same bytes the factory received, which for `factoryDeployer` is the UTF-8 encoding of the base64url string, not its base64url-decoding. The options also require `publicKey`, the account's 65-byte SEC-1 key, because the v0.2 factory salts the deployed address by `sha256(credential_id ‖ public_key)`; binding the key fixes address squatting (credential ids are public, so a credential-only salt would let anyone pre-deploy at a victim's derived address with their own key).
   143	
   144	```ts
   145	import { deriveAccountAddress } from '@soropass/core';
   146	
   147	const address = deriveAccountAddress({
   148	  credentialId: new TextEncoder().encode(account.credentialId), // UTF-8 bytes of the base64url id
   149	  publicKey: account.publicKey, // 65-byte SEC-1 key, part of the v0.2 salt
   150	  networkPassphrase: Networks.TESTNET, // selects the deployed factory; factoryContractId overrides
[... 147 lines omitted ...]
   298	const device2 = await registerPasskey({
   299	  rpId: location.hostname,
   300	  rpName: 'My Stellar App',
   301	  userName: 'alice',
   302	});
   303	
   304	// Build + simulate the account-authorized add_signer invocation:
   305	const source = await server.getAccount(sponsor.publicKey());
   306	const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
   307	  .addOperation(
   308	    new Contract(account.contractId).call(
   309	      'add_signer',
   310	      nativeToScVal(device2.publicKey, { type: 'bytes' }),
   311	    ),
   312	  )
   313	  .setTimeout(120)
   314	  .build();
   315	const assembled = await server.prepareTransaction(tx);
   316	
   317	// The EXISTING enrolled device signs the account's auth entry:
   318	const signedXdr = await signTransaction(assembled.toXDR(), {
   319	  networkPassphrase: Networks.TESTNET,
   320	  sign: browserPasskeySigner({
   321	    rpId: location.hostname,
   322	    allowCredentials: [account.credentialId],
   323	    publicKey: account.publicKey,
   324	  }),
   325	});
   326	
   327	// Then re-simulate, envelope-sign with the source, submit, and poll: steps 3
   328	// and 4 of "A complete payment, end to end", unchanged.
   329	```
   330	
   331	`remove_signer(public_key)` works the same way, authorized by any remaining enrolled device.
   332	
   333	### Recovery on a passkey-kit v1 smart-wallet
   334	
   335	For a passkey-kit v1 smart-wallet, `addSigner` wraps the whole enroll-a-device flow (build `add_signer`, sign with the existing device, enforcing re-simulation, submit):
   336	
   337	```ts
   338	import { registerPasskey, addSigner, browserPasskeySigner } from '@soropass/core';
   339	import { Networks } from '@stellar/stellar-sdk';
   340	
   341	const device2 = await registerPasskey({
   342	  rpId: location.hostname,
   343	  rpName: 'My Stellar App',
   344	  userName: 'alice',
   345	});
   346	
   347	await addSigner({
   348	  walletContractId, // a passkey-kit v1 smart-wallet C-address
   349	  newSigner: { credentialId: device2.credentialId, publicKey: device2.publicKey },
   350	  networkPassphrase: Networks.TESTNET,
   351	  rpcUrl: 'https://soroban-testnet.stellar.org',
   352	  sourceSecret, // funded classic G-account that pays the fee
   353	  sign: browserPasskeySigner({ rpId: location.hostname, allowCredentials: [walletCredentialId] }),
   354	});
   355	```
   356	
   357	`addSigner` and `removeSigner` target the v1 smart-wallet ABI only; they do not drive the v0.2 account (use the native flow above for it).
   358	
   359	## Reconnect a returning user
   360	
   361	`connect` resolves the account silently, with no passkey prompt. You never pass the credential id yourself: `createPasskey` stores it under the localStorage key `stellar-passkey:<rpId>` (pass a `storage` object to both calls to keep it somewhere else), and `connect` reads it back and resolves the C-address through the indexer. It returns `null` when nothing is stored or no account resolves; send that user through `recover`. Pass the `publicKey` you persisted at create time so `connect` returns only the account founded by that exact key: factory `deploy` is permissionless, so without the key a credential id can also resolve to an account someone else pre-deployed, and you then must verify enrollment yourself before trusting the result.
   362	
   363	```ts
   364	import { connect, recover, eventsIndexer } from '@soropass/core';
   365	import { Networks } from '@stellar/stellar-sdk';
   366	
   367	const indexer = eventsIndexer({
   368	  rpcUrl: 'https://soroban-testnet.stellar.org',
   369	  networkPassphrase: Networks.TESTNET, // reads the default factory's events; factoryContractId overrides
   370	});
   371	
   372	// Same-device return visit: silent, no prompt.
   373	let session = await connect({
   374	  rpId: location.hostname,
   375	  indexer,
   376	  publicKey: account.publicKey, // the 65-byte key persisted at create time
   377	});
   378	
   379	if (!session) {
   380	  // New device or cleared storage: prompts for any passkey and lists the
   381	  // accounts it controls. Call it from a click handler (Safari requires a
   382	  // user gesture for the prompt).
   383	  [session] = await recover({ rpId: location.hostname, indexer });
   384	}
   385	// session.contractId, session.credentialId
   386	```
   387	
   388	Both functions take the same `indexer`; `recover` returns `{ contractId, credentialId }[]` because one passkey can control several accounts. See the full second-device flow at https://docs.soropass.dev/docs/sdk/accounts.
   389	
   390	## Drop-in UI screens
   391	
   392	`@soropass/ui` ships styled screens for the five flows: create, sign, recover, connect, and add-device. It is framework-agnostic (plain DOM, no framework dependency) and installs from npm: `npm install @soropass/ui` (it depends on `@soropass/core`). Each screen pairs a headless flow (a state machine over plain async callbacks you supply) with a mount function, and every visual value is a `--pk-*` CSS custom property, so re-theming means overriding tokens, not editing components.
   393	
   394	```ts
   395	import { createCreatePasskeyFlow } from '@soropass/ui/headless';
   396	import { mountCreateScreen } from '@soropass/ui/styled';
   397	import '@soropass/ui/styled.css';
   398	
   399	const flow = createCreatePasskeyFlow({
   400	  userActivation: navigator.userActivation, // enforces the Safari user-gesture rule
   401	  async create({ userName }, report) {
   402	    // call report.deploying() when the on-chain deploy phase begins
   403	    // the browser create call from "Create a passkey account in the browser"
   404	    return createPasskey({ rpId: location.hostname, rpName: 'My Stellar App', userName, deployer });
   405	  },
   406	});
   407	const { unmount } = mountCreateScreen(document.getElementById('slot'), { flow });
   408	```
   409	
   410	The same shape gives `mountSignScreen`, `mountRecoverScreen`, `mountAddDeviceScreen`, and `mountConnectScreen`. A complete framework-free example wiring all five screens to the mock kit: https://github.com/justmert/soropass/tree/main/apps/ui-example. Component and theming reference: https://docs.soropass.dev/docs/components.
   411	
   412	## Register the passkey wallet in stellar-wallets-kit
   413	
   414	SoroPass ships a `PasskeyModule` that implements the kit's `ModuleInterface` (`getAddress`, `signTransaction`, `signAuthEntry`, `isAvailable`), so a passkey wallet appears in the kit's own picker next to Freighter and Lobstr and signs through the kit modal.
   415	
   416	```ts
   417	import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
   418	import { Networks } from '@creit.tech/stellar-wallets-kit/types';
   419	import { PasskeyModule, PASSKEY_ID } from '@creit.tech/stellar-wallets-kit/modules/passkey';
   420	
   421	StellarWalletsKit.init({
   422	  network: Networks.TESTNET,
   423	  modules: [
   424	    // deployer + indexer come from @soropass/core (factoryDeployer / eventsIndexer).
   425	    // With a deployer set, getAddress creates the account on first connect.
   426	    new PasskeyModule({ rpId, networkPassphrase, factoryContractId, deployer, indexer }),
   427	    /* ...other modules */
   428	  ],
   429	});
   430	StellarWalletsKit.setWallet(PASSKEY_ID); // PASSKEY_ID === "passkey"
   431	const { address } = await StellarWalletsKit.getAddress();
   432	```
   433	
   434	The kit's API is static: call `StellarWalletsKit.init(...)` once, then the static methods. The kit's npm package is `@creit.tech/stellar-wallets-kit` (note the dot). The `PasskeyModule` is proposed upstream to `Creit-Tech/Stellar-Wallets-Kit`; the published kit (v2.6.0) does not include the `./modules/passkey` export yet, so this snippet runs once the module lands in a kit release. Until then, call the `@soropass/core` functions above directly; the module wraps exactly those calls. See https://docs.soropass.dev/docs/quickstart for configuration.
   435	
   436	## Errors
   437	
   438	Every failure is a typed `KitError` with a stable `code`. Detect it with `isKitError(err)` and branch on `err.code`. The full frozen set (`KIT_ERROR_CODES`) is: `USER_CANCELLED`, `ES256_NOT_SUPPORTED`, `RP_ID_MISMATCH`, `ORIGIN_MISMATCH`, `CHALLENGE_MISMATCH`, `INVALID_SIGNATURE_DER`, `INVALID_PUBLIC_KEY`, `CONTRACT_AUTH_FAILED`, `NETWORK_ERROR`, `UNSUPPORTED_AUTHENTICATOR`.
   439	
   440	The v0.2 account contract defines its own numeric contract errors, returned on-chain from `__check_auth` and the signer methods (for example `UnknownSigner`, `UserVerifiedFlagMissing`, `LastSignerRemoval`). Those are Soroban contract errors, separate from the ten `KitError` codes above; do not treat one set as the other.
   441	
   442	## Full reference
   443	
   444	- API reference and adapters (OpenZeppelin Relayer, Mercury indexer): https://docs.soropass.dev
   445	- Device/browser compatibility matrix with per-case fallbacks: https://docs.soropass.dev/docs/compatibility
   446	- Package: https://www.npmjs.com/package/@soropass/core
   447	- Drop-in UI screens (create, sign, recover, connect, add-device; framework-agnostic, token-themed): https://www.npmjs.com/package/@soropass/ui
```

## 2026-09-09T10:56:18Z

```
$ npm init -y
```

exit code: 0

```
Wrote to <workdir>/package.json:

{
  "name": "skill-agent-2026-09-09",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}


```

## 2026-09-09T10:56:25Z

```
$ npm install @soropass/core "@stellar/stellar-sdk@>=17"
```

exit code: 0

```

added 44 packages, and audited 45 packages in 4s

13 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

## 2026-09-09T10:56:37Z

```
$ npm ls --depth=0 && echo "--- package.json dependencies ---" && cat package.json && echo "--- lockfile resolved entries for the two installed packages and the peer ---" && node -e "const l=require(\"./package-lock.json\");for (const [k,v] of Object.entries(l.packages)) { if (k===\"\"||k.includes(\"@soropass\")||k.endsWith(\"@stellar/stellar-sdk\")||k.endsWith(\"@stellar/stellar-base\")) console.log(k||\"<root>\", JSON.stringify({version:v.version,resolved:v.resolved,dependencies:v.dependencies,peerDependencies:v.peerDependencies},null,1)); }"
```

exit code: 0

```
skill-agent-2026-09-09@1.0.0 <scratch>
├── @soropass/core@0.3.1
└── @stellar/stellar-sdk@17.0.1

--- package.json dependencies ---
{
  "name": "skill-agent-2026-09-09",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "@soropass/core": "^0.3.1",
    "@stellar/stellar-sdk": "^17.0.1"
  }
}
--- lockfile resolved entries for the two installed packages and the peer ---
<root> {
 "version": "1.0.0",
 "dependencies": {
  "@soropass/core": "^0.3.1",
  "@stellar/stellar-sdk": "^17.0.1"
 }
}
node_modules/@soropass/core {
 "version": "0.3.1",
 "resolved": "https://registry.npmjs.org/@soropass/core/-/core-0.3.1.tgz",
 "dependencies": {
  "@noble/curves": "^1.6.0",
  "@noble/hashes": "^1.5.0"
 },
 "peerDependencies": {
  "@stellar/stellar-sdk": ">=17"
 }
}
node_modules/@stellar/stellar-sdk {
 "version": "17.0.1",
 "resolved": "https://registry.npmjs.org/@stellar/stellar-sdk/-/stellar-sdk-17.0.1.tgz",
 "dependencies": {
  "@exodus/bytes": "^1.15.1",
  "@noble/ed25519": "^3.1.0",
  "@noble/hashes": "^2.2.0",
  "@stellar/js-xdr": "^5.0.0",
  "@types/json-schema": "^7.0.15",
  "axios": "1.18.0",
  "bignumber.js": "^11.1.4",
  "commander": "^14.0.3",
  "eventsource": "^4.1.0",
  "feaxios": "^0.0.23",
  "smol-toml": "^1.6.1",
  "uint8array-extras": "^1.5.0"
 }
}
```

## 2026-09-09T10:56:45Z

```
$ sed -n "31p;65p" skill.md; sed -n "32,64p" skill.md > verify.mjs; echo "--- verify.mjs ($(wc -c < verify.mjs | tr -d " ") bytes) ---"; cat verify.mjs; echo "--- byte-for-byte check against the fenced block ---"; sed -n "32,64p" skill.md | cmp - verify.mjs && echo IDENTICAL; shasum -a 256 verify.mjs
```

exit code: 0

```
```js
```
--- verify.mjs (1288 bytes) ---
// verify.mjs. Run with: node verify.mjs
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import { referenceCheckAuth } from '@soropass/core';
import { xdr } from '@stellar/stellar-sdk';

const NETWORK = 'Test SDF Network ; September 2015';

// 1. CREATE a passkey and deploy its smart account (in-memory, no browser).
const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
const account = await kit.createPasskey({ userName: 'alice' });
console.log('account:', account.contractId, '| key bytes:', account.publicKey.length);

// 2. SIGN a ready-made demo authorization entry with the passkey.
const signedXdr = await kit.signAuthEntry(sampleAuthEntry(account.contractId));

// 3. VERIFY the signature is accepted by __check_auth, and a wrong key is not.
const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64');
console.log(
  referenceCheckAuth(signed, account.publicKey, NETWORK).success
    ? 'PASS: create + sign verified'
    : 'FAIL',
);

const other = await createPasskeyKit({
  mode: 'mock',
  rpId: 'example.com',
  seed: 'other',
}).createPasskey();
console.log(
  !referenceCheckAuth(signed, other.publicKey, NETWORK).success
    ? 'OK: wrong key rejected'
    : 'UNEXPECTED: wrong key accepted',
);
--- byte-for-byte check against the fenced block ---
IDENTICAL
3489e0f2695467f13e37151043140420172ce9e3b09862da53ca8afad0c43cdc  verify.mjs
```

## 2026-09-09T10:56:50Z

```
$ node verify.mjs; echo "exit=$?"
```

exit code: 0

```
account: CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5 | key bytes: 65
PASS: create + sign verified
OK: wrong key rejected
exit=0
```

## 2026-09-09T10:57:18Z

```
$ sed -n "121p;139p" skill.md; { sed -n "122,137p" skill.md; cat <<'EOF'

// --- added by the agent (not in the skill file): print + persist the sponsor so later scripts can reuse it ---
import { writeFileSync } from "node:fs";
console.log("sponsor public key:", sponsor.publicKey());
writeFileSync("sponsor.json", JSON.stringify({ publicKey: sponsor.publicKey(), secret: sourceSecret }, null, 2));
console.log("funded:", funded, "| wrote sponsor.json");
EOF
} > sponsor.mjs; echo "--- sponsor.mjs ---"; cat sponsor.mjs; echo "--- lines 1-16 identical to skill lines 122-137? ---"; sed -n "122,137p" skill.md | cmp - <(head -n 16 sponsor.mjs) && echo IDENTICAL
```

exit code: 0

```
```js

--- sponsor.mjs ---
import { Keypair, rpc } from '@stellar/stellar-sdk';

const sponsor = Keypair.random();
await fetch(`https://friendbot.stellar.org/?addr=${sponsor.publicKey()}`);
const server = new rpc.Server('https://soroban-testnet.stellar.org');
let funded = false;
for (let i = 0; i < 30 && !funded; i++) {
  try {
    await server.getAccount(sponsor.publicKey());
    funded = true;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!funded) throw new Error('sponsor funded but not visible on the Soroban RPC after 30s');
const sourceSecret = sponsor.secret();

// --- added by the agent (not in the skill file): print + persist the sponsor so later scripts can reuse it ---
import { writeFileSync } from "node:fs";
console.log("sponsor public key:", sponsor.publicKey());
writeFileSync("sponsor.json", JSON.stringify({ publicKey: sponsor.publicKey(), secret: sourceSecret }, null, 2));
console.log("funded:", funded, "| wrote sponsor.json");
--- lines 1-16 identical to skill lines 122-137? ---
IDENTICAL
```

## 2026-09-09T10:57:23Z

```
$ node sponsor.mjs; echo "exit=$?"
```

exit code: 0

```
sponsor public key: GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
funded: true | wrote sponsor.json
exit=0
```

## 2026-09-09T10:57:41Z

```
$ ADDR=$(node -p "require(\"./sponsor.json\").publicKey"); echo "sponsor=$ADDR"; curl -sS "https://horizon-testnet.stellar.org/accounts/$ADDR" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const a=JSON.parse(s);console.log(JSON.stringify({id:a.id,sequence:a.sequence,balances:a.balances,last_modified_ledger:a.last_modified_ledger},null,2))})"; echo "--- transactions for the sponsor account ---"; curl -sS "https://horizon-testnet.stellar.org/accounts/$ADDR/transactions?limit=10&order=asc" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const r=JSON.parse(s);for(const t of r._embedded.records){console.log(JSON.stringify({hash:t.hash,successful:t.successful,ledger:t.ledger,created_at:t.created_at,source_account:t.source_account,operation_count:t.operation_count},null,2))}})"
```

exit code: 0

```
sponsor=GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
{
  "id": "GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T",
  "sequence": "19694881773453312",
  "balances": [
    {
      "balance": "10000.0000000",
      "buying_liabilities": "0.0000000",
      "selling_liabilities": "0.0000000",
      "asset_type": "native"
    }
  ],
  "last_modified_ledger": 4585572
}
--- transactions for the sponsor account ---
{
  "hash": "6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7",
  "successful": true,
  "ledger": 4585572,
  "created_at": "2026-09-09T10:57:27Z",
  "source_account": "GDCZMVMT4OAOWC7PT3DCUJBU2QWDPYV3FDZXEA6NCSYTSXV6MIGWSXNF",
  "operation_count": 1
}
```

## 2026-09-09T10:57:48Z

```
$ echo "--- @soropass/core package.json ---"; cat node_modules/@soropass/core/package.json; echo; echo "--- file list ---"; find node_modules/@soropass/core -type f | sort
```

exit code: 0

```
--- @soropass/core package.json ---
{
  "name": "@soropass/core",
  "version": "0.3.1",
  "description": "Minimal, headless, ES256-only passkey SDK for Stellar smart accounts.",
  "license": "Apache-2.0",
  "keywords": [
    "passkey",
    "passkeys",
    "webauthn",
    "es256",
    "secp256r1",
    "stellar",
    "soroban",
    "smart-account",
    "smart-wallet",
    "sdk"
  ],
  "homepage": "https://docs.soropass.dev",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/justmert/soropass.git",
    "directory": "packages/core"
  },
  "bugs": {
    "url": "https://github.com/justmert/soropass/issues"
  },
  "publishConfig": {
    "access": "public"
  },
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./create": {
      "import": {
        "types": "./dist/create.d.ts",
        "default": "./dist/create.js"
      },
      "require": {
        "types": "./dist/create.d.cts",
        "default": "./dist/create.cjs"
      }
    },
    "./connect": {
      "import": {
        "types": "./dist/connect.d.ts",
        "default": "./dist/connect.js"
      },
      "require": {
        "types": "./dist/connect.d.cts",
        "default": "./dist/connect.cjs"
      }
    },
    "./sign": {
      "import": {
        "types": "./dist/sign.d.ts",
        "default": "./dist/sign.js"
      },
      "require": {
        "types": "./dist/sign.d.cts",
        "default": "./dist/sign.cjs"
      }
    },
    "./recover": {
      "import": {
        "types": "./dist/recover.d.ts",
        "default": "./dist/recover.js"
      },
      "require": {
        "types": "./dist/recover.d.cts",
        "default": "./dist/recover.cjs"
      }
    },
    "./types": {
      "import": {
        "types": "./dist/types.d.ts",
        "default": "./dist/types.js"
      },
      "require": {
        "types": "./dist/types.d.cts",
        "default": "./dist/types.cjs"
      }
    },
    "./testing": {
      "import": {
        "types": "./dist/testing.d.ts",
        "default": "./dist/testing.js"
      },
      "require": {
        "types": "./dist/testing.d.cts",
        "default": "./dist/testing.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage --coverage.reporter=text --coverage.reporter=json-summary",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint src"
  },
  "peerDependencies": {
    "@stellar/stellar-sdk": ">=17"
  },
  "peerDependenciesMeta": {
    "@stellar/stellar-sdk": {
      "optional": false
    }
  },
  "dependencies": {
    "@noble/curves": "^1.6.0",
    "@noble/hashes": "^1.5.0"
  },
  "devDependencies": {
    "@stellar/stellar-sdk": "^17.0.1",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}

--- file list ---
node_modules/@soropass/core/LICENSE
node_modules/@soropass/core/README.md
node_modules/@soropass/core/dist/checkAuth-B5ObsEsP.d.cts
node_modules/@soropass/core/dist/checkAuth-B5ObsEsP.d.ts
node_modules/@soropass/core/dist/chunk-2KLSTE4E.js
node_modules/@soropass/core/dist/chunk-2KLSTE4E.js.map
node_modules/@soropass/core/dist/chunk-ADOLDX2M.js
node_modules/@soropass/core/dist/chunk-ADOLDX2M.js.map
node_modules/@soropass/core/dist/chunk-AMYFJQAC.js
node_modules/@soropass/core/dist/chunk-AMYFJQAC.js.map
node_modules/@soropass/core/dist/chunk-AVFLEEWC.js
node_modules/@soropass/core/dist/chunk-AVFLEEWC.js.map
node_modules/@soropass/core/dist/chunk-GHCB22YI.js
node_modules/@soropass/core/dist/chunk-GHCB22YI.js.map
node_modules/@soropass/core/dist/chunk-LB4HOTLV.js
node_modules/@soropass/core/dist/chunk-LB4HOTLV.js.map
node_modules/@soropass/core/dist/chunk-LUDXP56M.js
node_modules/@soropass/core/dist/chunk-LUDXP56M.js.map
node_modules/@soropass/core/dist/chunk-MOLZIRIH.js
node_modules/@soropass/core/dist/chunk-MOLZIRIH.js.map
node_modules/@soropass/core/dist/chunk-OGSUGATA.js
node_modules/@soropass/core/dist/chunk-OGSUGATA.js.map
node_modules/@soropass/core/dist/chunk-TLPYQBZI.js
node_modules/@soropass/core/dist/chunk-TLPYQBZI.js.map
node_modules/@soropass/core/dist/chunk-TPBBZNPP.js
node_modules/@soropass/core/dist/chunk-TPBBZNPP.js.map
node_modules/@soropass/core/dist/chunk-WQVM42KI.js
node_modules/@soropass/core/dist/chunk-WQVM42KI.js.map
node_modules/@soropass/core/dist/chunk-Y6L7PG4O.js
node_modules/@soropass/core/dist/chunk-Y6L7PG4O.js.map
node_modules/@soropass/core/dist/chunk-ZVP542X6.js
node_modules/@soropass/core/dist/chunk-ZVP542X6.js.map
node_modules/@soropass/core/dist/connect.cjs
node_modules/@soropass/core/dist/connect.cjs.map
node_modules/@soropass/core/dist/connect.d.cts
node_modules/@soropass/core/dist/connect.d.ts
node_modules/@soropass/core/dist/connect.js
node_modules/@soropass/core/dist/connect.js.map
node_modules/@soropass/core/dist/create.cjs
node_modules/@soropass/core/dist/create.cjs.map
node_modules/@soropass/core/dist/create.d.cts
node_modules/@soropass/core/dist/create.d.ts
node_modules/@soropass/core/dist/create.js
node_modules/@soropass/core/dist/create.js.map
node_modules/@soropass/core/dist/index.cjs
node_modules/@soropass/core/dist/index.cjs.map
node_modules/@soropass/core/dist/index.d.cts
node_modules/@soropass/core/dist/index.d.ts
node_modules/@soropass/core/dist/index.js
node_modules/@soropass/core/dist/index.js.map
node_modules/@soropass/core/dist/recover-BOq0DQaU.d.cts
node_modules/@soropass/core/dist/recover-CL_jZ2kN.d.ts
node_modules/@soropass/core/dist/recover.cjs
node_modules/@soropass/core/dist/recover.cjs.map
node_modules/@soropass/core/dist/recover.d.cts
node_modules/@soropass/core/dist/recover.d.ts
node_modules/@soropass/core/dist/recover.js
node_modules/@soropass/core/dist/recover.js.map
node_modules/@soropass/core/dist/sign-O5d7Moma.d.cts
node_modules/@soropass/core/dist/sign-O5d7Moma.d.ts
node_modules/@soropass/core/dist/sign.cjs
node_modules/@soropass/core/dist/sign.cjs.map
node_modules/@soropass/core/dist/sign.d.cts
node_modules/@soropass/core/dist/sign.d.ts
node_modules/@soropass/core/dist/sign.js
node_modules/@soropass/core/dist/sign.js.map
node_modules/@soropass/core/dist/submit-BKogb6Y8.d.cts
node_modules/@soropass/core/dist/submit-CKJp7XgZ.d.ts
node_modules/@soropass/core/dist/testing.cjs
node_modules/@soropass/core/dist/testing.cjs.map
node_modules/@soropass/core/dist/testing.d.cts
node_modules/@soropass/core/dist/testing.d.ts
node_modules/@soropass/core/dist/testing.js
node_modules/@soropass/core/dist/testing.js.map
node_modules/@soropass/core/dist/types-BJsL-q2B.d.ts
node_modules/@soropass/core/dist/types-B_pVAg-T.d.cts
node_modules/@soropass/core/dist/types-CJluKV7s.d.cts
node_modules/@soropass/core/dist/types-CJluKV7s.d.ts
node_modules/@soropass/core/dist/types.cjs
node_modules/@soropass/core/dist/types.cjs.map
node_modules/@soropass/core/dist/types.d.cts
node_modules/@soropass/core/dist/types.d.ts
node_modules/@soropass/core/dist/types.js
node_modules/@soropass/core/dist/types.js.map
node_modules/@soropass/core/package.json
```

## 2026-09-09T10:57:54Z

```
$ cat node_modules/@soropass/core/README.md
```

exit code: 0

```
# @soropass/core

[![npm](https://img.shields.io/npm/v/@soropass/core.svg)](https://www.npmjs.com/package/@soropass/core)
[![license](https://img.shields.io/npm/l/@soropass/core.svg)](./LICENSE)

Minimal, headless, ES256-only passkey SDK for Stellar smart accounts. It turns a WebAuthn passkey (Face ID, Touch ID, a security key) into the signer of a Soroban smart account, and handles the parts that are easy to get wrong: ES256 enforcement, DER-to-compact low-S conversion, the `__check_auth` authorization-entry wire shape, deterministic C-address derivation, and multi-device recovery.

It ships no UI and no framework opinions, and keeps `@stellar/stellar-sdk` as a peer dependency so it is never bundled twice. For drop-in create/sign/recover screens, see [`@soropass/ui`](https://www.npmjs.com/package/@soropass/ui). To register a passkey wallet in [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit), see the [integration guide](https://docs.soropass.dev/docs/wallets-kit).

## Why a passkey needs a smart account

A passkey signs with secp256r1 (ES256); a classic Stellar account (`G...`) only verifies Ed25519. So a passkey controls a Soroban **smart-account contract** (`C...`) whose `__check_auth` verifies the WebAuthn assertion on-chain via the host `secp256r1_verify`. This SDK owns that `C` side: create, sign, recover, add a signer.

## Install

```bash
npm install @soropass/core "@stellar/stellar-sdk@>=17"
```

`@stellar/stellar-sdk` is a required peer dependency. Install version 17 or newer (the `>=17` peer range): this release builds against the stellar-sdk 17 XDR API. If you must stay on stellar-sdk 12 through 16, install `@soropass/core@0.2.1` instead; 0.2.1 signs only classic address credentials, while 0.3.0 also signs the `addressV2` credentials that Protocol 23 networks return from simulation. `@soropass/core` publishes ESM, CommonJS, and type declarations, and runs without a `Buffer` polyfill.

## Quick start (no browser)

Reproduce a create + sign in Node or CI with the built-in mock authenticator, no WebAuthn hardware and no network. Save as `verify.mjs` and run `node verify.mjs`:

```js
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import { referenceCheckAuth } from '@soropass/core';
import { xdr } from '@stellar/stellar-sdk';

const NETWORK = 'Test SDF Network ; September 2015';

// Create a passkey and deploy its smart account (in-memory).
const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
const account = await kit.createPasskey({ userName: 'alice' });

// Sign a demo auth entry, then verify it the way the on-chain __check_auth does.
const signed = xdr.SorobanAuthorizationEntry.fromXDR(
  await kit.signAuthEntry(sampleAuthEntry(account.contractId)),
  'base64',
);
console.log(referenceCheckAuth(signed, account.publicKey, NETWORK).success ? 'PASS' : 'FAIL');
```

## Create a real account in the browser

```ts
import { createPasskey, factoryDeployer } from '@soropass/core';
import { Networks } from '@stellar/stellar-sdk';

const account = await createPasskey({
  rpId: location.hostname,
  rpName: 'My Stellar App',
  userName: 'alice',
  deployer: factoryDeployer({
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
    factoryContractId: 'C...', // your AccountFactory
    sourceSecret, // a funded account that pays the one-time deploy fee
  }),
});
// account.contractId · account.credentialId · account.publicKey
```

Sign a transaction with `signTransaction` / `browserPasskeySigner`, resolve a returning user offline with `deriveAccountAddress`, and add a backup device with `registerPasskey` + `add_signer`. The full flows are in the [SDK reference](https://docs.soropass.dev/docs/sdk).

## What you get

- **ES256-only.** Registration pins `pubKeyCredParams` to alg `-7`; anything else throws `KitError('ES256_NOT_SUPPORTED')`.
- **Always low-S.** Roughly half of Apple passkeys emit high-S signatures; the SDK normalizes every signature to canonical low-S so it verifies on-chain.
- **Tree-shakeable subpaths.** Import only what you use; the heavy crypto is pulled only by `/create` and `/sign`.
- **Pluggable adapters** for submission (direct, Launchtube, OpenZeppelin Relayer) and indexing (on-chain events, Mercury).
- **One typed error taxonomy.** Every throw is a `KitError` with a code from a frozen 10-code set.

| Subpath                  | Contents                                                                          |
| ------------------------ | --------------------------------------------------------------------------------- |
| `.`                      | Full public surface                                                               |
| `@soropass/core/create`  | `createPasskey`, `registerPasskey`, `deriveAccountAddress`, public-key extraction |
| `@soropass/core/sign`    | `signTransaction`, `signAuthEntry`, `browserPasskeySigner`, low-S helpers         |
| `@soropass/core/connect` | `connect`                                                                         |
| `@soropass/core/recover` | `recover`, `addSigner`, `removeSigner`                                            |
| `@soropass/core/types`   | `KitError`, `KIT_ERROR_CODES`, `isKitError`                                       |
| `@soropass/core/testing` | `createPasskeyKit` mock mode, `sampleAuthEntry` (dev only)                        |

## Documentation

- Full docs and API reference: [docs.soropass.dev](https://docs.soropass.dev)
- Quickstart (three integration paths): [docs.soropass.dev/docs/quickstart](https://docs.soropass.dev/docs/quickstart)
- Compatibility matrix (device / browser / hardware): [docs.soropass.dev/docs/compatibility](https://docs.soropass.dev/docs/compatibility)

## License

Apache-2.0
```

## 2026-09-09T10:58:03Z

```
$ cat node_modules/@soropass/core/dist/testing.d.ts
```

exit code: 0

```
import { ConnectResult } from './connect.js';
import { a as RecoverResult } from './recover-CL_jZ2kN.js';
import { b as WebAuthnSigner, A as AssertionResult } from './sign-O5d7Moma.js';
import { W as WebAuthnClient, A as AccountDeployer, I as IndexerAdapter, S as SubmissionAdapter, C as CredentialStorage } from './types-CJluKV7s.js';
import { P as PasskeyCredential } from './types-BJsL-q2B.js';
import './checkAuth-B5ObsEsP.js';
import '@stellar/stellar-sdk';

interface CreatePasskeyKitOptions {
    mode: 'mock' | 'live';
    rpId: string;
    rpName?: string;
    networkPassphrase?: string;
    seed?: string;
    forceHighS?: boolean;
    webauthn?: WebAuthnClient;
    deployer?: AccountDeployer;
    indexer?: IndexerAdapter;
    submission?: SubmissionAdapter;
    storage?: CredentialStorage;
    signer?: WebAuthnSigner;
}
interface PasskeyKit {
    readonly mode: 'mock' | 'live';
    readonly rpId: string;
    createPasskey(input?: {
        userName?: string;
    }): Promise<PasskeyCredential>;
    connect(): Promise<ConnectResult | null>;
    recover(): Promise<RecoverResult[]>;
    signAuthEntry(entryXdr: string): Promise<string>;
}
/**
 * The downstream-adopter kit (S15, Deliverable #6). `mode:'mock'` wires a
 * deterministic in-memory authenticator + backend (zero network IO) so the
 * happy path matches the live path's SHAPE — swap `mock → live` and the demo
 * stays green. `mode:'live'` takes real adapters + a WebAuthn signer.
 */
declare function createPasskeyKit(options: CreatePasskeyKitOptions): PasskeyKit;

interface MockAuthenticatorOptions {
    rpId: string;
    origin?: string;
    /** Deterministic seed → keypair + credentialId. */
    seed?: string;
    /** Emit high-S signatures, to exercise the perpetual low-S guard (S04). */
    forceHighS?: boolean;
}
interface MockAuthenticator extends WebAuthnClient {
    readonly publicKey: Uint8Array;
    readonly credentialId: string;
    readonly privateKey: Uint8Array;
    /** WebAuthnSigner for the Soroban sign path (challenge already base64url). */
    sign(challenge: string): AssertionResult;
}
/**
 * A deterministic, in-memory WebAuthn authenticator for the mock kit (S15). It
 * synthesizes a REAL attestationObject / COSE key (so `createPasskey` runs the
 * exact production extraction path) and signs assertions with the same P-256
 * key — optionally as high-S to prove the low-S normalization guard.
 */
declare function mockAuthenticator(options: MockAuthenticatorOptions): MockAuthenticator;

interface InMemoryBackend {
    deployer: AccountDeployer;
    indexer: IndexerAdapter;
    submission: SubmissionAdapter;
    /** credentialId → { contractId, publicKey } — shared so create/connect/recover agree. */
    registry: Map<string, {
        contractId: string;
        publicKey: Uint8Array;
    }>;
}
/**
 * Deterministic, zero-IO backend for the mock kit: the deployer derives a stable
 * C-address from the credentialId and records it; the indexer resolves from the
 * same registry; submission is a no-op SUCCESS.
 *
 * The address is a real StrKey contract id (checksummed, decodable), so a mock
 * account can be fed straight into `new Address(...)` / auth-entry XDR the same way
 * a deployed one is. It is deterministic but arbitrary: it is not the address the
 * factory would deploy for this credential (that is {@link deriveAccountAddress}).
 */
declare function createInMemoryBackend(): InMemoryBackend;

/**
 * A ready-to-sign `SorobanAuthorizationEntry` (base64 XDR) for a demo call on
 * `contractId`. A convenience for smoke tests and examples, so you do not hand-
 * build auth-entry XDR just to have something to sign. The nonce and expiration
 * are fixed placeholders, so this is for local verification, not production.
 *
 * Requires `@stellar/stellar-sdk >=17` (the package's peer range).
 */
declare function sampleAuthEntry(contractId: string, functionName?: string): string;

export { type CreatePasskeyKitOptions, type InMemoryBackend, type MockAuthenticator, type MockAuthenticatorOptions, type PasskeyKit, createInMemoryBackend, createPasskeyKit, mockAuthenticator, sampleAuthEntry };
```

## 2026-09-09T10:58:05Z

```
$ cat node_modules/@soropass/core/dist/index.d.ts; echo "=== create.d.ts ==="; cat node_modules/@soropass/core/dist/create.d.ts
```

exit code: 0

Output was 344 lines; showing the first 150 and last 150 lines.

```
export { B as BATTLE_TESTED_ANCHORS, a as BattleTestedAnchor, K as KIT_ERROR_CODES, b as KitError, c as KitErrorCode, P as PasskeyCredential, d as assertES256, e as assertUserActivation, i as isKitError } from './types-BJsL-q2B.js';
export { CreatePasskeyOptions, DeriveAccountAddressOptions, DeriveSmartWalletAddressOptions, RegisterPasskeyOptions, RegisteredPasskey, browserWebAuthnClient, coseKeyToSec1, createPasskey, defaultCredentialStorage, deriveAccountAddress, deriveSmartWalletAddress, extractPublicKeyFromAttestationObject, extractPublicKeyFromAuthData, registerPasskey } from './create.js';
import { S as SubmissionAdapter, b as ResolvedAccount, I as IndexerAdapter, A as AccountDeployer } from './types-CJluKV7s.js';
export { B as BuildCreateOptionsInput, C as CredentialStorage, P as PubKeyCredParam, a as PublicKeyCredentialCreationOptionsJSON, R as ResidentKeyRequirement, c as SubmitResult, U as UserVerificationRequirement, W as WebAuthnClient, d as WebAuthnCreateResult, e as WebAuthnGetOptions, f as WebAuthnGetResult, g as buildCreateOptions } from './types-CJluKV7s.js';
export { BrowserPasskeySignerOptions, applyAssertionToEntry, applyAssertionToSmartWalletEntry, authEntryChallenge, authEntryChallengeBytes, browserPasskeySigner, buildSignerKeyScVal, buildSmartWalletSignatureVariant, compareSignerKeyScVal, derToCompact, derToCompactLowS, isLowS, normalizeLowS, reconstructSignedPayload } from './sign.js';
export { A as AuthenticatorDataFlags, C as CheckAuthResult, a as ClientData, P as ParsedAuthenticatorData, S as SmartWalletCheckAuthResult, V as VerifyAssertionInput, d as decodeChallenge, e as encodeChallenge, p as parseAuthenticatorData, b as parseClientDataJSON, r as referenceCheckAuth, c as referenceSmartWalletCheckAuth, v as verifyAssertionSignature, f as verifyClientDataJSON, g as verifyRpIdHash } from './checkAuth-B5ObsEsP.js';
export { A as AssertionResult, S as SignVerifyOptions, a as SorobanSignOptions, W as WalletTarget, b as WebAuthnSigner, s as signAuthEntry, c as signTransaction } from './sign-O5d7Moma.js';
export { B as BuildAddSignerOptions, a as BuildRemoveSignerOptions, S as Secp256r1SignerSpec, b as SendSmartWalletTxOptions, c as SignerStorage, d as buildAddSignerOperation, e as buildRemoveSignerOperation, f as buildSecp256r1Signer, s as sendSmartWalletTx } from './submit-CKJp7XgZ.js';
export { ConnectOptions, ConnectResult, connect } from './connect.js';
export { R as RecoverOptions, a as RecoverResult, r as recover } from './recover-CL_jZ2kN.js';
export { AddSignerOptions, NewDeviceSigner, RemoveSignerOptions, WalletCallOptions, addSigner, removeSigner } from './recover.js';
import { rpc } from '@stellar/stellar-sdk';

interface DirectSubmissionOptions {
    rpcUrl: string;
    networkPassphrase: string;
    allowHttp?: boolean;
    /** Max confirmation-poll attempts before failing with NETWORK_ERROR (default 30). */
    pollAttempts?: number;
    /** Delay between confirmation polls, in ms (default 1000). */
    pollIntervalMs?: number;
}
/**
 * Default, zero-infra submission: send straight to soroban-rpc and poll. No
 * relayer, no API key. Swappable with `launchtube`/`openzeppelinRelayer` with
 * zero ceremony changes (same `SubmissionAdapter` shape).
 */
declare function directSubmission(options: DirectSubmissionOptions): SubmissionAdapter;

/**
 * Bounded retry/backoff for the optional HTTP adapters (Launchtube / OZ Relayer /
 * Mercury). Opt-in: `retries` defaults to 1 (no retry), preserving the plain
 * single-shot behavior unless a caller asks for resilience.
 */
interface RetryOptions {
    /** Total attempts including the first (default 1 = no retry). */
    retries?: number;
    /** Linear backoff base in ms; attempt N waits `backoffMs * N` (default 300). */
    backoffMs?: number;
}

interface LaunchtubeSubmissionOptions {
    url: string;
    /** Bearer token (Launchtube is invite/credit-gated). */
    token?: string;
    /** Optional bounded retry on transient (429 / 5xx / network) failures. */
    retry?: RetryOptions;
}
/**
 * Legacy Launchtube relay (optional). Modelled as ONE submission adapter — the
 * SDK does not depend on it; `direct` is the default and `openzeppelinRelayer`
 * is the post-Launchtube direction. A network failure surfaces as a typed
 * `KitError('NETWORK_ERROR')`; an HTTP error becomes a `FAILED` result carrying
 * the relay's error body.
 */
declare function launchtubeSubmission(options: LaunchtubeSubmissionOptions): SubmissionAdapter;

interface OpenZeppelinRelayerOptions {
    url: string;
    apiKey?: string;
    /** Optional bounded retry on transient (429 / 5xx / network) failures. */
    retry?: RetryOptions;
}
/**
 * OpenZeppelin Relayer / Channels submission (the post-Launchtube direction).
 * Same `SubmissionAdapter` shape, so swapping it in is a one-line config change.
 * A network failure surfaces as `KitError('NETWORK_ERROR')`; an HTTP error (or a
 * `status: "failed"` body) becomes a `FAILED` result.
 */
declare function openzeppelinRelayerSubmission(options: OpenZeppelinRelayerOptions): SubmissionAdapter;

interface EventsIndexerOptions {
    rpcUrl: string;
    /**
     * The passkey factory contract that emits an `add`/deploy event per account.
     * Defaults to the deployed SoroPass factory for `networkPassphrase` (see
     * `DEFAULT_ACCOUNT_FACTORIES`); one of the two options must be set.
     */
    factoryContractId?: string;
    /** Selects the default factory when `factoryContractId` is omitted. */
    networkPassphrase?: string;
    /** Ledger to scan from; defaults to ~1 day back from the latest ledger. */
    startLedger?: number;
    allowHttp?: boolean;
    /**
     * Map a factory event → resolved account when it concerns `credentialId`.
     * Defaults to the deployed `AccountFactory` schema (see contracts/account-factory):
     * topics `[symbol "deployed", bytes credentialId, bytes publicKey]`, value = the
     * deployed C-address. Override only for a different factory event shape.
     */
    matchEvent?: (event: rpc.Api.EventResponse, credentialId: string) => ResolvedAccount | null;
}
/**
 * Default, zero-infra indexer: soroban-rpc `getEvents` filtered on the factory
 * contract — no external indexing service. `mercury` is an optional alternative;
 * the SDK works with `events` alone.
 */
declare function eventsIndexer(options: EventsIndexerOptions): IndexerAdapter;

interface MercuryIndexerOptions {
    url: string;
    token?: string;
    /** Map the Mercury/Zephyr JSON response → resolved accounts. */
    parse?: (json: unknown) => ResolvedAccount[];
    /** Optional bounded retry on transient (429 / 5xx / network) failures. */
    retry?: RetryOptions;
}
/**
 * Optional Mercury (Zephyr) indexer. Entirely optional — `events` is the
 * zero-infra default and the SDK never requires Mercury. A network failure
 * surfaces as `KitError('NETWORK_ERROR')`; an HTTP error throws
 * `NETWORK_ERROR` too, so a server error is never silently read as "no accounts".
 */
declare function mercuryIndexer(options: MercuryIndexerOptions): IndexerAdapter;

interface DefaultAdapterOptions {
    rpcUrl: string;
    networkPassphrase: string;
    factoryContractId: string;
    allowHttp?: boolean;
}
/** The zero-infra default stack: `direct` submission + `events` indexer. */
declare function defaultAdapters(options: DefaultAdapterOptions): {
    submission: SubmissionAdapter;
    indexer: IndexerAdapter;
};

interface FactoryDeployerOptions {
    rpcUrl: string;
    networkPassphrase: string;
    /**
     * The `AccountFactory` contract id (`C…`). Defaults to the deployed SoroPass
     * factory for `networkPassphrase` (see `DEFAULT_ACCOUNT_FACTORIES`); set it
     * only to deploy through a different factory.
     */
    factoryContractId?: string;
    /**
     * Secret of the testnet account that pays the fee + signs the deploy tx. The
     * factory's `deploy` is not auth-gated, so this just sources/sponsors the
     * transaction. In a public demo this is an ephemeral, friendbot-funded key —
     * never a key with value.
     */
    sourceSecret: string;
    allowHttp?: boolean;
    fee?: string;
}
/**
 * `AccountDeployer` backed by the on-chain `AccountFactory`: invokes
 * `factory.deploy(public_key, credential_id)`, which deploys a fresh
 * `webauthn-account` for the passkey and emits the `(deployed, credentialId)`
[... 44 lines omitted ...]
 * (deploy emits `signer_added`) and signers added later via `add_signer`.
 *
 * A single `getEvents` call only scans a bounded ledger slice from `startLedger`
 * (not the whole window) and returns a cursor, so a naive one-shot query misses
 * events near the tip — the exact reason recovery of a just-created wallet found
 * nothing. We therefore PAGINATE by cursor from `startLedger` to the tip,
 * accumulating every wallet the credential signs for. soroban-rpc retains only a
 * limited window, so this is the zero-infra default for recent wallets; use a
 * persistent indexer (Mercury) for older ones.
 */
declare function smartWalletV1Indexer(options: SmartWalletV1IndexerOptions): IndexerAdapter;

/**
 * The canonical SoroPass `AccountFactory` deployments, keyed by network
 * passphrase. These factories are permissionless: `deploy` is not auth-gated,
 * anyone can create accounts through them, and the wasm they instantiate is the
 * reproducible v0.2 multi-signer `webauthn-account` build recorded in
 * contracts/deployments.json. `factoryDeployer`, `eventsIndexer`, and
 * `deriveAccountAddress` fall back to these when no `factoryContractId` is
 * given, so a sponsor creates accounts through the deployed factory for its
 * network unless it explicitly points at another one.
 */
declare const DEFAULT_ACCOUNT_FACTORIES: Readonly<Record<string, string>>;
/**
 * The default `AccountFactory` C-address for `networkPassphrase`. Throws a
 * typed `KitError` for a network with no deployed default (a local network, a
 * fork): pass `factoryContractId` explicitly there.
 */
declare function defaultAccountFactory(networkPassphrase: string): string;

export { AccountDeployer, DEFAULT_ACCOUNT_FACTORIES, type DefaultAdapterOptions, type DirectSubmissionOptions, type EventsIndexerOptions, type FactoryDeployerOptions, IndexerAdapter, type LaunchtubeSubmissionOptions, type MercuryIndexerOptions, type OpenZeppelinRelayerOptions, ResolvedAccount, SMART_WALLET_V1_WASM_HASH, type SmartWalletV1DeployerOptions, type SmartWalletV1IndexerOptions, SubmissionAdapter, defaultAccountFactory, defaultAdapters, directSubmission, eventsIndexer, factoryDeployer, launchtubeSubmission, mercuryIndexer, openzeppelinRelayerSubmission, smartWalletV1Deployer, smartWalletV1Indexer };
=== create.d.ts ===
import { P as PasskeyCredential } from './types-BJsL-q2B.js';
export { d as assertES256, e as assertUserActivation } from './types-BJsL-q2B.js';
import { A as AccountDeployer, W as WebAuthnClient, C as CredentialStorage } from './types-CJluKV7s.js';
export { g as buildCreateOptions } from './types-CJluKV7s.js';
import './checkAuth-B5ObsEsP.js';
import '@stellar/stellar-sdk';
import './sign-O5d7Moma.js';

interface CreatePasskeyOptions {
    rpId: string;
    rpName: string;
    userName: string;
    /** Deploys the smart account for the new passkey (contract-specific; see AccountDeployer). */
    deployer: AccountDeployer;
    webauthn?: WebAuthnClient;
    storage?: CredentialStorage;
    userId?: Uint8Array;
    challenge?: Uint8Array;
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: 'discouraged' | 'preferred' | 'required';
    /** Pass navigator.userActivation to enforce the Safari gesture requirement (S04). */
    userActivation?: {
        isActive: boolean;
    };
}
/** Options for {@link registerPasskey} — a create WITHOUT deploy (see below). */
type RegisterPasskeyOptions = Omit<CreatePasskeyOptions, 'deployer' | 'storage'>;
/** A freshly-registered passkey credential (no account deployed yet). */
interface RegisteredPasskey {
    /** base64url credential id returned by the authenticator. */
    credentialId: string;
    /** SEC-1 uncompressed public key (65 bytes). */
    publicKey: Uint8Array;
}
/**
 * `registerPasskey` — register an ES256-only passkey and extract its SEC-1 public
 * key (RS256 hard-fails), but do NOT deploy an account or persist anything. This
 * is the "new device" primitive for multi-device recovery: a fresh device
 * produces a `{credentialId, publicKey}` signer spec that an existing device then
 * authorizes on-chain via `addSigner`. (`createPasskey` is this plus a deploy.)
 */
declare function registerPasskey(options: RegisterPasskeyOptions): Promise<RegisteredPasskey>;
/**
 * `createPasskey` — register an ES256-only passkey (see {@link registerPasskey}),
 * deploy a smart account for it via the factory, persist the credential id, and
 * return the account.
 */
declare function createPasskey(options: CreatePasskeyOptions): Promise<PasskeyCredential>;

/** The browser `WebAuthnClient` backed by `navigator.credentials`. */
declare function browserWebAuthnClient(): WebAuthnClient;
/** localStorage-backed credential store, with an in-memory fallback (Node/SSR). */
declare function defaultCredentialStorage(): CredentialStorage;

/**
 * Convert a CBOR-encoded COSE EC2 public key to the 65-byte SEC-1 uncompressed
 * point `0x04 ‖ X ‖ Y`. Enforces ES256/P-256 — anything else (e.g. RS256)
 * throws `ES256_NOT_SUPPORTED` (invariant #1).
 */
declare function coseKeyToSec1(coseKey: Uint8Array): Uint8Array;
/** Extract the SEC-1 public key from raw authenticatorData (attested data). */
declare function extractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array;
/** Extract the SEC-1 public key from a CBOR attestationObject (create ceremony). */
declare function extractPublicKeyFromAttestationObject(attestationObject: Uint8Array): Uint8Array;

interface DeriveAccountAddressOptions {
    /**
     * The AccountFactory contract C-address — the deployer. Defaults to the
     * deployed SoroPass factory for `networkPassphrase` (see
     * `DEFAULT_ACCOUNT_FACTORIES`).
     */
    factoryContractId?: string;
    /** The credential-id bytes the factory salts (utf-8 of the base64url id in our factory). */
    credentialId: Uint8Array;
    /**
     * SEC-1 (65-byte) public key of the founding passkey. The v0.2 factory binds
     * it into the deploy salt (`sha256(credential_id ‖ public_key)`) so a public
     * credential id alone cannot be used to squat a derived address.
     */
    publicKey: Uint8Array;
    networkPassphrase: string;
}
/**
 * Derive the deterministic C-address of the `webauthn-account` our AccountFactory
 * deploys for a passkey — with NO network round-trip. The v0.2 factory salts by
 * `sha256(credential_id ‖ public_key)` and deploys with
 * `deployer().with_current_contract(salt)`. Binding the public key is the F1
 * fix: a credential id is public (the factory emits it), so salting by it alone
 * let anyone pre-deploy at a victim's address with their own key. For the
 * passkey-kit v1 smart-wallet, use {@link deriveSmartWalletAddress} instead
 * (different deployer + salt-input scheme).
 */
declare function deriveAccountAddress(options: DeriveAccountAddressOptions): string;
interface DeriveSmartWalletAddressOptions {
    /**
     * The account that deploys the wallet via `createCustomContract` — a classic
     * G-address (or a factory C-address). MUST be stable for offline `getAddress`.
     */
    deployer: string;
    /** base64url WebAuthn credential id of the FOUNDING passkey — its RAW bytes are salted. */
    credentialId: string;
    networkPassphrase: string;
}
/**
 * Derive the deterministic C-address of a passkey-kit **v1 smart-wallet** — offline,
 * no network. Mirrors passkey-kit's scheme exactly: `salt = sha256(rawCredentialId)`
 * (the base64url-decoded credential-id bytes), deployed by a fixed `deployer`
 * account via `createCustomContract`. Proven on-chain (`scripts/v1-events-probe.ts`:
 * derived id === deployed id).
 *
 * This only recovers the address for the wallet's FOUNDING credential (the one used
 * as the deploy salt). Signers added later via `add_signer` do not change the
 * address and cannot be reversed into it — resolve those through the events indexer
 * ({@link smartWalletV1Indexer}).
 */
declare function deriveSmartWalletAddress(options: DeriveSmartWalletAddressOptions): string;

export { type CreatePasskeyOptions, type DeriveAccountAddressOptions, type DeriveSmartWalletAddressOptions, type RegisterPasskeyOptions, type RegisteredPasskey, browserWebAuthnClient, coseKeyToSec1, createPasskey, defaultCredentialStorage, deriveAccountAddress, deriveSmartWalletAddress, extractPublicKeyFromAttestationObject, extractPublicKeyFromAuthData, registerPasskey };
```

## 2026-09-09T10:58:06Z

```
$ cat node_modules/@soropass/core/dist/types-CJluKV7s.d.ts
```

exit code: 0

```
type ResidentKeyRequirement = 'discouraged' | 'preferred' | 'required';
type UserVerificationRequirement = 'discouraged' | 'preferred' | 'required';
interface BuildCreateOptionsInput {
    rpId: string;
    rpName: string;
    userName: string;
    /** Stable, opaque user handle. Defaults to UTF-8 bytes of `userName`. */
    userId?: Uint8Array;
    userDisplayName?: string;
    /** Raw challenge bytes (base64url-encoded into the options). */
    challenge: Uint8Array;
    residentKey?: ResidentKeyRequirement;
    userVerification?: UserVerificationRequirement;
    timeout?: number;
}
/** ES256-only credential parameter. The `alg: -7` literal is non-negotiable. */
interface PubKeyCredParam {
    type: 'public-key';
    alg: -7;
}
interface PublicKeyCredentialCreationOptionsJSON {
    rp: {
        id: string;
        name: string;
    };
    user: {
        id: string;
        name: string;
        displayName: string;
    };
    challenge: string;
    pubKeyCredParams: PubKeyCredParam[];
    authenticatorSelection: {
        residentKey: ResidentKeyRequirement;
        requireResidentKey: boolean;
        userVerification: UserVerificationRequirement;
    };
    attestation: 'none';
    timeout: number;
}
/**
 * Build WebAuthn registration options that offer ES256 *and only* ES256
 * (`pubKeyCredParams: [{ type: 'public-key', alg: -7 }]`) — invariant #1.
 * Soroban verifies only secp256r1, so we never advertise any other algorithm.
 */
declare function buildCreateOptions(input: BuildCreateOptionsInput): PublicKeyCredentialCreationOptionsJSON;

/**
 * S12 (YK-438) — the two adapter interfaces. The ONLY infra coupling points, so
 * the SDK is composable, not monolithic. Ceremonies (S13) depend on these
 * interfaces, never on a concrete backend.
 */
interface SubmitResult {
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    /** Transaction hash (hex), when known. */
    hash: string;
    /** Decoded contract return value on success (implementation-defined). */
    returnValue?: unknown;
    /** base64 XDR of the failure result, when failed. */
    errorResultXdr?: string;
}
/** How a signed operation reaches the network. */
interface SubmissionAdapter {
    send(signedTxXdr: string): Promise<SubmitResult>;
}
interface ResolvedAccount {
    /** Soroban smart-account C-address. */
    contractId: string;
    /**
     * SEC-1 (65-byte) public key the factory's `deployed` event reported as this
     * account's founding signer, when available. `deploy` is permissionless and a
     * credential id is not exclusive, so a credential can resolve to more than one
     * candidate; compare this against the user's own key (or re-derive the address
     * with `deriveAccountAddress`) before trusting a resolved account with funds.
     */
    publicKey?: Uint8Array;
}
/** credentialId → smart-account address lookup. */
interface IndexerAdapter {
    resolveByCredential(credentialId: string): Promise<ResolvedAccount[]>;
}

/** Normalized WebAuthn results + the pluggable dependencies the ceremonies use. */
interface WebAuthnCreateResult {
    /** base64url credential id. */
    id: string;
    rawId: Uint8Array;
    attestationObject: Uint8Array;
}
interface WebAuthnGetResult {
    id: string;
    rawId: Uint8Array;
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    /** DER signature as returned by the authenticator. */
    signature: Uint8Array;
}
interface WebAuthnGetOptions {
    rpId: string;
    challenge?: Uint8Array;
    /** base64url credential ids; empty/omitted ⇒ discoverable (recover path). */
    allowCredentials?: string[];
    mediation?: 'silent' | 'optional' | 'conditional' | 'required';
    userVerification?: 'discouraged' | 'preferred' | 'required';
}

/** Abstraction over `navigator.credentials` so ceremonies are testable + isomorphic. */
interface WebAuthnClient {
    create(options: PublicKeyCredentialCreationOptionsJSON): Promise<WebAuthnCreateResult>;
    get(options: WebAuthnGetOptions): Promise<WebAuthnGetResult>;
}
/** Per-rpId credential-id persistence (localStorage by default). */
interface CredentialStorage {
    get(rpId: string): string | null;
    set(rpId: string, credentialId: string): void;
}
/**
 * Deploys a smart account for a freshly-created passkey via the factory (through
 * a SubmissionAdapter) and returns its C-address. Injected because the factory
 * wiring is contract-specific (kalepail webauthn-wallet / OZ) — provided by the
 * kit module (S17) / demo (S21); we don't reinvent the contract layer here.
 */
interface AccountDeployer {
    deploy(input: {
        publicKey: Uint8Array;
        credentialId: string;
    }): Promise<{
        contractId: string;
        txHash?: string;
    }>;
}

export { type AccountDeployer as A, type BuildCreateOptionsInput as B, type CredentialStorage as C, type IndexerAdapter as I, type PubKeyCredParam as P, type ResidentKeyRequirement as R, type SubmissionAdapter as S, type UserVerificationRequirement as U, type WebAuthnClient as W, type PublicKeyCredentialCreationOptionsJSON as a, type ResolvedAccount as b, type SubmitResult as c, type WebAuthnCreateResult as d, type WebAuthnGetOptions as e, type WebAuthnGetResult as f, buildCreateOptions as g };
```

## 2026-09-09T10:58:10Z

```
$ echo "=== recover-CL_jZ2kN.d.ts ==="; cat node_modules/@soropass/core/dist/recover-CL_jZ2kN.d.ts; echo; echo "=== sign-O5d7Moma.d.ts ==="; cat node_modules/@soropass/core/dist/sign-O5d7Moma.d.ts; echo; echo "=== submit-CKJp7XgZ.d.ts ==="; cat node_modules/@soropass/core/dist/submit-CKJp7XgZ.d.ts; echo; echo "=== checkAuth-B5ObsEsP.d.ts ==="; cat node_modules/@soropass/core/dist/checkAuth-B5ObsEsP.d.ts; echo; echo "=== types-BJsL-q2B.d.ts ==="; cat node_modules/@soropass/core/dist/types-BJsL-q2B.d.ts
```

exit code: 0

Output was 427 lines; showing the first 150 and last 150 lines.

```
=== recover-CL_jZ2kN.d.ts ===
import { I as IndexerAdapter, W as WebAuthnClient } from './types-CJluKV7s.js';

interface RecoverOptions {
    rpId: string;
    indexer: IndexerAdapter;
    webauthn?: WebAuthnClient;
    challenge?: Uint8Array;
    userActivation?: {
        isActive: boolean;
    };
}
interface RecoverResult {
    contractId: string;
    credentialId: string;
}
/**
 * `recover` — the lost-localStorage / new-device path. Performs a
 * discoverable-credential `get()` (no allowCredentials), then resolves every
 * smart account controlled by that credential via the IndexerAdapter.
 */
declare function recover(options: RecoverOptions): Promise<RecoverResult[]>;

export { type RecoverOptions as R, type RecoverResult as a, recover as r };

=== sign-O5d7Moma.d.ts ===
/**
 * Which contract ABI the assembled signature targets:
 *  - `single-signer` (default): the bare `Secp256r1Signature` struct our own
 *    webauthn-account consumes (`type Signature = Secp256r1Signature`).
 *  - `smart-wallet`: passkey-kit's `Signatures(Map<SignerKey, Signature>)`
 *    (`type Signature = Signatures`) — see `smartWallet.ts` / kalepail #32.
 * Both reuse the identical low-S, field-packing, and challenge-binding core;
 * only the outer wrapper differs, so the two stay separate ABI targets behind
 * one signing interface.
 */
type WalletTarget = 'single-signer' | 'smart-wallet';
/** The raw WebAuthn assertion a signer returns for a given challenge. */
interface AssertionResult {
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    /** DER-encoded (≤72B) or already-compact (64B) ECDSA signature. */
    signature: Uint8Array;
    /** base64url credential id → the SignerKey. */
    credentialId: Uint8Array;
    /**
     * SEC-1 (65-byte) public key of the signing passkey. The v0.2 single-signer
     * account verifies against this exact key, so the signer must supply it here
     * (or the caller passes it via `SorobanSignOptions.publicKey`). Not used by
     * the smart-wallet target, which resolves the key on-chain by credential id.
     */
    publicKey?: Uint8Array;
}
/** Produce a WebAuthn assertion over the base64url `challenge` (e.g. navigator.credentials.get). */
type WebAuthnSigner = (challenge: string) => Promise<AssertionResult> | AssertionResult;
/**
 * Opt-in pre-flight validation of the returned assertion, run BEFORE the entry
 * is assembled and submitted. On-chain `__check_auth` is the real gate, but
 * catching these client-side turns an opaque on-chain failure into a typed
 * `KitError` at the call site. Providing this object always enforces the
 * `webauthn.get` type, the User-Present (UP) flag (required by passkey-kit v1),
 * and challenge-binding; `rpId` / `origin` / `publicKey` add their checks when
 * supplied. Omit the object entirely to skip pre-flight (the default).
 */
interface SignVerifyOptions {
    /** Verify `authenticatorData.rpIdHash === SHA-256(rpId)`. */
    rpId?: string;
    /** Verify `clientDataJSON.origin` is one of these exact origins. */
    origin?: string | string[];
    /** SEC-1 (65-byte) public key → verify the ECDSA assertion signature. */
    publicKey?: Uint8Array;
    /** Also require the User-Verified (UV) flag (biometric / PIN). Default false. */
    requireUserVerification?: boolean;
    /** Allow an assertion made in a cross-origin context (crossOrigin=true). Default false. */
    allowCrossOrigin?: boolean;
}
interface SorobanSignOptions {
    networkPassphrase: string;
    sign: WebAuthnSigner;
    /**
     * Restrict `signTransaction` to auth entries whose credential address equals this
     * C-address. When set, only the connected account's entries are signed and any other
     * authorizer's entries are left untouched, so the passkey never signs on behalf of, or
     * prompts for, accounts that are not the signer. Omit to sign every address-credential
     * entry.
     */
    signerAddress?: string;
    /**
     * SEC-1 (65-byte) public key of the signing passkey, for the `single-signer`
     * target: the v0.2 `webauthn-account` carries the signer's key inline and
     * verifies against it. Takes precedence over any `publicKey` the signer
     * returns on its `AssertionResult`. Required for `single-signer` when the
     * signer does not return one; ignored by the `smart-wallet` target.
     */
    publicKey?: Uint8Array;
    /** Contract ABI to assemble for. Defaults to `single-signer` (our account). */
    target?: WalletTarget;
    /** Opt-in pre-flight assertion validation. Omit to skip. */
    verify?: SignVerifyOptions;
    /**
     * Stamp this `signatureExpirationLedger` onto every address-credential auth
     * entry BEFORE the challenge is computed, so the signature binds the exact
     * expiration the contract re-derives in `__check_auth`. Needed for smart-wallet
     * writes (add/remove signer) where the caller learns the ledger at sign time;
     * omit when the entry already carries the intended expiration.
     */
    signatureExpirationLedger?: number;
}
/**
 * Sign a single `SorobanAuthorizationEntry` (base64 XDR): compute the challenge,
 * obtain a WebAuthn assertion, low-S-normalize, and assemble the contract
 * signature. Returns the signed entry as base64 XDR.
 */
declare function signAuthEntry(entryXdr: string, options: SorobanSignOptions): Promise<string>;
/**
 * Sign every address-credential Soroban auth entry carried by the InvokeHostFunction
 * operations of a transaction (base64 XDR envelope — v1 or fee-bump). Returns the
 * signed envelope XDR.
 */
declare function signTransaction(txXdr: string, options: SorobanSignOptions): Promise<string>;

export { type AssertionResult as A, type SignVerifyOptions as S, type WalletTarget as W, type SorobanSignOptions as a, type WebAuthnSigner as b, signTransaction as c, signAuthEntry as s };

=== submit-CKJp7XgZ.d.ts ===
import { xdr } from '@stellar/stellar-sdk';
import { S as SubmissionAdapter, c as SubmitResult } from './types-CJluKV7s.js';
import { b as WebAuthnSigner, S as SignVerifyOptions } from './sign-O5d7Moma.js';

/**
 * passkey-kit v1 (v0.13.0, Protocol 27) smart-wallet SIGNER encoders — the WRITE
 * path (what `add_signer` / `remove_signer` consume), complementing
 * `smartWallet.ts` (the signature READ path the wallet's `__check_auth` reads).
 *
 * A signer is added on-chain as
 *
 *   Signer::Secp256r1(Bytes id, BytesN<65> public_key,
 *                     SignerExpiration, SignerLimits, SignerStorage)
 *
 * which `process_signer` reduces to `SignerKey::Secp256r1(id) ->
 * SignerVal::Secp256r1(public_key, ..)`: the raw credential id is the key, the
 * SEC-1 public key lives in the value. Shape + field order confirmed by kalepail
 * (passkey-kit author) in issue #32 and proven on testnet against the audited v1
 * wasm (`scripts/smartwallet-v1-e2e.ts`).
 *
 * v1 note: `SignerExpiration` is a UNIX-seconds `u64` timestamp (Protocol 27),
 * NOT a ledger sequence as in the pre-v1 kit.
 */
/** `SignerStorage` — where the contract persists the signer entry. */
type SignerStorage = 'Persistent' | 'Temporary';
interface Secp256r1SignerSpec {
[... 127 lines omitted ...]
    /** Raw flags byte. */
    bits: number;
}
interface ParsedAuthenticatorData {
    rpIdHash: Uint8Array;
    flags: AuthenticatorDataFlags;
    signCount: number;
    aaguid?: Uint8Array;
    credentialId?: Uint8Array;
    /** Raw CBOR-encoded COSE public key (exact bytes), if attested data present. */
    credentialPublicKey?: Uint8Array;
}
/** Parse the authenticatorData byte structure (WebAuthn §6.1). */
declare function parseAuthenticatorData(authData: Uint8Array): ParsedAuthenticatorData;
/** Verify that authenticatorData's rpIdHash equals SHA-256(rpId). */
declare function verifyRpIdHash(authData: Uint8Array, rpId: string): void;

interface VerifyAssertionInput {
    /** SEC-1 uncompressed public key (65 bytes, `0x04 ‖ X ‖ Y`). */
    publicKey: Uint8Array;
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    /** DER-encoded (≤72 B) or already-compact (64 B) signature. */
    signature: Uint8Array;
}
/**
 * Verify a WebAuthn assertion the way the on-chain `secp256r1_verify` does:
 * reconstruct `SHA256(authData ‖ SHA256(cdj))` and check ECDSA. `lowS: false`
 * mirrors the host function, which does NOT enforce low-S (we normalize
 * separately before submitting — see S04/YK-430).
 */
declare function verifyAssertionSignature(input: VerifyAssertionInput): boolean;

interface CheckAuthResult {
    success: boolean;
    /** clientDataJSON.challenge === base64url(preimage hash). */
    challengeBound: boolean;
    /** secp256r1_verify over SHA256(authData ‖ SHA256(cdj)) passed. */
    signatureValid: boolean;
    reason?: string;
}
/**
 * A faithful JavaScript model of the on-chain v0.2 `__check_auth`
 * (`contracts/webauthn-account`): read the inline `public_key`, require it to be
 * an enrolled signer (here, equal to `publicKey`), reconstruct
 * `SHA256(authenticator_data ‖ SHA256(client_data_json))`, run `secp256r1_verify`
 * (which REQUIRES low-S and rejects high-S at decode, so the model verifies with
 * lowS:true — the client-side normalization is what makes real assertions pass),
 * and assert challenge-binding (`clientDataJSON.challenge ===
 * base64url(signature_payload)`). Lets us prove the assembly without a live
 * Soroban RPC; the real on-chain run is exercised by the kit integration and the
 * demo. A 3-field struct with no inline key still verifies against `publicKey`
 * for back-compat with the smart-wallet reference.
 */
declare function referenceCheckAuth(entry: xdr.SorobanAuthorizationEntry, publicKey: Uint8Array, networkPassphrase: string): CheckAuthResult;
interface SmartWalletCheckAuthResult {
    success: boolean;
    signers: {
        credentialId: string;
        challengeBound: boolean;
        signatureValid: boolean;
    }[];
    reason?: string;
}
/**
 * A reference model of passkey-kit's smart-wallet `__check_auth`: unwrap the
 * `Signatures(Map<SignerKey, Signature>)` value (`ScVal::Vec([ScVal::Map(...)])`),
 * and for each `SignerKey::Secp256r1(id) => Signature::Secp256r1(struct)` entry,
 * look up that credential id's SEC-1 public key and verify the struct. Succeeds
 * only when the map is non-empty and every signer verifies + is challenge-bound.
 * `publicKeyFor` receives the lowercase-hex credential id.
 */
declare function referenceSmartWalletCheckAuth(entry: xdr.SorobanAuthorizationEntry, publicKeyFor: (credentialIdHex: string) => Uint8Array | undefined, networkPassphrase: string): SmartWalletCheckAuthResult;

export { type AuthenticatorDataFlags as A, type CheckAuthResult as C, type ParsedAuthenticatorData as P, type SmartWalletCheckAuthResult as S, type VerifyAssertionInput as V, type ClientData as a, parseClientDataJSON as b, referenceSmartWalletCheckAuth as c, decodeChallenge as d, encodeChallenge as e, verifyClientDataJSON as f, verifyRpIdHash as g, parseAuthenticatorData as p, referenceCheckAuth as r, verifyAssertionSignature as v };

=== types-BJsL-q2B.d.ts ===
import './checkAuth-B5ObsEsP.js';
import './types-CJluKV7s.js';
import './sign-O5d7Moma.js';

/**
 * The frozen taxonomy of error codes the SDK can throw. This union is
 * deliberately closed — every failure path maps to exactly one of these.
 */
declare const KIT_ERROR_CODES: readonly ["USER_CANCELLED", "ES256_NOT_SUPPORTED", "RP_ID_MISMATCH", "ORIGIN_MISMATCH", "CHALLENGE_MISMATCH", "INVALID_SIGNATURE_DER", "INVALID_PUBLIC_KEY", "CONTRACT_AUTH_FAILED", "NETWORK_ERROR", "UNSUPPORTED_AUTHENTICATOR"];
type KitErrorCode = (typeof KIT_ERROR_CODES)[number];
/** Structured error carrying a machine-readable {@link KitErrorCode}. */
declare class KitError extends Error {
    readonly code: KitErrorCode;
    readonly name = "KitError";
    constructor(code: KitErrorCode, message?: string, options?: {
        cause?: unknown;
    });
}
declare function isKitError(value: unknown): value is KitError;

/**
 * Stable identifiers for the three battle-tested anchors (S04 / YK-430) — the
 * bugs that silently break ~50% of users. Referenced by stable name from the
 * threat model (S14) and the compatibility matrix (S09) so each mitigation has
 * one canonical id across code and docs.
 */
declare const BATTLE_TESTED_ANCHORS: Readonly<{
    /** Apple Touch ID/Face ID emit high-S ~50% of the time; we normalize to low-S. */
    readonly LOW_S_NORMALIZATION: "low-s-normalization";
    /** Non-ES256 credentials (e.g. some Windows Hello configs) cannot verify on-chain. */
    readonly RS256_HARD_FAIL: "rs256-hard-fail";
    /** Safari requires create/get inside a user activation or it silently rejects. */
    readonly APPLE_USER_GESTURE: "apple-user-gesture";
}>;
type BattleTestedAnchor = (typeof BATTLE_TESTED_ANCHORS)[keyof typeof BATTLE_TESTED_ANCHORS];
/**
 * Anchor `RS256_HARD_FAIL`. The Soroban webauthn-wallet verifies *only*
 * secp256r1, so a non-ES256 credential would produce an unusable account.
 * Hard-fail rather than continue (invariant #1).
 */
declare function assertES256(alg: number): void;
interface UserActivationLike {
    isActive: boolean;
}
/**
 * Anchor `APPLE_USER_GESTURE`. `navigator.credentials.create/get` on
 * Safari/WebKit must run inside a transient user activation (a real click/tap)
 * or the promise silently rejects. Call this at the very top of a create/sign
 * handler.
 *
 * UI pattern (for S18): never auto-trigger the ceremony from a mount/effect —
 * always gate it behind an explicit user click, and surface `USER_CANCELLED`
 * in the flow state machine. Lenient when `navigator.userActivation` is
 * unavailable (non-browser / older engines) so the SDK stays isomorphic; pass
 * an explicit `{ isActive }` to force the check.
 */
declare function assertUserActivation(activation?: UserActivationLike): void;

/**
 * `@soropass/core/types` — the shared type surface + error taxonomy.
 */

/** A passkey-backed Stellar smart account (populated by the S13 ceremonies). */
interface PasskeyCredential {
    /** Soroban contract (C…) address of the smart account. */
    contractId: string;
    /** base64url credential id returned by the authenticator. */
    credentialId: string;
    /** SEC-1 uncompressed public key (65 bytes). */
    publicKey: Uint8Array;
}

export { BATTLE_TESTED_ANCHORS as B, KIT_ERROR_CODES as K, type PasskeyCredential as P, type BattleTestedAnchor as a, KitError as b, type KitErrorCode as c, assertES256 as d, assertUserActivation as e, isKitError as i };
```

## 2026-09-09T10:59:08Z

```
$ echo "--- create-account.mjs ---"; cat create-account.mjs; echo "--- run ---"; node create-account.mjs; echo "exit=$?"
```

exit code: 0

```
--- create-account.mjs ---
// create-account.mjs. Agent-written from the skill's "Create a passkey account in the browser" recipe.
// DEVIATION: the skill's recipe uses browserWebAuthnClient() (a browser). No browser here, so the WebAuthn
// client is `mockAuthenticator` from @soropass/core/testing, which the PACKAGE type declarations export as a
// WebAuthnClient, and which the skill file does NOT document. Everything else follows the skill.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createPasskey,
  factoryDeployer,
  deriveAccountAddress,
  DEFAULT_ACCOUNT_FACTORIES,
  parseAuthenticatorData,
} from '@soropass/core';
import { mockAuthenticator } from '@soropass/core/testing';
import { Networks } from '@stellar/stellar-sdk';

const hex = (u8) => Buffer.from(u8).toString('hex');
const { secret: sourceSecret, publicKey: sponsorPk } = JSON.parse(readFileSync('sponsor.json', 'utf8'));
console.log('sponsor:', sponsorPk);
console.log('DEFAULT_ACCOUNT_FACTORIES:', DEFAULT_ACCOUNT_FACTORIES);

const rpId = 'example.com';
const seed = 'skill-agent-2026-09-09-device-A';
const auth = mockAuthenticator({ rpId, seed });
console.log('mock authenticator credentialId:', auth.credentialId);
console.log('mock authenticator publicKey (hex):', hex(auth.publicKey));

// Wrap the skill's factoryDeployer only to capture the deploy tx hash (createPasskey does not return it).
const inner = factoryDeployer({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET, // selects the deployed factory for this network
  sourceSecret, // a funded G-account secret that pays the deploy fee
});
let deployTxHash;
const deployer = {
  async deploy(input) {
    const r = await inner.deploy(input);
    deployTxHash = r.txHash;
    console.log('factoryDeployer.deploy result:', r);
    return r;
  },
};

const t0 = Date.now();
const account = await createPasskey({
  rpId,
  rpName: 'Skill Agent',
  userName: 'alice',
  deployer,
  webauthn: auth,
});
console.log('createPasskey took ms:', Date.now() - t0);
console.log('account.contractId:', account.contractId);
console.log('account.credentialId:', account.credentialId);
console.log('account.publicKey bytes:', account.publicKey.length, 'hex:', hex(account.publicKey));

// The skill says: address === account.contractId
const derived = deriveAccountAddress({
  credentialId: new TextEncoder().encode(account.credentialId), // UTF-8 bytes of the base64url id
  publicKey: account.publicKey, // 65-byte SEC-1 key, part of the v0.2 salt
  networkPassphrase: Networks.TESTNET, // selects the deployed factory; factoryContractId overrides
});
console.log('deriveAccountAddress:', derived, '| equals account.contractId:', derived === account.contractId);

// For the record: what flags the mock assertion carries (the skill says the v0.2 account requires UV on-chain).
const probe = auth.sign('AAAA');
console.log('mock assertion flags:', parseAuthenticatorData(probe.authenticatorData).flags, '| assertion.publicKey present:', !!probe.publicKey);

writeFileSync(
  'account.json',
  JSON.stringify(
    { rpId, seed, contractId: account.contractId, credentialId: account.credentialId, publicKeyHex: hex(account.publicKey), deployTxHash, derivedAddress: derived },
    null,
    2,
  ),
);
console.log('wrote account.json');
--- run ---
sponsor: GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
DEFAULT_ACCOUNT_FACTORIES: {
  'Test SDF Network ; September 2015': 'CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH',
  'Public Global Stellar Network ; September 2015': 'CCCNRWMICVEMMUSBI7DL3IKB566QEOOQOLVDOAM5SLFDZ2KGUSRR3JVF'
}
mock authenticator credentialId: bDl6vfHGh1FADhvHv1XIjQ
mock authenticator publicKey (hex): 048d362a193d5cc8e318ad94322ba93daac67962335077e28e91ccb51ddd49afb6d017c663cae8d72a56fd7f525c40d21b61d59ba0b92415c9c7f1523656d5f91e
factoryDeployer.deploy result: {
  contractId: 'CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK',
  txHash: '9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d'
}
createPasskey took ms: 4368
account.contractId: CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK
account.credentialId: bDl6vfHGh1FADhvHv1XIjQ
account.publicKey bytes: 65 hex: 048d362a193d5cc8e318ad94322ba93daac67962335077e28e91ccb51ddd49afb6d017c663cae8d72a56fd7f525c40d21b61d59ba0b92415c9c7f1523656d5f91e
deriveAccountAddress: CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK | equals account.contractId: true
mock assertion flags: {
  up: true,
  uv: true,
  be: false,
  bs: false,
  at: false,
  ed: false,
  bits: 5
} | assertion.publicKey present: true
wrote account.json
exit=0
```

## 2026-09-09T10:59:28Z

```
$ H=$(node -p "require(\"./account.json\").deployTxHash"); echo "deploy tx: $H"; curl -sS "https://horizon-testnet.stellar.org/transactions/$H" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const t=JSON.parse(s);console.log(JSON.stringify({hash:t.hash,successful:t.successful,ledger:t.ledger,created_at:t.created_at,source_account:t.source_account,fee_charged:t.fee_charged,operation_count:t.operation_count},null,2))})"
```

exit code: 0

```
deploy tx: 9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d
{
  "hash": "9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d",
  "successful": true,
  "ledger": 4585593,
  "created_at": "2026-09-09T10:59:12Z",
  "source_account": "GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T",
  "fee_charged": "651039",
  "operation_count": 1
}
```

## 2026-09-09T10:59:47Z

```
$ echo "--- pay.mjs ---"; cat pay.mjs; echo "--- run ---"; node pay.mjs; echo "exit=$?"
```

exit code: 0

```
--- pay.mjs ---
// pay.mjs. The skill's "A complete payment, end to end", transcribed from its two TS listings.
// DEVIATIONS: (1) `.mjs` is JavaScript, so the TS annotation `(a: string)` became `(a)`;
// (2) browserPasskeySigner(...) needs a browser, so the signer is the same mockAuthenticator (same seed)
//     used at create time: `sign: (c) => auth.sign(c)` plus `publicKey` via SorobanSignOptions.publicKey
//     (the skill documents that option; mockAuthenticator itself is not in the skill);
// (3) `destination` = the sponsor's own G-address ("any funded classic account").
import { readFileSync, writeFileSync } from 'node:fs';
import { signTransaction } from '@soropass/core';
import { mockAuthenticator } from '@soropass/core/testing';
import {
  Asset,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';

const hex = (u8) => Buffer.from(u8).toString('hex');
const { secret: sourceSecret } = JSON.parse(readFileSync('sponsor.json', 'utf8'));
const account = JSON.parse(readFileSync('account.json', 'utf8'));
const auth = mockAuthenticator({ rpId: account.rpId, seed: account.seed });
console.log('re-created mock authenticator matches account key:', hex(auth.publicKey) === account.publicKeyHex, '| credentialId matches:', auth.credentialId === account.credentialId);
const publicKey = auth.publicKey;

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const sponsor = Keypair.fromSecret(sourceSecret);
const SAC = Asset.native().contractId(Networks.TESTNET);
const addr = (a) => nativeToScVal(a, { type: 'address' });
const destination = sponsor.publicKey();
console.log('SAC:', SAC, '| smart account:', account.contractId, '| destination:', destination);

// ---- Funding: sponsor seeds the smart account with a classic SAC transfer (10 XLM) ----
const funding = new TransactionBuilder(await server.getAccount(sponsor.publicKey()), {
  fee: '1000000',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    new Contract(SAC).call(
      'transfer',
      addr(sponsor.publicKey()),
      addr(account.contractId),
      nativeToScVal(100_000_000n, { type: 'i128' }), // 10 XLM
    ),
  )
  .setTimeout(120)
  .build();
const preparedFunding = await server.prepareTransaction(funding);
preparedFunding.sign(sponsor);
const fundingSent = await server.sendTransaction(preparedFunding);
console.log('funding sendTransaction:', { status: fundingSent.status, hash: fundingSent.hash });
const fundingResult = await server.pollTransaction(fundingSent.hash);
console.log('funding pollTransaction status:', fundingResult.status, '| ledger:', fundingResult.ledger);

// ---- Payment: 2.5 XLM FROM the smart account, authorized by the passkey ----
// 1. Build the transfer FROM the smart account, with the sponsor as the transaction source, and simulate.
const source = await server.getAccount(sponsor.publicKey());
const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
  .addOperation(
    new Contract(SAC).call(
      'transfer',
      addr(account.contractId), // from: the smart account
      addr(destination), // to: any funded account
      nativeToScVal(25_000_000n, { type: 'i128' }), // 2.5 XLM in stroops
    ),
  )
  .setTimeout(120)
  .build();
const assembled = await server.prepareTransaction(tx);

// 2. The passkey signs the smart account's authorization entry.
const validUntil = (await server.getLatestLedger()).sequence + 100;
const signedXdr = await signTransaction(assembled.toXDR(), {
  networkPassphrase: Networks.TESTNET,
  sign: (challenge) => auth.sign(challenge),
  publicKey,
  signatureExpirationLedger: validUntil,
});

// 3. Re-simulate with the signed entry so the budget covers secp256r1_verify.
const prepared = await server.prepareTransaction(
  TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET),
);

// 4. The classic source signs the ENVELOPE, then submit and poll.
prepared.sign(sponsor);
const sent = await server.sendTransaction(prepared);
console.log('payment sendTransaction:', { status: sent.status, hash: sent.hash });
const result = await server.pollTransaction(sent.hash);
console.log('payment pollTransaction status:', result.status, '| ledger:', result.ledger);
console.log(result.status === 'SUCCESS' ? 'PASS: passkey-signed payment succeeded on testnet' : 'FAIL: payment status ' + result.status);

writeFileSync(
  'txs.json',
  JSON.stringify({ fundingTxHash: fundingSent.hash, fundingStatus: fundingResult.status, paymentTxHash: sent.hash, paymentStatus: result.status, validUntil }, null, 2),
);
console.log('wrote txs.json');
--- run ---
re-created mock authenticator matches account key: true | credentialId matches: true
SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC | smart account: CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK | destination: GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
funding sendTransaction: {
  status: 'PENDING',
  hash: '36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065'
}
funding pollTransaction status: SUCCESS | ledger: 4585601
payment sendTransaction: {
  status: 'PENDING',
  hash: 'b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782'
}
payment pollTransaction status: SUCCESS | ledger: 4585602
PASS: passkey-signed payment succeeded on testnet
wrote txs.json
exit=0
```

## 2026-09-09T11:00:25Z

```
$ for H in $(node -p "const t=require(\"./txs.json\");[t.fundingTxHash,t.paymentTxHash].join(\" \")"); do echo "tx: $H"; curl -sS "https://horizon-testnet.stellar.org/transactions/$H" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const t=JSON.parse(s);console.log(JSON.stringify({hash:t.hash,successful:t.successful,ledger:t.ledger,created_at:t.created_at,source_account:t.source_account,fee_charged:t.fee_charged,operation_count:t.operation_count},null,2))})"; done
```

exit code: 0

```
tx: 36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065
{
  "hash": "36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065",
  "successful": true,
  "ledger": 4585601,
  "created_at": "2026-09-09T10:59:52Z",
  "source_account": "GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T",
  "fee_charged": "108415",
  "operation_count": 1
}
tx: b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782
{
  "hash": "b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782",
  "successful": true,
  "ledger": 4585602,
  "created_at": "2026-09-09T10:59:57Z",
  "source_account": "GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T",
  "fee_charged": "23158",
  "operation_count": 1
}
```

## 2026-09-09T11:00:49Z

```
$ echo "--- recover.mjs ---"; cat recover.mjs; echo "--- run ---"; node recover.mjs; echo "exit=$?"
```

exit code: 0

```
--- recover.mjs ---
// recover.mjs. The skill's "Native recovery on the v0.2 account" recipe (add device B by A), then
// "B signs alone" (the payment recipe signed by B), then a NON-enrolled device C attempting the same.
// DEVIATIONS: registerPasskey/browserPasskeySigner need a browser; the WebAuthn client + signer for each
// device is a mockAuthenticator (different seeds) from @soropass/core/testing, which the skill does not document.
// TS annotations dropped for .mjs. `signer_count()` reads are agent-added, simulate-only, for the record.
import { readFileSync, writeFileSync } from 'node:fs';
import { registerPasskey, signTransaction, isKitError } from '@soropass/core';
import { mockAuthenticator } from '@soropass/core/testing';
import { Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';

const hex = (u8) => Buffer.from(u8).toString('hex');
const { secret: sourceSecret } = JSON.parse(readFileSync('sponsor.json', 'utf8'));
const account = JSON.parse(readFileSync('account.json', 'utf8'));
const rpId = account.rpId;
const authA = mockAuthenticator({ rpId, seed: account.seed }); // the enrolled device
const authB = mockAuthenticator({ rpId, seed: 'skill-agent-2026-09-09-device-B' }); // the new device
const authC = mockAuthenticator({ rpId, seed: 'skill-agent-2026-09-09-device-C' }); // never enrolled

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const sponsor = Keypair.fromSecret(sourceSecret);
const SAC = Asset.native().contractId(Networks.TESTNET);
const addr = (a) => nativeToScVal(a, { type: 'address' });
const destination = sponsor.publicKey();
const out = {};

async function signerCount() {
  const src = await server.getAccount(sponsor.publicKey());
  const t = new TransactionBuilder(src, { fee: '1000000', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(account.contractId).call('signer_count')).setTimeout(120).build();
  const sim = await server.simulateTransaction(t);
  return scValToNative(sim.result.retval);
}
console.log('signer_count before:', await signerCount());

// New device: register a passkey (no deploy), producing { credentialId, publicKey }.
const device2 = await registerPasskey({ rpId, rpName: 'Skill Agent', userName: 'alice', webauthn: authB });
console.log('device2.credentialId:', device2.credentialId, '| publicKey:', hex(device2.publicKey), '| equals authB key:', hex(device2.publicKey) === hex(authB.publicKey));

// Build + simulate the account-authorized add_signer invocation:
{
  const source = await server.getAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(account.contractId).call('add_signer', nativeToScVal(device2.publicKey, { type: 'bytes' })))
    .setTimeout(120)
    .build();
  const assembled = await server.prepareTransaction(tx);
  // The EXISTING enrolled device signs the account's auth entry (as in the skill: no signatureExpirationLedger here):
  const signedXdr = await signTransaction(assembled.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    sign: (c) => authA.sign(c),
    publicKey: authA.publicKey,
  });
  // Steps 3 and 4 of the payment recipe, unchanged:
  const prepared = await server.prepareTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
  prepared.sign(sponsor);
  const sent = await server.sendTransaction(prepared);
  console.log('add_signer sendTransaction:', { status: sent.status, hash: sent.hash });
  const result = await server.pollTransaction(sent.hash);
  console.log('add_signer pollTransaction status:', result.status, '| ledger:', result.ledger);
  out.addSignerTxHash = sent.hash; out.addSignerStatus = result.status;
}
console.log('signer_count after add_signer:', await signerCount());

// Device B signs alone: the payment recipe, signed by B (1 XLM to destination).
async function paymentSignedBy(auth, label) {
  const source = await server.getAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(SAC).call('transfer', addr(account.contractId), addr(destination), nativeToScVal(10_000_000n, { type: 'i128' })))
    .setTimeout(120)
    .build();
  const assembled = await server.prepareTransaction(tx);
  const validUntil = (await server.getLatestLedger()).sequence + 100;
  const signedXdr = await signTransaction(assembled.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    sign: (c) => auth.sign(c),
    publicKey: auth.publicKey,
    signatureExpirationLedger: validUntil,
  });
  const prepared = await server.prepareTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
  prepared.sign(sponsor);
  const sent = await server.sendTransaction(prepared);
  console.log(label, 'sendTransaction:', { status: sent.status, hash: sent.hash });
  const result = await server.pollTransaction(sent.hash);
  console.log(label, 'pollTransaction status:', result.status, '| ledger:', result.ledger);
  return { hash: sent.hash, status: result.status };
}
const b = await paymentSignedBy(authB, 'payment signed by device B');
out.paymentByBTxHash = b.hash; out.paymentByBStatus = b.status;

// A never-enrolled device C tries the same. Expected: rejected.
try {
  const c = await paymentSignedBy(authC, 'payment signed by device C (not enrolled)');
  out.paymentByC = c;
  console.log('UNEXPECTED: non-enrolled device C payment status', c.status);
} catch (err) {
  out.paymentByCError = { isKitError: isKitError(err), code: err.code, name: err.name, message: String(err.message).slice(0, 2000) };
  console.log('OK: non-enrolled device C rejected. isKitError:', isKitError(err), '| code:', err.code, '| name:', err.name);
  console.log('error message:', String(err.message).slice(0, 2000));
}
console.log('signer_count at end:', await signerCount());
writeFileSync('recover-txs.json', JSON.stringify(out, null, 2));
console.log('wrote recover-txs.json');
--- run ---
signer_count before: 1
device2.credentialId: Uiz0nQf4qNXVaqgJk5XZwg | publicKey: 0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545 | equals authB key: true
file://<workdir>/node_modules/@stellar/stellar-sdk/lib/esm/rpc/server.js:1233
      throw new Error(simResponse.error);
            ^

Error: HostError: Error(Auth, InvalidInput)

Event log (newest first):
   0: [Diagnostic Event] contract:CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, topics:[error, Error(Auth, InvalidInput)], data:"escalating error to VM trap from failed host function call: require_auth"
   1: [Diagnostic Event] contract:CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, topics:[error, Error(Auth, InvalidInput)], data:["signature has expired", CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, 4585612, 0]
   2: [Diagnostic Event] contract:CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, topics:[fn_return, __check_auth], data:Void
   3: [Diagnostic Event] contract:CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, topics:[fn_call, CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, __check_auth], data:[Bytes(3c209ef6eceab7fff9e439b65175cdfa9068ec590501f3eb3a90f0ed7c1f1734), {authenticator_data: Bytes(a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce19470500000001), client_data_json: Bytes(7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a225043436539757a71745f5f3535446d325558584e2d70426f37466b46416650724f70447737587766467a51222c226f726967696e223a2268747470733a2f2f6578616d706c652e636f6d227d), public_key: Bytes(048d362a193d5cc8e318ad94322ba93daac67962335077e28e91ccb51ddd49afb6d017c663cae8d72a56fd7f525c40d21b61d59ba0b92415c9c7f1523656d5f91e), signature: Bytes(e83c005e1d5a27845598359418cfbe57f0832d36cce9fbcd87f2723d997361523d798786a127c7e3783d94e2c2c2179527acf52e7c3c81ad7bd174dde3aeaacd)}, [[Contract, {args: [Bytes(0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545)], contract: CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, fn_name: add_signer}]]]
   4: [Diagnostic Event] topics:[fn_call, CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, add_signer], data:Bytes(0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545)

    at RpcServer.prepareTransaction (file://<workdir>/node_modules/@stellar/stellar-sdk/lib/esm/rpc/server.js:1233:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async file://<workdir>/recover.mjs:54:20

Node.js v24.13.1
exit=1
```

## 2026-09-09T11:01:00Z

```
$ echo "--- extras.mjs ---"; cat extras.mjs; echo "--- run ---"; node extras.mjs; echo "exit=$?"
```

exit code: 0

```
--- extras.mjs ---
// extras.mjs. Agent-assembled from the skill's other documented mock-mode claims (no chain, no browser):
//  (a) `forceHighS: true` "forces a high-S signature to exercise the low-S normalizer, and the result stays PASS";
//  (b) the reconnect story: `kit.connect()` / `kit.recover()` (skill lines 84-87);
//  (c) `seed` makes the mock deterministic; `userName` optional.
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import { referenceCheckAuth, isLowS, parseAuthenticatorData } from '@soropass/core';
import { xdr } from '@stellar/stellar-sdk';
const NETWORK = 'Test SDF Network ; September 2015';

// (a) forceHighS
const hs = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example', seed: 'hs', forceHighS: true });
const acc = await hs.createPasskey({ userName: 'alice' });
const signedXdr = await hs.signAuthEntry(sampleAuthEntry(acc.contractId));
const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedXdr, 'base64');
const r = referenceCheckAuth(signed, acc.publicKey, NETWORK);
console.log('forceHighS result:', r);
console.log(r.success ? 'PASS: forceHighS still verifies (low-S normalized)' : 'FAIL: forceHighS');

// (b) reconnect story
const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Example' });
const account = await kit.createPasskey({ userName: 'alice' });
const back = await kit.connect(); // the account created above, resolved silently
const found = await kit.recover(); // [{ contractId, credentialId }]
console.log('connect():', back, '| equals created:', back && back.contractId === account.contractId && back.credentialId === account.credentialId);
console.log('recover():', found, '| includes created:', found.some((f) => f.contractId === account.contractId));

// (c) determinism + optional userName
const s1 = await createPasskeyKit({ mode: 'mock', rpId: 'example.com', seed: 'det' }).createPasskey();
const s2 = await createPasskeyKit({ mode: 'mock', rpId: 'example.com', seed: 'det' }).createPasskey();
console.log('seed determinism (same contractId, credentialId, key):', s1.contractId === s2.contractId, s1.credentialId === s2.credentialId, Buffer.from(s1.publicKey).equals(Buffer.from(s2.publicKey)));
--- run ---
forceHighS result: { success: true, challengeBound: true, signatureValid: true }
PASS: forceHighS still verifies (low-S normalized)
connect(): {
  contractId: 'CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5',
  credentialId: 'QXzZ6st2JsMxvWCoKQcqYQ'
} | equals created: true
recover(): [
  {
    contractId: 'CAXKILWGKFZLCTATXNGDEATQV4FCBGM34ZBGCHJSRJUV5CYJFF7AE4O5',
    credentialId: 'QXzZ6st2JsMxvWCoKQcqYQ'
  }
] | includes created: true
seed determinism (same contractId, credentialId, key): true true true
exit=0
```

## 2026-09-09T11:01:30Z

```
$ echo "--- diff recover.mjs recover-v2.mjs ---"; diff recover.mjs recover-v2.mjs; echo "--- run ---"; node recover-v2.mjs; echo "exit=$?"
```

exit code: 0

```
--- diff recover.mjs recover-v2.mjs ---
0a1,4
> // recover-v2.mjs. SECOND ATTEMPT. Same as recover.mjs except the add_signer signing now stamps
> // `signatureExpirationLedger: validUntil` (step 2 of the skill's payment recipe); the first attempt, which
> // followed the add_signer snippet verbatim (no stamp), failed at re-simulation with "signature has expired" (0).
> // Original header follows.
47c51,57
<   // The EXISTING enrolled device signs the account's auth entry (as in the skill: no signatureExpirationLedger here):
---
>   // Root-cause print (agent-added): what expiration does the recording simulation put on the auth entry?
>   for (const op of assembled.operations) {
>     for (const e of op.auth ?? []) console.log('auth entry from first prepareTransaction: signatureExpirationLedger =', e.credentials().address().signatureExpirationLedger());
>   }
>   // The EXISTING enrolled device signs the account's auth entry. FIX vs the skill's add_signer snippet:
>   // stamp the expiration exactly as the payment recipe's step 2 does.
>   const validUntil = (await server.getLatestLedger()).sequence + 100;
51a62
>     signatureExpirationLedger: validUntil,
--- run ---
signer_count before: 1
device2.credentialId: Uiz0nQf4qNXVaqgJk5XZwg | publicKey: 0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545 | equals authB key: true
file://<workdir>/recover-v2.mjs:53
    for (const e of op.auth ?? []) console.log('auth entry from first prepareTransaction: signatureExpirationLedger =', e.credentials().address().signatureExpirationLedger());
                                                                                                                          ^

TypeError: e.credentials is not a function
    at file://<workdir>/recover-v2.mjs:53:123
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)

Node.js v24.13.1
exit=1
```

## 2026-09-09T11:01:51Z

```
$ echo "--- diff recover.mjs recover-v2.mjs ---"; diff recover.mjs recover-v2.mjs; echo "--- run ---"; node recover-v2.mjs; echo "exit=$?"
```

exit code: 0

```
--- diff recover.mjs recover-v2.mjs ---
0a1,4
> // recover-v2.mjs. SECOND ATTEMPT. Same as recover.mjs except the add_signer signing now stamps
> // `signatureExpirationLedger: validUntil` (step 2 of the skill's payment recipe); the first attempt, which
> // followed the add_signer snippet verbatim (no stamp), failed at re-simulation with "signature has expired" (0).
> // Original header follows.
9c13
< import { Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';
---
> import { Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
47c51,65
<   // The EXISTING enrolled device signs the account's auth entry (as in the skill: no signatureExpirationLedger here):
---
>   // Root-cause print (agent-added): what expiration does the recording simulation put on the auth entry?
>   {
>     const env = xdr.TransactionEnvelope.fromXDR(assembled.toXDR(), 'base64');
>     for (const op of env.v1().tx().operations()) {
>       const body = op.body();
>       if (body.switch().name !== 'invokeHostFunction') continue;
>       for (const e of body.invokeHostFunctionOp().auth()) {
>         const c = e.credentials(); const v = c.value();
>         console.log('auth entry from first prepareTransaction: credentials arm =', c.switch().name, '| signatureExpirationLedger =', typeof v?.signatureExpirationLedger === 'function' ? v.signatureExpirationLedger() : '(n/a)');
>       }
>     }
>   }
>   // The EXISTING enrolled device signs the account's auth entry. FIX vs the skill's add_signer snippet:
>   // stamp the expiration exactly as the payment recipe's step 2 does.
>   const validUntil = (await server.getLatestLedger()).sequence + 100;
51a70
>     signatureExpirationLedger: validUntil,
--- run ---
signer_count before: 1
device2.credentialId: Uiz0nQf4qNXVaqgJk5XZwg | publicKey: 0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545 | equals authB key: true
file://<workdir>/recover-v2.mjs:54
    for (const op of env.v1().tx().operations()) {
                         ^

TypeError: env.v1 is not a function
    at file://<workdir>/recover-v2.mjs:54:26
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)

Node.js v24.13.1
exit=1
```

## 2026-09-09T11:02:11Z

```
$ echo "--- diff recover.mjs recover-v2.mjs ---"; diff recover.mjs recover-v2.mjs; echo "--- run ---"; node recover-v2.mjs; echo "exit=$?"
```

exit code: 0

```
--- diff recover.mjs recover-v2.mjs ---
0a1,4
> // recover-v2.mjs. SECOND ATTEMPT. Same as recover.mjs except the add_signer signing now stamps
> // `signatureExpirationLedger: validUntil` (step 2 of the skill's payment recipe); the first attempt, which
> // followed the add_signer snippet verbatim (no stamp), failed at re-simulation with "signature has expired" (0).
> // Original header follows.
9c13
< import { Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';
---
> import { Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
47c51,66
<   // The EXISTING enrolled device signs the account's auth entry (as in the skill: no signatureExpirationLedger here):
---
>   // Root-cause print (agent-added, best effort, never blocks the flow): what expiration does the
>   // recording simulation put on the auth entry?
>   try {
>     const env = xdr.TransactionEnvelope.fromXDR(assembled.toXDR(), 'base64');
>     for (const op of env.value().tx().operations()) {
>       const inner = op.body().value();
>       if (!inner || typeof inner.auth !== 'function') continue;
>       for (const e of inner.auth()) {
>         const c = e.credentials(); const v = c.value(); const arm = c.switch(); const armName = (arm && arm.name) || String(arm);
>         console.log('auth entry from first prepareTransaction: credentials arm =', armName, '| signatureExpirationLedger =', typeof v?.signatureExpirationLedger === 'function' ? v.signatureExpirationLedger() : '(n/a)');
>       }
>     }
>   } catch (e) { console.log('diagnostic print skipped:', e.message); }
>   // The EXISTING enrolled device signs the account's auth entry. FIX vs the skill's add_signer snippet:
>   // stamp the expiration exactly as the payment recipe's step 2 does.
>   const validUntil = (await server.getLatestLedger()).sequence + 100;
51a71
>     signatureExpirationLedger: validUntil,
--- run ---
signer_count before: 1
device2.credentialId: Uiz0nQf4qNXVaqgJk5XZwg | publicKey: 0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545 | equals authB key: true
diagnostic print skipped: env.value is not a function
add_signer sendTransaction: {
  status: 'PENDING',
  hash: 'dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39'
}
add_signer pollTransaction status: SUCCESS | ledger: 4585630
signer_count after add_signer: 2
payment signed by device B sendTransaction: {
  status: 'PENDING',
  hash: 'ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56'
}
payment signed by device B pollTransaction status: SUCCESS | ledger: 4585631
OK: non-enrolled device C rejected. isKitError: false | code: undefined | name: Error
error message: HostError: Error(Auth, InvalidAction)

Event log (newest first):
   0: [Diagnostic Event] contract:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, topics:[error, Error(Auth, InvalidAction)], data:["failed account authentication with error", CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, Error(Contract, #3)]
   1: [Failed Diagnostic Event (not emitted)] contract:CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, topics:[error, Error(Contract, #3)], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"
   2: [Diagnostic Event] contract:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, topics:[fn_call, CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, __check_auth], data:[Bytes(be3f3336dc452ab381f9ae18c8739de02c2c99735634c7ec80984a2be5fd3615), {authenticator_data: Bytes(a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce19470500000001), client_data_json: Bytes(7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22766a387a4e7478464b724f422d61345979484f64344377736d584e574e4d6673674a684b4b2d58394e6855222c226f726967696e223a2268747470733a2f2f6578616d706c652e636f6d227d), public_key: Bytes(04d4cd017b0b60c27de70d09aab88abd2d923d8548b8ef6f9c1a40d22361d0ceefa85ab1cf00a43aaf392a29e00c996b5c7b6c5f49ee535ef4aa0b7ccb5aead90d), signature: Bytes(124a1b113eac81e6ac8832fa525f5eed5061782c91675298f9926a61c4745b1d3312e057dc5c2b5c00ef246477c67f497bb5483ea9b684815f12821602dbfe58)}, [[Contract, {args: [CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T, 10000000], contract: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, fn_name: transfer}]]]
   3: [Diagnostic Event] topics:[fn_call, CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, transfer], data:[CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T, 10000000]

signer_count at end: 2
wrote recover-txs.json
exit=0
```

## 2026-09-09T11:02:37Z

```
$ cat recover-txs.json; for H in $(node -p "const t=require(\"./recover-txs.json\");[t.addSignerTxHash,t.paymentByBTxHash].join(\" \")"); do echo "tx: $H"; curl -sS "https://horizon-testnet.stellar.org/transactions/$H" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const t=JSON.parse(s);console.log(JSON.stringify({hash:t.hash,successful:t.successful,ledger:t.ledger,created_at:t.created_at,source_account:t.source_account,fee_charged:t.fee_charged,operation_count:t.operation_count},null,2))})"; done
```

exit code: 0

```
{
  "addSignerTxHash": "dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39",
  "addSignerStatus": "SUCCESS",
  "paymentByBTxHash": "ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56",
  "paymentByBStatus": "SUCCESS",
  "paymentByCError": {
    "isKitError": false,
    "name": "Error",
    "message": "HostError: Error(Auth, InvalidAction)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, topics:[error, Error(Auth, InvalidAction)], data:[\"failed account authentication with error\", CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, Error(Contract, #3)]\n   1: [Failed Diagnostic Event (not emitted)] contract:CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, topics:[error, Error(Contract, #3)], data:\"escalating Ok(ScErrorType::Contract) frame-exit to Err\"\n   2: [Diagnostic Event] contract:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, topics:[fn_call, CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, __check_auth], data:[Bytes(be3f3336dc452ab381f9ae18c8739de02c2c99735634c7ec80984a2be5fd3615), {authenticator_data: Bytes(a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce19470500000001), client_data_json: Bytes(7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22766a387a4e7478464b724f422d61345979484f64344377736d584e574e4d6673674a684b4b2d58394e6855222c226f726967696e223a2268747470733a2f2f6578616d706c652e636f6d227d), public_key: Bytes(04d4cd017b0b60c27de70d09aab88abd2d923d8548b8ef6f9c1a40d22361d0ceefa85ab1cf00a43aaf392a29e00c996b5c7b6c5f49ee535ef4aa0b7ccb5aead90d), signature: Bytes(124a1b113eac81e6ac8832fa525f5eed5061782c91675298f9926a61c4745b1d3312e057dc5c2b5c00ef246477c67f497bb5483ea9b684815f12821602dbfe58)}, [[Contract, {args: [CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T, 10000000], contract: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, fn_name: transfer}]]]\n   3: [Diagnostic Event] topics:[fn_call, CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, transfer], data:[CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK, GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T, 10000000]\n"
  }
}tx: dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39
{
  "hash": "dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39",
  "successful": true,
  "ledger": 4585630,
  "created_at": "2026-09-09T11:02:17Z",
  "source_account": "GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T",
  "fee_charged": "287931",
  "operation_count": 1
}
tx: ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56
{
  "hash": "ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56",
  "successful": true,
  "ledger": 4585631,
  "created_at": "2026-09-09T11:02:22Z",
  "source_account": "GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T",
  "fee_charged": "23167",
  "operation_count": 1
}
```

## 2026-09-09T11:02:46Z

```
$ npm ls --all 2>&1; echo "--- lockfileVersion ---"; node -p "require(\"./package-lock.json\").lockfileVersion"; echo "--- all resolved versions from package-lock.json ---"; node -e "const l=require(\"./package-lock.json\");for (const [k,v] of Object.entries(l.packages)) if (k) console.log(k.replace(/^node_modules\\//,\"\"), v.version)"; echo "--- sponsor account transactions, in order (all testnet activity this run paid for) ---"; ADDR=$(node -p "require(\"./sponsor.json\").publicKey"); curl -sS "https://horizon-testnet.stellar.org/accounts/$ADDR/transactions?limit=20&order=asc" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const r=JSON.parse(s);for(const t of r._embedded.records){console.log(t.hash, \"successful=\"+t.successful, \"ledger=\"+t.ledger, t.created_at, \"source=\"+t.source_account)}})"
```

exit code: 0

```
skill-agent-2026-09-09@1.0.0 <scratch>
├─┬ @soropass/core@0.3.1
│ ├─┬ @noble/curves@1.9.7
│ │ └── @noble/hashes@1.8.0 deduped
│ ├── @noble/hashes@1.8.0
│ └── @stellar/stellar-sdk@17.0.1 deduped
└─┬ @stellar/stellar-sdk@17.0.1
  ├─┬ @exodus/bytes@1.15.1
  │ └── @noble/hashes@1.8.0 deduped
  ├── @noble/ed25519@3.2.0
  ├── @noble/hashes@2.4.0
  ├── @stellar/js-xdr@5.0.0
  ├── @types/json-schema@7.0.15
  ├─┬ axios@1.18.0
  │ ├── follow-redirects@1.16.0
  │ ├─┬ form-data@4.0.6
  │ │ ├── asynckit@0.4.0
  │ │ ├─┬ combined-stream@1.0.8
  │ │ │ └── delayed-stream@1.0.0
  │ │ ├─┬ es-set-tostringtag@2.1.0
  │ │ │ ├── es-errors@1.3.0
  │ │ │ ├─┬ get-intrinsic@1.3.0
  │ │ │ │ ├─┬ call-bind-apply-helpers@1.0.2
  │ │ │ │ │ ├── es-errors@1.3.0 deduped
  │ │ │ │ │ └── function-bind@1.1.2 deduped
  │ │ │ │ ├── es-define-property@1.0.1
  │ │ │ │ ├── es-errors@1.3.0 deduped
  │ │ │ │ ├─┬ es-object-atoms@1.1.2
  │ │ │ │ │ └── es-errors@1.3.0 deduped
  │ │ │ │ ├── function-bind@1.1.2 deduped
  │ │ │ │ ├─┬ get-proto@1.0.1
  │ │ │ │ │ ├─┬ dunder-proto@1.0.1
  │ │ │ │ │ │ ├── call-bind-apply-helpers@1.0.2 deduped
  │ │ │ │ │ │ ├── es-errors@1.3.0 deduped
  │ │ │ │ │ │ └── gopd@1.2.0 deduped
  │ │ │ │ │ └── es-object-atoms@1.1.2 deduped
  │ │ │ │ ├── gopd@1.2.0
  │ │ │ │ ├── has-symbols@1.1.0
  │ │ │ │ ├── hasown@2.0.4 deduped
  │ │ │ │ └── math-intrinsics@1.1.0
  │ │ │ ├─┬ has-tostringtag@1.0.2
  │ │ │ │ └── has-symbols@1.1.0 deduped
  │ │ │ └── hasown@2.0.4 deduped
  │ │ ├─┬ hasown@2.0.4
  │ │ │ └── function-bind@1.1.2
  │ │ └─┬ mime-types@2.1.35
  │ │   └── mime-db@1.52.0
  │ ├─┬ https-proxy-agent@5.0.1
  │ │ ├─┬ agent-base@6.0.2
  │ │ │ └── debug@4.4.3 deduped
  │ │ └─┬ debug@4.4.3
  │ │   └── ms@2.1.3
  │ └── proxy-from-env@2.1.0
  ├── bignumber.js@11.1.5
  ├── commander@14.0.3
  ├─┬ eventsource@4.1.1
  │ └── eventsource-parser@3.1.1
  ├─┬ feaxios@0.0.23
  │ └── is-retry-allowed@3.0.0
  ├── smol-toml@1.8.0
  └── uint8array-extras@1.5.0

--- lockfileVersion ---
3
--- all resolved versions from package-lock.json ---
@exodus/bytes 1.15.1
@noble/curves 1.9.7
@noble/ed25519 3.2.0
@noble/hashes 1.8.0
@soropass/core 0.3.1
@stellar/js-xdr 5.0.0
@stellar/stellar-sdk 17.0.1
@stellar/stellar-sdk/node_modules/@noble/hashes 2.4.0
@types/json-schema 7.0.15
agent-base 6.0.2
asynckit 0.4.0
axios 1.18.0
bignumber.js 11.1.5
call-bind-apply-helpers 1.0.2
combined-stream 1.0.8
commander 14.0.3
debug 4.4.3
delayed-stream 1.0.0
dunder-proto 1.0.1
es-define-property 1.0.1
es-errors 1.3.0
es-object-atoms 1.1.2
es-set-tostringtag 2.1.0
eventsource 4.1.1
eventsource-parser 3.1.1
feaxios 0.0.23
follow-redirects 1.16.0
form-data 4.0.6
function-bind 1.1.2
get-intrinsic 1.3.0
get-proto 1.0.1
gopd 1.2.0
has-symbols 1.1.0
has-tostringtag 1.0.2
hasown 2.0.4
https-proxy-agent 5.0.1
is-retry-allowed 3.0.0
math-intrinsics 1.1.0
mime-db 1.52.0
mime-types 2.1.35
ms 2.1.3
proxy-from-env 2.1.0
smol-toml 1.8.0
uint8array-extras 1.5.0
--- sponsor account transactions, in order (all testnet activity this run paid for) ---
6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7 successful=true ledger=4585572 2026-09-09T10:57:27Z source=GDCZMVMT4OAOWC7PT3DCUJBU2QWDPYV3FDZXEA6NCSYTSXV6MIGWSXNF
9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d successful=true ledger=4585593 2026-09-09T10:59:12Z source=GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065 successful=true ledger=4585601 2026-09-09T10:59:52Z source=GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782 successful=true ledger=4585602 2026-09-09T10:59:57Z source=GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39 successful=true ledger=4585630 2026-09-09T11:02:17Z source=GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56 successful=true ledger=4585631 2026-09-09T11:02:22Z source=GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T
```

## 2026-09-09T11:06:23Z

```
$ wc -l final-report.md; shasum -a 256 final-report.md; ls -la; echo "--- final-report.md ---"; cat final-report.md
```

exit code: 0

```
     137 final-report.md
fba1ecef8b59164188a03c095ae3edc0ad166ebc6d2a8837b99a6ef3dda8fc51  final-report.md
total 536
drwxr-xr-x@ 21 user  wheel     672 Sep  9 14:06 .
drwx------@  8 user  wheel     256 Sep  9 13:54 ..
-rw-------@  1 user  wheel     107 Sep  9 14:06 .out.ateMT2
-rw-r--r--@  1 user  wheel     510 Sep  9 13:59 account.json
-rw-r--r--@  1 user  wheel  132954 Sep  9 14:02 agent-log.md
-rw-r--r--@  1 user  wheel    3293 Sep  9 13:59 create-account.mjs
-rw-r--r--@  1 user  wheel    2211 Sep  9 14:01 extras.mjs
-rw-r--r--@  1 user  wheel   18614 Sep  9 14:06 final-report.md
drwxr-xr-x@ 44 user  wheel    1408 Sep  9 13:56 node_modules
-rw-r--r--@  1 user  wheel   19576 Sep  9 13:56 package-lock.json
-rw-r--r--@  1 user  wheel     353 Sep  9 13:56 package.json
-rw-r--r--@  1 user  wheel    4611 Sep  9 13:59 pay.mjs
-rw-r--r--@  1 user  wheel    2287 Sep  9 14:02 recover-txs.json
-rw-r--r--@  1 user  wheel    7422 Sep  9 14:02 recover-v2.mjs
-rw-r--r--@  1 user  wheel    6038 Sep  9 14:00 recover.mjs
-rwxr-xr-x@  1 user  wheel     953 Sep  9 13:55 runlog.sh
-rw-r--r--@  1 user  wheel   28096 Sep  9 13:55 skill.md
-rw-r--r--@  1 user  wheel     149 Sep  9 13:57 sponsor.json
-rw-r--r--@  1 user  wheel     955 Sep  9 13:57 sponsor.mjs
-rw-r--r--@  1 user  wheel     261 Sep  9 13:59 txs.json
-rw-r--r--@  1 user  wheel    1288 Sep  9 13:56 verify.mjs
--- final-report.md ---
# Black-box reproduction of https://soropass.dev/skill.md

Date of run: 2026-09-09, 10:54 to 11:05 UTC. Working directory: `<workdir>`. Sole information sources: the skill file (fetched with curl, saved as `skill.md`) and the npm packages it says to install (their README and type declarations under `node_modules/`). Every command and its complete output is in `agent-log.md`.

## Environment

| Item | Value |
| --- | --- |
| OS | Darwin 25.4.0, arm64 (macOS) |
| Node | v24.13.1 |
| npm | 11.8.0 |
| Skill file | 28096 bytes, 447 lines, HTTP 200 from https://soropass.dev/skill.md |
| `@soropass/core` | 0.3.1 (resolved from https://registry.npmjs.org/@soropass/core/-/core-0.3.1.tgz; peer `@stellar/stellar-sdk >=17`) |
| `@stellar/stellar-sdk` | 17.0.1 (resolved from https://registry.npmjs.org/@stellar/stellar-sdk/-/stellar-sdk-17.0.1.tgz) |
| Transitive (lockfile v3) | @noble/curves 1.9.7, @noble/hashes 1.8.0 (and 2.4.0 nested under stellar-sdk), @noble/ed25519 3.2.0, @stellar/js-xdr 5.0.0, @exodus/bytes 1.15.1, axios 1.18.0, bignumber.js 11.1.5, commander 14.0.3, eventsource 4.1.1, feaxios 0.0.23, smol-toml 1.8.0, uint8array-extras 1.5.0, @types/json-schema 7.0.15, plus axios' own subtree (full list in `agent-log.md`) |
| Install command | `npm install @soropass/core "@stellar/stellar-sdk@>=17"` (verbatim from the skill), after `npm init -y` |
| Network | Stellar testnet: friendbot.stellar.org, soroban-testnet.stellar.org (RPC), horizon-testnet.stellar.org (verification only) |

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

| Item | Value |
| --- | --- |
| Sponsor (friendbot-funded, skill snippet) | `GADZVIHHU3EQBKQPS5QGQXPKVCWIZF25FTVGZFLNSQVV6MT4JMZO6P3T` |
| Default testnet factory used (from `DEFAULT_ACCOUNT_FACTORIES`) | `CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH` (matches the skill's stated testnet factory) |
| Smart account (real, factory-deployed) | `CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK` |
| Founding credential id (base64url) | `bDl6vfHGh1FADhvHv1XIjQ` |
| Founding public key (SEC-1, 65 bytes, hex) | `048d362a193d5cc8e318ad94322ba93daac67962335077e28e91ccb51ddd49afb6d017c663cae8d72a56fd7f525c40d21b61d59ba0b92415c9c7f1523656d5f91e` |
| `deriveAccountAddress(...)` | `CDAIWPD2SSQFXPRC5OBVOXEHERUILJDMEHJ3O44JUBSVECDSJW4RIZGK`, equal to `account.contractId` (true) |
| Device B public key (hex) | `0462d7065ec6c275681eb5f847b5bdde257806dfa31611f79c8af91400ed40bf9b8b111ead2c49e90fcf04d7257735665739280387e904faee7a5ff551c2952545` |
| `signer_count()` before / after add_signer | 1 / 2 |

Every transaction produced, in ledger order, with the Horizon `successful` field:

| # | What | Hash | Horizon `successful` | Ledger | Stellar Expert |
| --- | --- | --- | --- | --- | --- |
| 1 | Friendbot funds the sponsor | `6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7` | true | 4585572 | https://stellar.expert/explorer/testnet/tx/6675cf02f1feca9ccd8490b730a582677fc3ba80e8f735c1675bbdee72a1cbf7 |
| 2 | `factory.deploy` creates the smart account (via `createPasskey` + `factoryDeployer`) | `9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d` | true | 4585593 | https://stellar.expert/explorer/testnet/tx/9605e63bca45f4d13d59115a0f4439680e543c9bfd6992fd2dffc811e48d880d |
| 3 | Sponsor seeds the smart account, 10 XLM SAC transfer | `36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065` | true | 4585601 | https://stellar.expert/explorer/testnet/tx/36e4f3d5b941013558ab029aa62b3515023d91cfbcecb4b31aef1539b2d04065 |
| 4 | Passkey-signed payment, 2.5 XLM out of the smart account (device A) | `b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782` | true | 4585602 | https://stellar.expert/explorer/testnet/tx/b63d9a5ab713c4b1978b1d792f6ea1664d7b6cbf6b2ef3ee02c0f7fbcb0e8782 |
| 5 | `add_signer(device B)` authorized by device A | `dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39` | true | 4585630 | https://stellar.expert/explorer/testnet/tx/dde16850baf518c229eabf0da4f190c063c5e82350be5db0e7a487e13f791d39 |
| 6 | Passkey-signed payment, 1 XLM, signed by device B alone | `ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56` | true | 4585631 | https://stellar.expert/explorer/testnet/tx/ea9bd4c41aaf7312e0d1412483842b2bfcf757d42d02f3e4ddec37f44a724c56 |

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
```
