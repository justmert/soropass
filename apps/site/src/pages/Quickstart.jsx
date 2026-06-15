/* Quickstart — one real, runnable path (no fiction). */
import { DocsPage, CodeGroup, Callout, PageNav, I, Kw, St, Fn, Cm } from '../shell.jsx';

const TOC = [
  ['build', "What you'll build", 0],
  ['install', 'Install', 0],
  ['path-a', 'Path A — headless / direct', 0],
  ['path-b', 'Path B — through the kit', 0],
  ['errors', 'Handle errors', 0],
  ['ci', 'Test in CI', 0],
  ['next', "What's next", 0],
];

export default function Quickstart() {
  return (
    <DocsPage active="Quickstart" toc={TOC}>
      <div className="dx-breadcrumb">
        Get started <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Quickstart</span>
      </div>
      <h1 className="dx-h1">Quickstart</h1>
      <p className="dx-lead">
        One runnable path from zero to a working passkey wallet: <strong>create</strong> a smart account from a
        biometric, <strong>sign</strong> a transaction with it, and <strong>recover</strong> it on a new device.
        ES256-only, low-S by default, no seed phrase.
      </p>

      <h2 className="dx-h2" id="build">
        What you'll build
      </h2>
      <div className="dx-mini3">
        {[
          ['Create', 'A passkey registers and deploys a Stellar smart-account wallet — one Face ID / Touch ID prompt.'],
          ['Sign', 'Approve a transaction; the assertion is DER → raw, low-S normalized, then assembled into Soroban auth.'],
          ['Recover', 'On a fresh device, a discoverable prompt + the indexer find every account the passkey controls.'],
        ].map(([t, d], i) => (
          <div className="dx-mini" key={t}>
            <span className="dx-mini__n">{i + 1}</span>
            <strong>{t}</strong>
            <span>{d}</span>
          </div>
        ))}
      </div>

      <h2 className="dx-h2" id="install">
        Install
      </h2>
      <p className="dx-p">The SDK is the only required dependency:</p>
      <CodeGroup
        tabs={[
          { label: 'pnpm', raw: 'pnpm add @soropass/core', body: <code>pnpm add @soropass/core</code> },
          { label: 'npm', raw: 'npm i @soropass/core', body: <code>npm i @soropass/core</code> },
        ]}
      />
      <p className="dx-p">
        To go through Stellar Wallets Kit (Path B), add the kit and the module:
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'pnpm',
            raw: 'pnpm add @creit.tech/stellar-wallets-kit @soropass/wallets-kit-module',
            body: <code>pnpm add @creit.tech/stellar-wallets-kit @soropass/wallets-kit-module</code>,
          },
        ]}
      />
      <Callout kind="tip">
        <code>@stellar/stellar-sdk</code> is a <strong>peer dependency</strong> — it's never bundled into the SDK output.
        Install it alongside if your app doesn't already depend on it.
      </Callout>

      <h2 className="dx-h2" id="path-a">
        Path A — headless / direct
      </h2>
      <p className="dx-p">
        Call the three ceremonies straight from <code>@soropass/core</code>. Lead with the mock path: it runs in CI with
        no authenticator and no network, and the live path has the exact same shape.
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'Run in CI (mock, zero infra)',
            raw: "import { createPasskeyKit } from '@soropass/core/testing';\n\n// Deterministic in-memory authenticator + backend — no network, no authenticator.\nconst kit = createPasskeyKit({ mode: 'mock', rpId: 'localhost' });\n\nconst account = await kit.createPasskey({ userName: 'alice' });\nconsole.log(account.contractId);            // C-address\n\nconst signedEntry = await kit.signAuthEntry(entryXdr);\nconst accounts = await kit.recover();        // 0, 1, or many\n\n// Swap mode 'mock' → 'live' (with real adapters) and the path stays green.",
            body: (
              <code>
                {Kw('import')} {'{ createPasskeyKit }'} {Kw('from')} {St("'@soropass/core/testing'")};{'\n\n'}
                {Cm('// Deterministic in-memory authenticator + backend — no network, no authenticator.')}
                {'\n'}
                {Kw('const')} kit = {Fn('createPasskeyKit')}({'{'} mode: {St("'mock'")}, rpId: {St("'localhost'")} {'}'});
                {'\n\n'}
                {Kw('const')} account = {Kw('await')} kit.{Fn('createPasskey')}({'{'} userName: {St("'alice'")} {'}'});
                {'\n'}
                console.{Fn('log')}(account.contractId); {Cm('// C-address')}
                {'\n\n'}
                {Kw('const')} signedEntry = {Kw('await')} kit.{Fn('signAuthEntry')}(entryXdr);{'\n'}
                {Kw('const')} accounts = {Kw('await')} kit.{Fn('recover')}(); {Cm('// 0, 1, or many')}
                {'\n\n'}
                {Cm("// Swap mode 'mock' → 'live' (with real adapters) and the path stays green.")}
              </code>
            ),
          },
          {
            label: 'Live browser',
            raw: "import { createPasskey } from '@soropass/core/create';\nimport { signTransaction, browserPasskeySigner } from '@soropass/core/sign';\nimport { recover, eventsIndexer } from '@soropass/core';\n\n// 1. Create — registers an ES256 passkey and deploys the smart account.\nconst { contractId, credentialId } = await createPasskey({\n  rpId: 'example.com',\n  rpName: 'Example',\n  userName: 'alice',\n  deployer,                  // <- the only thing you supply (AccountDeployer)\n});\n\n// 2. Sign — the button press is the WebAuthn user gesture.\nconst signedXdr = await signTransaction(txXdr, {\n  networkPassphrase,\n  sign: browserPasskeySigner({ rpId: 'example.com', allowCredentials: [credentialId] }),\n});\n\n// 3. Recover — discoverable prompt + indexer, on any device.\nconst accounts = await recover({\n  rpId: 'example.com',\n  indexer: eventsIndexer({ rpcUrl, factoryContractId }),\n});",
            body: (
              <code>
                {Kw('import')} {'{ createPasskey }'} {Kw('from')} {St("'@soropass/core/create'")};{'\n'}
                {Kw('import')} {'{ signTransaction, browserPasskeySigner }'} {Kw('from')} {St("'@soropass/core/sign'")};
                {'\n'}
                {Kw('import')} {'{ recover, eventsIndexer }'} {Kw('from')} {St("'@soropass/core'")};{'\n\n'}
                {Cm('// 1. Create — registers an ES256 passkey and deploys the smart account.')}
                {'\n'}
                {Kw('const')} {'{ contractId, credentialId }'} = {Kw('await')} {Fn('createPasskey')}({'{'}
                {'\n'} rpId: {St("'example.com'")},{'\n'} rpName: {St("'Example'")},{'\n'} userName: {St("'alice'")},
                {'\n'} deployer, {Cm('// <- the only thing you supply (AccountDeployer)')}
                {'\n'}
                {'}'});{'\n\n'}
                {Cm('// 2. Sign — the button press is the WebAuthn user gesture.')}
                {'\n'}
                {Kw('const')} signedXdr = {Kw('await')} {Fn('signTransaction')}(txXdr, {'{'}
                {'\n'} networkPassphrase,{'\n'} sign: {Fn('browserPasskeySigner')}({'{'} rpId: {St("'example.com'")},
                {' '}allowCredentials: [credentialId] {'}'}),{'\n'}
                {'}'});{'\n\n'}
                {Cm('// 3. Recover — discoverable prompt + indexer, on any device.')}
                {'\n'}
                {Kw('const')} accounts = {Kw('await')} {Fn('recover')}({'{'}
                {'\n'} rpId: {St("'example.com'")},{'\n'} indexer: {Fn('eventsIndexer')}({'{ rpcUrl, factoryContractId }'}),
                {'\n'}
                {'}'});
              </code>
            ),
          },
        ]}
      />
      <Callout kind="note">
        The <code>deployer</code> (an <code>AccountDeployer</code>) is the only piece the adopter supplies — it deploys
        the smart account for a new passkey against your factory. Everything else (DER → raw, low-S, the Soroban auth
        struct) is handled inside the SDK.
      </Callout>

      <h2 className="dx-h2" id="path-b">
        Path B — through the kit (recommended)
      </h2>
      <p className="dx-p">
        Register a <code>PasskeyModule</code> and passkey becomes one more wallet in{' '}
        <code>@creit.tech/stellar-wallets-kit</code> — your existing <code>getAddress</code> /{' '}
        <code>signTransaction</code> calls are unchanged. <code>StellarWalletsKit</code> is a static class; never{' '}
        <code>new</code> it.
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'kit.ts',
            raw: "import { PasskeyModule, PASSKEY_ID } from '@soropass/wallets-kit-module';\nimport { eventsIndexer } from '@soropass/core';\nimport { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';\nimport { Networks } from '@creit.tech/stellar-wallets-kit';\n\nconst passkey = new PasskeyModule({\n  rpId: 'example.com',\n  rpName: 'Example',\n  networkPassphrase: Networks.TESTNET,\n  indexer: eventsIndexer({ rpcUrl, factoryContractId }),\n  deployer,\n});\n\nStellarWalletsKit.init({ network: Networks.TESTNET, modules: [passkey] });\n\n// createAccount lives on the MODULE, not the kit:\nconst account = await passkey.createAccount('alice');\n\n// Then drive everything through the static kit:\nStellarWalletsKit.setWallet(PASSKEY_ID);\nconst { address } = await StellarWalletsKit.getAddress();\nconst { signedTxXdr } = await StellarWalletsKit.signTransaction(txXdr, { networkPassphrase });",
            body: (
              <code>
                {Kw('import')} {'{ PasskeyModule, PASSKEY_ID }'} {Kw('from')}{' '}
                {St("'@soropass/wallets-kit-module'")};{'\n'}
                {Kw('import')} {'{ eventsIndexer }'} {Kw('from')} {St("'@soropass/core'")};{'\n'}
                {Kw('import')} {'{ StellarWalletsKit }'} {Kw('from')}{' '}
                {St("'@creit.tech/stellar-wallets-kit/sdk'")};{'\n'}
                {Kw('import')} {'{ Networks }'} {Kw('from')} {St("'@creit.tech/stellar-wallets-kit'")};{'\n\n'}
                {Kw('const')} passkey = {Kw('new')} {Fn('PasskeyModule')}({'{'}
                {'\n'} rpId: {St("'example.com'")},{'\n'} rpName: {St("'Example'")},{'\n'} networkPassphrase:
                {' '}Networks.TESTNET,{'\n'} indexer: {Fn('eventsIndexer')}({'{ rpcUrl, factoryContractId }'}),{'\n'}{' '}
                deployer,{'\n'}
                {'}'});{'\n\n'}
                StellarWalletsKit.{Fn('init')}({'{'} network: Networks.TESTNET, modules: [passkey] {'}'});{'\n\n'}
                {Cm('// createAccount lives on the MODULE, not the kit:')}
                {'\n'}
                {Kw('const')} account = {Kw('await')} passkey.{Fn('createAccount')}({St("'alice'")});{'\n\n'}
                {Cm('// Then drive everything through the static kit:')}
                {'\n'}
                StellarWalletsKit.{Fn('setWallet')}(PASSKEY_ID);{'\n'}
                {Kw('const')} {'{ address }'} = {Kw('await')} StellarWalletsKit.{Fn('getAddress')}();{'\n'}
                {Kw('const')} {'{ signedTxXdr }'} = {Kw('await')} StellarWalletsKit.{Fn('signTransaction')}(txXdr, {'{'}
                {' '}networkPassphrase {'}'});
              </code>
            ),
          },
        ]}
      />
      <Callout kind="note">
        <strong>Two facts to keep in mind.</strong> <code>module.isAvailable()</code> resolves <code>isUVPAA</code>{' '}
        within a 500ms budget — that's what gates whether passkey appears in the wallet picker. And raise the resource
        budget after <code>simulate()</code>: on-chain <code>secp256r1_verify</code> is under-budgeted by simulation, so
        a transaction sent at the simulated budget will fail.
      </Callout>

      <h2 className="dx-h2" id="errors">
        Handle errors
      </h2>
      <p className="dx-p">
        Every ceremony throws a <code>KitError</code> with a <code>code</code> from the frozen 10-code taxonomy. Narrow
        with <code>isKitError(e)</code>, then switch on <code>e.code</code>:
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'errors.ts',
            raw: "import { isKitError, KIT_ERROR_CODES } from '@soropass/core/types';\n\n// KIT_ERROR_CODES (frozen, 10):\n//   USER_CANCELLED, ES256_NOT_SUPPORTED, RP_ID_MISMATCH, ORIGIN_MISMATCH,\n//   CHALLENGE_MISMATCH, INVALID_SIGNATURE_DER, INVALID_PUBLIC_KEY,\n//   CONTRACT_AUTH_FAILED, NETWORK_ERROR, UNSUPPORTED_AUTHENTICATOR\n\ntry {\n  await signTransaction(txXdr, { networkPassphrase, sign });\n} catch (e) {\n  if (isKitError(e)) {\n    switch (e.code) {\n      case 'USER_CANCELLED': return; // user dismissed the sheet\n      case 'NETWORK_ERROR': /* retry */ break;\n      case 'ES256_NOT_SUPPORTED': /* wrong algorithm */ break;\n    }\n  }\n  throw e;\n}",
            body: (
              <code>
                {Kw('import')} {'{ isKitError, KIT_ERROR_CODES }'} {Kw('from')} {St("'@soropass/core/types'")};{'\n\n'}
                {Cm('// KIT_ERROR_CODES (frozen, 10):')}
                {'\n'}
                {Cm('//   USER_CANCELLED, ES256_NOT_SUPPORTED, RP_ID_MISMATCH, ORIGIN_MISMATCH,')}
                {'\n'}
                {Cm('//   CHALLENGE_MISMATCH, INVALID_SIGNATURE_DER, INVALID_PUBLIC_KEY,')}
                {'\n'}
                {Cm('//   CONTRACT_AUTH_FAILED, NETWORK_ERROR, UNSUPPORTED_AUTHENTICATOR')}
                {'\n\n'}
                {Kw('try')} {'{'}
                {'\n'} {Kw('await')} {Fn('signTransaction')}(txXdr, {'{ networkPassphrase, sign }'});{'\n'}
                {'}'} {Kw('catch')} (e) {'{'}
                {'\n'} {Kw('if')} ({Fn('isKitError')}(e)) {'{'}
                {'\n'} {Kw('switch')} (e.code) {'{'}
                {'\n'} {Kw('case')} {St("'USER_CANCELLED'")}: {Kw('return')}; {Cm('// user dismissed the sheet')}
                {'\n'} {Kw('case')} {St("'NETWORK_ERROR'")}: {Cm('/* retry */')} {Kw('break')};{'\n'} {Kw('case')}{' '}
                {St("'ES256_NOT_SUPPORTED'")}: {Cm('/* wrong algorithm */')} {Kw('break')};{'\n'} {'}'}
                {'\n'} {'}'}
                {'\n'} {Kw('throw')} e;{'\n'}
                {'}'}
              </code>
            ),
          },
        ]}
      />
      <Callout kind="tip">
        The full taxonomy with per-code copy lives in <a href="/sdk/errors">the KitError taxonomy</a>. The styled screens
        already render the right message per code.
      </Callout>

      <h2 className="dx-h2" id="ci">
        Test in CI (no authenticator)
      </h2>
      <p className="dx-p">
        Two options for deterministic, zero-network tests: the <code>createPasskeyKit({'{'} mode: 'mock' {'}'})</code>{' '}
        facade shown above, or the lower-level primitives when you need to drive the raw ceremonies yourself.
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'test.ts',
            raw: "import { mockAuthenticator, createInMemoryBackend } from '@soropass/core/testing';\n\n// Deterministic P-256 keypair + credentialId from a seed; a real attestationObject.\nconst auth = mockAuthenticator({ rpId: 'localhost', seed: 'alice' });\n\n// Zero-IO deployer + indexer + submission sharing one registry.\nconst backend = createInMemoryBackend();\n\n// Run create → sign → recover with backend.deployer / backend.indexer,\n// and auth as the WebAuthn client / signer — no network, no real authenticator.",
            body: (
              <code>
                {Kw('import')} {'{ mockAuthenticator, createInMemoryBackend }'} {Kw('from')}{' '}
                {St("'@soropass/core/testing'")};{'\n\n'}
                {Cm('// Deterministic P-256 keypair + credentialId from a seed; a real attestationObject.')}
                {'\n'}
                {Kw('const')} auth = {Fn('mockAuthenticator')}({'{'} rpId: {St("'localhost'")}, seed: {St("'alice'")} {'}'}
                );{'\n\n'}
                {Cm('// Zero-IO deployer + indexer + submission sharing one registry.')}
                {'\n'}
                {Kw('const')} backend = {Fn('createInMemoryBackend')}();{'\n\n'}
                {Cm('// Run create → sign → recover with backend.deployer / backend.indexer,')}
                {'\n'}
                {Cm('// and auth as the WebAuthn client / signer — no network, no real authenticator.')}
              </code>
            ),
          },
        ]}
      />

      <h2 className="dx-h2" id="next">
        What's next
      </h2>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[
          ['Create screen', '/components/create', 'The drop-in styled create screen and its states.'],
          ['SDK · Sign', '/sdk/sign', 'Soroban auth assembly, challenge binding, low-S.'],
          ['Recover & Connect', '/sdk/recover', 'Silent reconnect and the new-device recovery path.'],
          ['Adapters', '/sdk/adapters', 'Pluggable submission + indexer; the zero-infra defaults.'],
          ['KitError taxonomy', '/sdk/errors', 'All 10 frozen codes and what to show for each.'],
          ['Compatibility', '/compatibility', 'The living matrix: where passkeys work today.'],
        ].map(([t, h, d]) => (
          <a className="dx-card" href={h} key={t}>
            <p className="dx-card__title">{t}</p>
            <p className="dx-card__body">{d}</p>
          </a>
        ))}
      </div>
      <Callout kind="tip">
        Want a styled flow instead of wiring the screens yourself? Mount one from{' '}
        <code>@soropass/ui/styled</code> — see the <a href="/components/create">component docs</a>.
      </Callout>

      <PageNav prev={['Overview', '/']} next={['Create', '/components/create']} />
    </DocsPage>
  );
}
