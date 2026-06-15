/* Connect & Add device: Connect · Add device · Funding — REAL @soropass/ui components (v2 spine). */
import { useState } from 'react';
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, UseCases, I, Kw, Fn, Cm, St } from '../shell.jsx';
import * as PKI from '../icons.jsx';
import RealScreen from '../RealScreen.jsx';

const TOC = [
  ['connect', 'Connect chooser', 0],
  ['c-states', 'States', 1],
  ['c-props', 'Props', 1],
  ['adddevice', 'Add device', 0],
  ['a-states', 'States', 1],
  ['a-props', 'Props', 1],
  ['funding', 'Funding state', 0],
];

function Stage({ children }) {
  return (
    <div className="dx-embed__body pk" style={{ minHeight: 360 }}>
      {children}
    </div>
  );
}
function Preview({ children }) {
  return (
    <div className="dx-embed">
      <div className="dx-embed__bar">
        <span className="dx-embed__dot" />
        <span className="dx-embed__dot" />
        <span className="dx-embed__dot" />
        <span className="dx-embed__url">@soropass/ui</span>
      </div>
      {children}
    </div>
  );
}
function StateRail({ states, cur, set }) {
  return (
    <div className="lp-statepills" style={{ marginBottom: 14 }}>
      {states.map((s) => (
        <button key={s} className="lp-statepill" aria-pressed={cur === s} onClick={() => set(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

export default function NewComponents() {
  const [aState, setAState] = useState('idle');
  const [cState, setCState] = useState('funding');
  return (
    <DocsPage active="Connect & Add device" toc={TOC}>
      <div className="dx-breadcrumb">
        Components <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Connect & Add device</span>
      </div>
      <h1 className="dx-h1">Connect &amp; Add device</h1>
      <p className="dx-lead">
        Three small additions that complete the passkey journey — a connect chooser, a backup-signer flow, and a funding
        state — all shipping in <code>@soropass/ui</code>, built from the existing primitives and token set. The previews
        below are the real components.
      </p>
      <Callout kind="note">
        Architecture: the kit can't host custom module pages, so <strong>connect rides the kit's own modal</strong> and
        these are drop-in components the wallet mounts around it.
      </Callout>

      {/* ---- Connect ---- */}
      <h2 className="dx-h2" id="connect">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <PKI.IconPasskey size={22} /> Connect — entry chooser
        </span>
      </h2>
      <p className="dx-p">
        One tiny surface that forks <strong>“Create a new passkey wallet”</strong> vs{' '}
        <strong>“Use an existing passkey.”</strong> The glue that makes create + recover usable from a single entry
        point — “use existing” hands off to the kit's own modal.
      </p>
      <UseCases
        items={[
          [
            "The wallet's front door",
            'Show one screen on launch: returning users tap ‘use existing’ and recover; new users tap ‘create’ and onboard. No guesswork about which flow to render.',
          ],
          [
            'A dApp connect button',
            'Behind a single ‘Connect’ action, let users either bring an existing passkey account or spin up a new one without leaving your flow.',
          ],
        ]}
      />
      <h3 className="dx-h3" id="c-states">
        States
      </h3>
      <Preview>
        <Stage>
          <RealScreen screen="connect" />
        </Stage>
      </Preview>
      <p className="dx-p dx-p--muted">
        A single <code>idle</code> state with two choices that route out — deliberately minimal, no flow state.
      </p>
      <h3 className="dx-h3" id="c-props">
        Props — <code>ConnectScreenOptions</code>
      </h3>
      <PropsTable
        cols={['Prop', 'Type', 'Description']}
        rows={[
          ['onCreate', <span className="t-type">() =&gt; void</span>, 'Opens the Create flow.'],
          [
            'onUseExisting',
            <span className="t-type">() =&gt; void</span>,
            'Hands off to the kit modal (getAddress → discoverable credential).',
          ],
          ['onHelp', <span className="t-type">() =&gt; void</span>, '“What\'s a passkey?” link.'],
          ['copy', <span className="t-type">Partial&lt;ConnectCopy&gt;</span>, 'Override any string for i18n.'],
        ]}
      />
      <CodeGroup
        tabs={[
          {
            label: 'mount',
            raw: "import { mountConnectScreen, mountCreateScreen } from '@soropass/ui/styled';\nimport { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';\n\nmountConnectScreen(root, {\n  onCreate: () => mountCreateScreen(root, { flow }),\n  onUseExisting: () => StellarWalletsKit.authModal(),\n});",
            body: (
              <code>
                {Kw('import')} {'{ mountConnectScreen, mountCreateScreen }'} {Kw('from')} {St("'@soropass/ui/styled'")};
                {'\n'}
                {Kw('import')} {'{ StellarWalletsKit }'} {Kw('from')} {St("'@creit.tech/stellar-wallets-kit/sdk'")};
                {'\n\n'}
                {Fn('mountConnectScreen')}(root, {'{'}
                {'\n'} onCreate: () =&gt; {Fn('mountCreateScreen')}(root, {'{ flow }'}),{'\n'} onUseExisting: () =&gt;{' '}
                {Fn('StellarWalletsKit')}.{Fn('authModal')}(),{'\n'}
                {'}'});
              </code>
            ),
          },
        ]}
      />

      {/* ---- Add device ---- */}
      <h2 className="dx-h2" id="adddevice">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <PKI.IconPlus size={22} /> Add backup passkey
        </span>
      </h2>
      <p className="dx-p">
        Register a <strong>new passkey as an additional signer</strong> on an existing smart account — “add this device”
        / “set up a backup key.” Our recover only <em>discovers</em> accounts; this <em>enrolls</em> a new credential,
        completing the lost-device story. Mounted from the wallet's account / settings surface, not the connect modal.
      </p>
      <UseCases
        items={[
          [
            'Set up a backup before you need it',
            'From account settings, a user enrolls a second passkey — a hardware key or another device — so losing one device never means losing the account.',
          ],
          [
            'Add a new phone',
            "On a freshly set-up device, enroll its platform passkey as an additional signer on the existing account in one biometric prompt.",
          ],
        ]}
      />
      <Callout kind="warn">
        An add-signer path is also an account-takeover path if misused — the UI says so on the idle state. Surface the
        trade-off; don't hide it.
      </Callout>
      <h3 className="dx-h3" id="a-states">
        States
      </h3>
      <StateRail states={['idle', 'prompting', 'binding', 'success', 'error']} cur={aState} set={setAState} />
      <Preview>
        <Stage>
          <RealScreen screen="adddevice" state={aState} errorCode="CONTRACT_AUTH_FAILED" />
        </Stage>
      </Preview>
      <p className="dx-p dx-p--muted">
        Reuses <code>waitOverlay</code> (calm OS-sheet wait) · <code>workBlock</code> (on-chain binding) ·{' '}
        <code>resultLayout</code> · the single <code>errorView</code> — the same building blocks as create / sign /
        recover.
      </p>
      <h3 className="dx-h3" id="a-props">
        Props — <code>AddDeviceScreenOptions</code>
      </h3>
      <PropsTable
        cols={['Prop', 'Type', 'Description']}
        rows={[
          [
            <>
              flow<span className="t-req">REQ</span>
            </>,
            <span className="t-type">AddDeviceFlow</span>,
            'From createAddDeviceFlow — drives idle → prompting → binding → success | error.',
          ],
          ['onDone', <span className="t-type">() =&gt; void</span>, 'Fires on the success screen (shows the new signer).'],
          ['onCancel', <span className="t-type">() =&gt; void</span>, 'Secondary action on idle.'],
          ['copy', <span className="t-type">Partial&lt;AddDeviceCopy&gt;</span>, 'i18n / brand voice.'],
        ]}
      />
      <CodeGroup
        tabs={[
          {
            label: 'Standalone',
            raw: "import { createAddDeviceFlow } from '@soropass/ui/headless';\nimport { mountAddDeviceScreen } from '@soropass/ui/styled';\nimport { createPasskey } from '@soropass/core/create';\nimport { signTransaction } from '@soropass/core/sign';\n\nconst flow = createAddDeviceFlow({\n  userActivation: navigator.userActivation,\n  async addDevice(report) {\n    const backup = await createPasskey({ rpId, rpName, userName: 'Backup device', deployer });\n    report.binding();                                  // on-chain add-signer phase\n    const xdr = buildAddSignerTx(account.contractId, backup.publicKey);\n    await submission.send(await signTransaction(xdr, { networkPassphrase, sign }));\n    return { signer: backup.credentialId };\n  },\n});\nmountAddDeviceScreen(root, { flow });",
            body: (
              <code>
                {Kw('import')} {'{ createAddDeviceFlow }'} {Kw('from')} {St("'@soropass/ui/headless'")};{'\n'}
                {Kw('import')} {'{ mountAddDeviceScreen }'} {Kw('from')} {St("'@soropass/ui/styled'")};{'\n'}
                {Kw('import')} {'{ createPasskey }'} {Kw('from')} {St("'@soropass/core/create'")};{'\n'}
                {Kw('import')} {'{ signTransaction }'} {Kw('from')} {St("'@soropass/core/sign'")};{'\n\n'}
                {Kw('const')} flow = {Fn('createAddDeviceFlow')}({'{'}
                {'\n'} userActivation: navigator.userActivation,{'\n'} {Kw('async')} {Fn('addDevice')}(report) {'{'}
                {'\n'} {Kw('const')} backup = {Kw('await')} {Fn('createPasskey')}({'{ rpId, rpName, userName: '}
                {St("'Backup device'")}
                {', deployer }'});{'\n'} report.{Fn('binding')}(); {Cm('// on-chain add-signer')}
                {'\n'} {Kw('const')} xdr = {Fn('buildAddSignerTx')}(account.contractId, backup.publicKey);{'\n'}{' '}
                {Kw('await')} submission.{Fn('send')}({Kw('await')} {Fn('signTransaction')}(xdr, {'{ … }'}));{'\n'}{' '}
                {Kw('return')} {'{ signer: backup.credentialId }'};{'\n'} {'}'},{'\n'}
                {'}'});{'\n'}
                {Fn('mountAddDeviceScreen')}(root, {'{ flow }'});
              </code>
            ),
          },
          {
            label: 'Via Wallets Kit',
            raw: "// The current passkey signs the add-signer tx through the kit:\nimport { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';\n\nconst { signedTxXdr } = await StellarWalletsKit.signTransaction(addSignerXdr, { networkPassphrase });\nawait submission.send(signedTxXdr);",
            body: (
              <code>
                {Cm('// The current passkey signs the add-signer tx through the kit:')}
                {'\n'}
                {Kw('import')} {'{ StellarWalletsKit }'} {Kw('from')} {St("'@creit.tech/stellar-wallets-kit/sdk'")};
                {'\n\n'}
                {Kw('const')} {'{ signedTxXdr }'} = {Kw('await')} {Fn('StellarWalletsKit')}.{Fn('signTransaction')}(
                addSignerXdr, {'{ … }'});
                {'\n'}
                {Kw('await')} submission.{Fn('send')}(signedTxXdr);
              </code>
            ),
          },
        ]}
      />

      {/* ---- Funding ---- */}
      <h2 className="dx-h2" id="funding">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <PKI.IconShield size={22} /> Funding / sponsor
        </span>
      </h2>
      <p className="dx-p">
        A freshly created smart account holds 0 XLM; without this affordance the flow silently hangs — the most common
        first-run failure. So funding is an <strong>additive state inside the existing Create screen</strong> — a
        sub-state of <code>deploying</code>, plus an insufficient-balance error branch. No new screen.
      </p>
      <StateRail states={['funding', 'insufficient']} cur={cState} set={setCState} />
      <Preview>
        <Stage>
          <RealScreen screen="create" state={cState === 'insufficient' ? 'error' : 'deploying'} errorCode="NETWORK_ERROR" />
        </Stage>
      </Preview>
      <p className="dx-p dx-p--muted">
        Backed by the pluggable submission / sponsor adapter (friendbot or a sponsor). The error branch gives a clear
        next step.
      </p>

      <PageNav prev={['Recover', '/components/recover']} next={['Primitives', '/components/primitives']} />
    </DocsPage>
  );
}
