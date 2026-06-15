/* SDK reference — Recover & Connect API (@soropass/core/recover, @soropass/core/connect) */
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, FeatureGrid, I, Kw, St, Fn, Cm } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const MONO = { fontFamily: 'var(--pk-font-mono)' };

const TOC = [
  ["overview", "Overview", 0],
  ["highlights", "Highlights", 0],
  ["connect", "connect()", 0],
  ["connect-options", "ConnectOptions", 1],
  ["connect-result", "ConnectResult", 1],
  ["connect-usage", "Usage", 1],
  ["recover", "recover()", 0],
  ["recover-options", "RecoverOptions", 1],
  ["recover-result", "RecoverResult", 1],
  ["recover-usage", "Usage", 1],
  ["indexer", "IndexerAdapter", 0],
  ["flow", "Connect-then-recover", 0],
];

export default function SDKRecover() {
  return (
    <DocsPage active="Recover & Connect" toc={TOC}>
      <div className="dx-breadcrumb">SDK reference <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Recover &amp; Connect</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconShield /></span> Recover &amp; Connect API</h1>
      <p className="dx-lead">Two ways to bring a returning user back to their smart account. <code style={MONO}>connect()</code> is the silent happy path on a known device; <code style={MONO}>recover()</code> is the new-device / cleared-storage path. Both map a passkey credential to its C-address through an <code style={MONO}>IndexerAdapter</code>.</p>

      <h2 className="dx-h2" id="overview">Overview</h2>
      <p className="dx-p">The two functions ship from dedicated subpaths so a wallet only pulls in what it uses:</p>
      <CodeGroup tabs={[{
        label: 'imports',
        raw: "import { connect } from '@soropass/core/connect';\nimport { recover } from '@soropass/core/recover';",
        body: <code>{Kw("import")} {"{ connect }"} {Kw("from")} {St("'@soropass/core/connect'")};{"\n"}{Kw("import")} {"{ recover }"} {Kw("from")} {St("'@soropass/core/recover'")};</code>,
      }]} />
      <Callout kind="note">Try <code style={MONO}>connect()</code> first. When it returns <code style={MONO}>null</code> there is no stored credential or no account — fall through to <code style={MONO}>recover()</code>, which performs a discoverable get and resolves every account controlled by the credential.</Callout>
      <Callout kind="note"><code style={MONO}>@stellar/stellar-sdk</code> is a peer dependency — it is never bundled into <code style={MONO}>@soropass/core</code>. The account resolution that turns a credential into a C-address is delegated entirely to your <code style={MONO}>IndexerAdapter</code>.</Callout>

      <h2 className="dx-h2" id="highlights">Highlights</h2>
      <FeatureGrid items={[
        [<PKI.IconRefresh />, "Silent reconnect", "connect() does a best-effort mediation:'silent' liveness check where conditional mediation is available, and resolves the C-address regardless."],
        [<PKI.IconKey />, "Discoverable recovery", "recover() runs a get() with no allowCredentials, so the authenticator picks the credential — the lost-localStorage / new-device path."],
        [<PKI.IconPasskey />, "One and many accounts", "recover() returns a RecoverResult[]: a single credential can control several smart accounts, all resolved through the indexer."],
        [<PKI.IconCheckCircle />, "Degrades gracefully", "Where silent mediation is unsupported, connect() still resolves the account via the IndexerAdapter — no hard dependency on the probe."],
      ]} />

      <h2 className="dx-h2" id="connect">
        <span style={MONO}>connect()</span>
      </h2>
      <p className="dx-p">Silent reconnect using the stored credential id. Where conditional mediation is available, does a best-effort <code style={MONO}>mediation:'silent'</code> liveness check; the C-address is resolved via the <code style={MONO}>IndexerAdapter</code> regardless, so <code style={MONO}>connect</code> degrades gracefully where silent mediation is unsupported. Returns <code style={MONO}>null</code> when there is no stored credential (the caller should recover) or no account.</p>
      <CodeGroup tabs={[{
        label: 'signature',
        raw: "connect(options: ConnectOptions): Promise<ConnectResult | null>",
        body: <code>{Fn("connect")}(options: ConnectOptions): Promise&lt;ConnectResult | {Kw("null")}&gt;</code>,
      }]} />

      <h3 className="dx-h3" id="connect-options">ConnectOptions</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        [<>rpId<span className="t-req">REQ</span></>, <span className="t-type">string</span>, "Relying Party ID for the WebAuthn ceremony."],
        [<>indexer<span className="t-req">REQ</span></>, <span className="t-type">IndexerAdapter</span>, "Resolves the credential to its C-address(es)."],
        ["webauthn", <span className="t-type">WebAuthnClient</span>, "Optional WebAuthn client override (defaults to the platform navigator.credentials)."],
        ["storage", <span className="t-type">CredentialStorage</span>, "Where the stored credential id is read from."],
        ["silentMediationSupported", <span className="t-type">boolean</span>, "Override the isConditionalMediationAvailable probe."],
      ]} />

      <h3 className="dx-h3" id="connect-result">ConnectResult</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["contractId", <span className="t-type">string</span>, "The resolved smart-account C-address."],
        ["credentialId", <span className="t-type">string</span>, "The passkey credential id that controls it."],
      ]} />
      <p className="dx-p"><strong>Returns</strong> — <code style={MONO}>Promise&lt;ConnectResult | null&gt;</code>. <code style={MONO}>null</code> means no stored credential or no account; the caller should fall through to <code style={MONO}>recover()</code>.</p>

      <h3 className="dx-h3" id="connect-usage">Usage</h3>
      <CodeGroup tabs={[{
        label: 'reconnect.ts',
        raw: "import { connect } from '@soropass/core/connect';\n\nconst session = await connect({\n  rpId: 'wallet.example.com',\n  indexer,\n  storage,\n});\n\nif (session) {\n  // known device — silent reconnect succeeded\n  use(session.contractId, session.credentialId);\n} else {\n  // no stored credential or no account — fall through to recover()\n}",
        body: <code>{Kw("import")} {"{ connect }"} {Kw("from")} {St("'@soropass/core/connect'")};{"\n\n"}{Kw("const")} session = {Kw("await")} {Fn("connect")}({"{"}{"\n"}  rpId: {St("'wallet.example.com'")},{"\n"}  indexer,{"\n"}  storage,{"\n"}{"}"});{"\n\n"}{Kw("if")} (session) {"{"}{"\n"}  {Cm("// known device — silent reconnect succeeded")}{"\n"}  {Fn("use")}(session.contractId, session.credentialId);{"\n"}{"}"} {Kw("else")} {"{"}{"\n"}  {Cm("// no stored credential or no account — fall through to recover()")}{"\n"}{"}"}</code>,
      }]} />

      <h2 className="dx-h2" id="recover">
        <span style={MONO}>recover()</span>
      </h2>
      <p className="dx-p">The lost-localStorage / new-device path. Performs a discoverable-credential <code style={MONO}>get()</code> (no <code style={MONO}>allowCredentials</code>), then resolves every smart account controlled by that credential via the <code style={MONO}>IndexerAdapter</code>.</p>
      <CodeGroup tabs={[{
        label: 'signature',
        raw: "recover(options: RecoverOptions): Promise<RecoverResult[]>",
        body: <code>{Fn("recover")}(options: RecoverOptions): Promise&lt;RecoverResult[]&gt;</code>,
      }]} />

      <h3 className="dx-h3" id="recover-options">RecoverOptions</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        [<>rpId<span className="t-req">REQ</span></>, <span className="t-type">string</span>, "Relying Party ID for the WebAuthn ceremony."],
        [<>indexer<span className="t-req">REQ</span></>, <span className="t-type">IndexerAdapter</span>, "Resolves the recovered credential to its C-address(es)."],
        ["webauthn", <span className="t-type">WebAuthnClient</span>, "Optional WebAuthn client override (defaults to the platform navigator.credentials)."],
        ["challenge", <span className="t-type">Uint8Array</span>, "Optional challenge bytes for the get() ceremony."],
        ["userActivation", <span className="t-type">{'{ isActive: boolean }'}</span>, "Caller-supplied user-gesture state for the WebAuthn call."],
      ]} />

      <h3 className="dx-h3" id="recover-result">RecoverResult</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["contractId", <span className="t-type">string</span>, "A smart-account C-address controlled by the credential."],
        ["credentialId", <span className="t-type">string</span>, "The discoverable passkey credential id that was used."],
      ]} />
      <p className="dx-p"><strong>Returns</strong> — <code style={MONO}>Promise&lt;RecoverResult[]&gt;</code>. One credential can control several accounts; <code style={MONO}>recover()</code> handles both 1 and many — present a picker when the array has more than one entry.</p>

      <h3 className="dx-h3" id="recover-usage">Usage</h3>
      <CodeGroup tabs={[{
        label: 'recover.ts',
        raw: "import { recover } from '@soropass/core/recover';\n\nconst accounts = await recover({\n  rpId: 'wallet.example.com',\n  indexer,\n  userActivation: { isActive: true },\n});\n\nif (accounts.length === 1) {\n  open(accounts[0].contractId);\n} else if (accounts.length > 1) {\n  // one credential, several smart accounts — let the user choose\n  showPicker(accounts);\n}",
        body: <code>{Kw("import")} {"{ recover }"} {Kw("from")} {St("'@soropass/core/recover'")};{"\n\n"}{Kw("const")} accounts = {Kw("await")} {Fn("recover")}({"{"}{"\n"}  rpId: {St("'wallet.example.com'")},{"\n"}  indexer,{"\n"}  userActivation: {"{ isActive: "}{Kw("true")}{" }"},{"\n"}{"}"});{"\n\n"}{Kw("if")} (accounts.length === {St("1")}) {"{"}{"\n"}  {Fn("open")}(accounts[{St("0")}].contractId);{"\n"}{"}"} {Kw("else")} {Kw("if")} (accounts.length &gt; {St("1")}) {"{"}{"\n"}  {Cm("// one credential, several smart accounts — let the user choose")}{"\n"}  {Fn("showPicker")}(accounts);{"\n"}{"}"}</code>,
      }]} />

      <h2 className="dx-h2" id="indexer">
        <span style={MONO}>IndexerAdapter</span>
      </h2>
      <p className="dx-p">Both functions take an <code style={MONO}>IndexerAdapter</code> to map a credential to its C-address(es). It exposes a single method, <code style={MONO}>resolveByCredential</code>, which returns the accounts a credential controls. See <a href="/sdk/adapters">Adapters</a> for the bundled <code style={MONO}>events</code> indexer and how to write your own.</p>
      <CodeGroup tabs={[{
        label: 'IndexerAdapter',
        raw: "interface IndexerAdapter {\n  resolveByCredential(credentialId: string): Promise<ResolvedAccount[]>;\n}\n\n// ResolvedAccount = { contractId: string }",
        body: <code>{Kw("interface")} IndexerAdapter {"{"}{"\n"}  {Fn("resolveByCredential")}(credentialId: string): Promise&lt;ResolvedAccount[]&gt;;{"\n"}{"}"}{"\n\n"}{Cm("// ResolvedAccount = { contractId: string }")}</code>,
      }]} />
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["resolveByCredential", <span className="t-type">(credentialId: string) =&gt; Promise&lt;ResolvedAccount[]&gt;</span>, "Returns every account whose signer is the given credential."],
      ]} />

      <h2 className="dx-h2" id="flow">Connect-then-recover</h2>
      <p className="dx-p"><code style={MONO}>connect()</code> is the happy path on a known device — a <code style={MONO}>null</code> result falls through to <code style={MONO}>recover()</code>, the new-device / cleared-storage path. This is the idiomatic startup sequence:</p>
      <CodeGroup tabs={[{
        label: 'restore-session.ts',
        raw: "import { connect } from '@soropass/core/connect';\nimport { recover } from '@soropass/core/recover';\n\nasync function restore(rpId, indexer, storage) {\n  const session = await connect({ rpId, indexer, storage });\n  if (session) return [session];\n\n  // null -> no stored credential / no account: recover\n  return recover({ rpId, indexer, userActivation: { isActive: true } });\n}",
        body: <code>{Kw("import")} {"{ connect }"} {Kw("from")} {St("'@soropass/core/connect'")};{"\n"}{Kw("import")} {"{ recover }"} {Kw("from")} {St("'@soropass/core/recover'")};{"\n\n"}{Kw("async")} {Kw("function")} {Fn("restore")}(rpId, indexer, storage) {"{"}{"\n"}  {Kw("const")} session = {Kw("await")} {Fn("connect")}({"{ rpId, indexer, storage }"});{"\n"}  {Kw("if")} (session) {Kw("return")} [session];{"\n\n"}  {Cm("// null -> no stored credential / no account: recover")}{"\n"}  {Kw("return")} {Fn("recover")}({"{ rpId, indexer, userActivation: { isActive: "}{Kw("true")}{" } }"});{"\n"}{"}"}</code>,
      }]} />

      <PageNav prev={["Sign", "/sdk/sign"]} next={["Adapters", "/sdk/adapters"]} />
    </DocsPage>
  );
}
