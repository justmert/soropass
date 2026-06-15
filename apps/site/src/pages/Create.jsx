/* Create component page (v2 spine) — live previews mount the REAL component. */
import { useState } from 'react';
import {
  DocsPage,
  CodeGroup,
  Callout,
  PropsTable,
  PageNav,
  FeatureGrid,
  UseCases,
  I,
  Kw,
  St,
  Fn,
  Cm,
} from '../shell.jsx';
import * as PKI from '../icons.jsx';
import RealScreen from '../RealScreen.jsx';

const TOC = [
  ['overview', 'Overview', 0],
  ['usecases', 'Use cases', 0],
  ['features', 'Features', 0],
  ['preview', 'Preview & code', 0],
  ['installation', 'Installation', 0],
  ['usage', 'Usage', 0],
  ['states', 'States', 0],
  ['props', 'Props', 1],
  ['events', 'Events', 1],
  ['copy', 'Copy (i18n)', 1],
  ['a11y', 'Accessibility', 0],
  ['theming', 'Theming', 0],
  ['kit', 'In Wallets Kit', 0],
];

const PREVIEW_STATES = ['idle', 'prompting', 'deploying', 'success', 'error'];
function HeroPreview() {
  const [tab, setTab] = useState('preview');
  const [si, setSi] = useState(0);
  const st = PREVIEW_STATES[si];
  return (
    <div className="dx-tabs">
      <div className="dx-tabs__bar" role="tablist">
        <button role="tab" aria-selected={tab === 'preview'} className="dx-tabs__tab" onClick={() => setTab('preview')}>
          Preview
        </button>
        <button role="tab" aria-selected={tab === 'code'} className="dx-tabs__tab" onClick={() => setTab('code')}>
          Code
        </button>
      </div>
      {tab === 'preview' ? (
        <>
          <div className="dx-tabs__preview pk">
            <RealScreen screen="create" state={st} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              padding: '0 16px 18px',
              flexWrap: 'wrap',
              background: 'var(--pk-color-background)',
            }}
          >
            {PREVIEW_STATES.map((s, idx) => (
              <button key={s} className="lp-statepill" aria-pressed={idx === si} onClick={() => setSi(idx)}>
                {s}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: 0 }}>
          <CodeGroup
            tabs={[
              {
                label: 'Standalone (vanilla DOM)',
                raw: "import { mountCreateScreen } from '@soropass/ui/styled';\nimport '@soropass/ui/styled.css';\n\nconst handle = mountCreateScreen(root, {\n  flow,\n  onContinue(credential) { /* getAddress() */ },\n});",
                body: (
                  <code>
                    {Kw('import')} {'{ mountCreateScreen }'} {Kw('from')} {St("'@soropass/ui/styled'")};{'\n'}
                    {Kw('import')} {St("'@soropass/ui/styled.css'")};{'\n\n'}
                    {Kw('const')} handle = {Fn('mountCreateScreen')}(root, {'{'}
                    {'\n'} flow,{'\n'} {Fn('onContinue')}(credential) {'{ '}
                    {Cm('/* getAddress() */')}
                    {' }'},{'\n'}
                    {'}'});
                  </code>
                ),
              },
              {
                label: 'Via Stellar Wallets Kit',
                raw: "const passkey = new PasskeyModule({ rpId, rpName, networkPassphrase, indexer, deployer });\nStellarWalletsKit.init({ network: Networks.TESTNET, modules: [passkey] });\nawait StellarWalletsKit.authModal();\nconst addr = await StellarWalletsKit.getAddress();",
                body: (
                  <code>
                    {Kw('const')} passkey = {Kw('new')} {Fn('PasskeyModule')}({'{'} rpId, rpName, networkPassphrase,
                    indexer, deployer {'}'});{'\n'}
                    {Fn('StellarWalletsKit')}.{Fn('init')}({'{'} network: Networks.TESTNET, modules: [passkey] {'}'});
                    {'\n'}
                    {Kw('await')} {Fn('StellarWalletsKit')}.{Fn('authModal')}();{'\n'}
                    {Kw('const')} addr = {Kw('await')} {Fn('StellarWalletsKit')}.{Fn('getAddress')}();
                  </code>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

const ERR = [
  ['create:cancelled', 'USER_CANCELLED'],
  ['create:unsupported', 'UNSUPPORTED_AUTHENTICATOR'],
  ['create:onchain', 'ES256_NOT_SUPPORTED'],
  ['create:keyread', 'INVALID_PUBLIC_KEY'],
  ['create:setup', 'CONTRACT_AUTH_FAILED'],
  ['create:network', 'NETWORK_ERROR'],
];
function StatesGallery() {
  const [si, setSi] = useState(0);
  const [err, setErr] = useState('create:cancelled');
  const cur = PREVIEW_STATES[si];
  return (
    <div className="dx-tabs dx-gallery">
      <div className="dx-tabs__bar" style={{ justifyContent: 'space-between', alignItems: 'center', paddingInlineEnd: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
          {PREVIEW_STATES.map((s, idx) => (
            <button key={s} className="lp-statepill" aria-pressed={idx === si} onClick={() => setSi(idx)}>
              {s}
            </button>
          ))}
        </div>
        {cur === 'error' && (
          <select
            className="lp-select"
            style={{ width: 'auto', minWidth: 220 }}
            value={err}
            onChange={(e) => setErr(e.target.value)}
            aria-label="Error code"
          >
            {ERR.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="dx-tabs__preview pk">
        <RealScreen screen="create" state={cur} errorCode={err} />
      </div>
    </div>
  );
}

export default function Create() {
  return (
    <DocsPage active="Create" toc={TOC}>
      <div className="dx-breadcrumb">
        Components <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Create</span>
      </div>
      <h1 className="dx-h1">
        <span className="dx-h1__glyph">
          <PKI.IconPasskey />
        </span>{' '}
        Create
      </h1>
      <p className="dx-lead">
        A drop-in screen that creates a brand-new Stellar smart-account wallet from a passkey. Five states, token-driven,
        framework-agnostic — wired directly through your SDK flow or through Stellar Wallets Kit.
      </p>

      <h2 className="dx-h2" id="overview">
        Overview
      </h2>
      <p className="dx-p">
        Create wraps the first of the three passkey moments. The button press <em>is</em> the WebAuthn user gesture, so
        the OS biometric sheet opens straight from <code>onCreate</code> — then the smart account deploys on-chain while
        the screen shows calm progress. Everything renders from the shared <code>tokens.css</code>: restyle by
        overriding tokens, never by editing the component.
      </p>
      <Callout kind="note">
        <strong>Logic stays headless.</strong> This is the visual + interaction layer. You pass it a <code>flow</code>{' '}
        object (created / deployed / error events) from the SDK or the kit; it never touches the network itself.
      </Callout>

      <h2 className="dx-h2" id="usecases">
        Use cases
      </h2>
      <UseCases
        items={[
          [
            'First-run onboarding for a new wallet',
            'A user opens your wallet with no account. Create deploys a smart account from a single Face ID / Touch ID prompt — no seed phrase to write down or lose.',
          ],
          [
            '“Sign up with passkey” in a dApp',
            "Drop Create into a dApp's connect flow so first-time users get a self-custodial Stellar account in one tap, then continue straight into your app.",
          ],
          [
            'Adding passkey as an option in an existing wallet',
            "Register the PasskeyModule and Create becomes the “new passkey wallet” path inside Stellar Wallets Kit's picker, alongside your existing wallets.",
          ],
        ]}
      />

      <h2 className="dx-h2" id="features">
        Features
      </h2>
      <FeatureGrid
        items={[
          [
            <PKI.IconShield />,
            'Calm OS-sheet waiting',
            'While the native passkey sheet is up, the card dims to an opaque scrim with a gently pulsing glyph — never a spinner competing with the OS.',
          ],
          [
            <PKI.IconRefresh />,
            'On-chain deploy progress',
            'A clear “Setting up your account…” work state with an indeterminate progress bar while the smart account deploys.',
          ],
          [
            <PKI.IconCopy />,
            'Copyable C-address',
            'Success shows a middle-truncated contract address with a deterministic identicon and one-tap copy.',
          ],
          [
            <PKI.IconAlert />,
            'One error layout',
            'Every failure renders through a single error view; copy swaps by KitError code, always with a Try again action.',
          ],
          [
            <PKI.IconCheckCircle />,
            'Accessible by default',
            'Polite / assertive live regions, focus management on terminal states, full keyboard support, RTL and reduced-motion.',
          ],
          [
            <PKI.IconPasskey />,
            'Token-only theming',
            'Light and dark from one token set, plus i18n via an overridable copy object. No forking to restyle.',
          ],
        ]}
      />

      <h2 className="dx-h2" id="preview">
        Preview &amp; code
      </h2>
      <p className="dx-p dx-p--muted">
        The real component — step through each state, or flip to the mount code (standalone or via the kit).
      </p>
      <HeroPreview />

      <h2 className="dx-h2" id="installation">
        Installation
      </h2>
      <CodeGroup
        tabs={[
          { label: 'pnpm', raw: 'pnpm add @soropass/ui @soropass/core', body: <code>pnpm add @soropass/ui @soropass/core</code> },
          { label: 'npm', raw: 'npm i @soropass/ui @soropass/core', body: <code>npm i @soropass/ui @soropass/core</code> },
          { label: 'yarn', raw: 'yarn add @soropass/ui @soropass/core', body: <code>yarn add @soropass/ui @soropass/core</code> },
        ]}
      />
      <p className="dx-p">Import the stylesheet once at your app root:</p>
      <CodeGroup
        tabs={[
          {
            label: 'styles',
            raw: "import '@soropass/ui/styled.css';",
            body: (
              <code>
                {Kw('import')} {St("'@soropass/ui/styled.css'")};
              </code>
            ),
          },
        ]}
      />
      <Callout kind="tip">
        The package depends only on <code>@soropass/core</code>. <code>@stellar/stellar-sdk</code> is a peer dependency,
        never bundled.
      </Callout>

      <h2 className="dx-h2" id="usage">
        Usage
      </h2>
      <p className="dx-p">
        The smallest correct mount. <code>handle.unmount()</code> tears it down.
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'mount',
            raw: "import { mountCreateScreen } from '@soropass/ui/styled';\n\nconst handle = mountCreateScreen(root, {\n  flow,\n  onContinue(credential) {\n    console.log(credential.contractId);\n  },\n});",
            body: (
              <code>
                {Kw('import')} {'{ mountCreateScreen }'} {Kw('from')} {St("'@soropass/ui/styled'")};{'\n\n'}
                {Kw('const')} handle = {Fn('mountCreateScreen')}(root, {'{'}
                {'\n'} flow,{'\n'} {Fn('onContinue')}(credential) {'{'}
                {'\n'} console.{Fn('log')}(credential.contractId);{'\n'} {'}'},{'\n'}
                {'}'});
              </code>
            ),
          },
        ]}
      />
      <p className="dx-p">A fuller example — create, then route into your app once the account is live:</p>
      <CodeGroup
        tabs={[
          {
            label: 'onboarding.ts',
            raw: "import { createCreatePasskeyFlow } from '@soropass/ui/headless';\nimport { mountCreateScreen } from '@soropass/ui/styled';\n\nconst flow = createCreatePasskeyFlow({ create: runCeremony });\n\nconst handle = mountCreateScreen(document.querySelector('#auth'), {\n  flow,\n  copy: { idleTitle: 'Create your Acme wallet' },\n  onContinue(credential) {\n    router.push('/home');          // account is live on-chain\n    handle.unmount();\n  },\n});",
            body: (
              <code>
                {Kw('import')} {'{ createCreatePasskeyFlow }'} {Kw('from')} {St("'@soropass/ui/headless'")};{'\n'}
                {Kw('import')} {'{ mountCreateScreen }'} {Kw('from')} {St("'@soropass/ui/styled'")};{'\n\n'}
                {Kw('const')} flow = {Fn('createCreatePasskeyFlow')}({'{ create: runCeremony }'});{'\n\n'}
                {Kw('const')} handle = {Fn('mountCreateScreen')}(document.{Fn('querySelector')}({St("'#auth'")}), {'{'}
                {'\n'} flow,{'\n'} copy: {'{'} idleTitle: {St("'Create your Acme wallet'")} {'}'},{'\n'}{' '}
                {Fn('onContinue')}(credential) {'{'}
                {'\n'} router.{Fn('push')}({St("'/home'")}); {Cm('// account is live on-chain')}
                {'\n'} handle.{Fn('unmount')}();{'\n'} {'}'},{'\n'}
                {'}'});
              </code>
            ),
          },
        ]}
      />

      <h2 className="dx-h2" id="states">
        States
      </h2>
      <p className="dx-p dx-p--muted">
        Five states. The error state cycles the frozen 10-code KitError taxonomy through one layout.
      </p>
      <StatesGallery />
      <Callout kind="note">
        <strong>Two busy looks.</strong> <code>prompting</code> shows a calm opaque scrim + pulsing glyph (no spinner)
        while the OS sheet is up; <code>deploying</code> shows a spinner + progress because the SDK is working.{' '}
        <code>success</code> uses the result layout; <code>error</code> the single error view.
      </Callout>

      <h2 className="dx-h2" id="props">
        Props
      </h2>
      <PropsTable
        cols={['Prop', 'Type', 'Default', 'Description']}
        rows={[
          [
            <>
              flow<span className="t-req">REQ</span>
            </>,
            <span className="t-type">CreateFlow</span>,
            <span className="t-def">—</span>,
            'Headless flow controller from the SDK / kit. Drives state transitions.',
          ],
          [
            'copy',
            <span className="t-type">Partial&lt;CreateCopy&gt;</span>,
            <span className="t-def">DEFAULT_CREATE_COPY</span>,
            'Override any UI string for i18n / brand voice.',
          ],
          [
            'input',
            <span className="t-type">{`{ userName? }`}</span>,
            <span className="t-def">undefined</span>,
            'Optional hint passed to the passkey ceremony.',
          ],
          [
            'onContinue',
            <span className="t-type">(c: PasskeyCredential) =&gt; void</span>,
            <span className="t-def">undefined</span>,
            "Fires on the success screen's Continue button.",
          ],
          [
            'onHelp',
            <span className="t-type">() =&gt; void</span>,
            <span className="t-def">undefined</span>,
            'Fires on the “What\'s a passkey?” link.',
          ],
        ]}
      />

      <h3 className="dx-h3" id="events">
        Events
      </h3>
      <PropsTable
        cols={['Callback', 'When it fires', 'Payload']}
        rows={[
          ['onContinue', 'User confirms on the success state', <span className="t-type">PasskeyCredential</span>],
          ['onHelp', 'User taps the help link on idle', <span className="t-type">void</span>],
        ]}
      />

      <h3 className="dx-h3" id="copy">
        Copy (i18n)
      </h3>
      <p className="dx-p dx-p--muted">
        Every key of <code>CreateCopy</code> with its default. Pass a partial <code>copy</code> to override.
      </p>
      <PropsTable
        cols={['Key', 'Default string']}
        rows={[
          ['idleTitle', 'Create your wallet'],
          ['idleSubtitle', 'A passkey — your Face ID, fingerprint, or security key — replaces your seed phrase.'],
          ['createLabel', 'Create passkey'],
          ['promptingTitle', 'Waiting for your passkey'],
          ['deployingTitle', 'Setting up your account…'],
          ['successTitle', 'Wallet ready'],
        ]}
      />

      <h2 className="dx-h2" id="a11y">
        Accessibility
      </h2>
      <FeatureGrid
        items={[
          [
            <PKI.IconCheckCircle />,
            'Announced status',
            'Polite role=status for prompting / deploying; assertive role=alert for the error view.',
          ],
          [
            <PKI.IconArrowLeft />,
            'Focus management',
            'On terminal states (success / error) focus moves to the status paragraph (tabIndex=-1, preventScroll).',
          ],
          [
            <PKI.IconKey />,
            'Keyboard & focus ring',
            'A visible focus ring on every interactive element; full Tab / Shift+Tab order.',
          ],
          [
            <PKI.IconRefresh />,
            'RTL & reduced-motion',
            'Mirrors via CSS logical properties (dir="rtl"); a reduced-motion variant freezes pulses and spins.',
          ],
        ]}
      />

      <h2 className="dx-h2" id="theming">
        Theming
      </h2>
      <p className="dx-p dx-p--muted">
        The token groups this screen reads. A CI token gate guarantees the CSS references only <code>var()</code>{' '}
        tokens.
      </p>
      <PropsTable
        cols={['Area', 'Tokens']}
        rows={[
          ['idle', <span className="t-type">--pk-color-brand / -soft / -on-brand, --pk-radius-lg/md, --pk-space-*</span>],
          [
            'waiting (OS sheet)',
            <span className="t-type">--pk-scrim, --pk-busy-opacity, --pk-z-toast, --pk-pulse-duration</span>,
          ],
          ['deploying', <span className="t-type">--pk-spinner-*, --pk-progress-*</span>],
          ['error', <span className="t-type">--pk-color-error / -soft</span>],
        ]}
      />

      <h2 className="dx-h2" id="kit">
        In Stellar Wallets Kit
      </h2>
      <p className="dx-p">
        Register <code>PasskeyModule</code> and the styled Create screen renders inside the kit's wallet picker like any
        other wallet.
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'Wallets Kit',
            raw: "const passkey = new PasskeyModule({ rpId, rpName, networkPassphrase, indexer, deployer });\nStellarWalletsKit.init({ network: Networks.TESTNET, modules: [passkey] });\n\n// Create seam → CreateFlow (createAccount is on the module)\nawait passkey.createAccount('alice');\nconst address = await StellarWalletsKit.getAddress(); // C-address → AddressChip",
            body: (
              <code>
                {Kw('const')} passkey = {Kw('new')} {Fn('PasskeyModule')}({'{'} rpId, rpName, networkPassphrase, indexer,
                deployer {'}'});{'\n'}
                {Fn('StellarWalletsKit')}.{Fn('init')}({'{'} network: Networks.TESTNET, modules: [passkey] {'}'});{'\n\n'}
                {Cm('// Create seam → CreateFlow (createAccount is on the module)')}
                {'\n'}
                {Kw('await')} passkey.{Fn('createAccount')}({St("'alice'")});{'\n'}
                {Kw('const')} address = {Kw('await')} {Fn('StellarWalletsKit')}.{Fn('getAddress')}();{' '}
                {Cm('// C-address → AddressChip')}
              </code>
            ),
          },
        ]}
      />
      <Callout kind="tip">
        <code>PasskeyModule.isAvailable()</code> resolves <code>isUVPAA</code> within a 500ms budget to show or hide
        passkey in the picker.
      </Callout>

      <PageNav prev={['Overview', '/components']} next={['Sign', '/components/sign']} />
    </DocsPage>
  );
}
