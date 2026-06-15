/* SDK reference — Adapters (submission + indexer seams) */
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, FeatureGrid, I, Kw, St, Fn, Cm } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const MONO = { fontFamily: 'var(--pk-font-mono)' };

const TOC = [
  ["overview", "Overview", 0],
  ["interfaces", "Interfaces", 0],
  ["submission", "SubmissionAdapter", 1],
  ["submitresult", "SubmitResult", 1],
  ["indexer", "IndexerAdapter", 1],
  ["submission-adapters", "Submission adapters", 0],
  ["direct", "directSubmission", 1],
  ["launchtube", "launchtubeSubmission", 1],
  ["ozrelayer", "openzeppelinRelayerSubmission", 1],
  ["indexer-adapters", "Indexer adapters", 0],
  ["events", "eventsIndexer", 1],
  ["mercury", "mercuryIndexer", 1],
  ["defaults", "defaultAdapters", 0],
  ["invariant", "Invariant #4", 0],
];

export default function SDKAdapters() {
  return (
    <DocsPage active="Adapters" toc={TOC}>
      <div className="dx-breadcrumb">SDK reference <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Adapters</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconShield /></span> Adapters</h1>
      <p className="dx-lead">Two pluggable seams, both small interfaces. The zero-infra default is direct submission + an events indexer; nothing else is required. Swapping either is a one-line config change — no hard coupling to any relayer or indexer.</p>

      <h2 className="dx-h2" id="overview">Overview</h2>
      <p className="dx-p">A submission adapter takes a signed transaction XDR to the network; an indexer adapter maps a passkey credential back to its C-address. <code>@soropass/core</code> ships both seams from the package root and never bundles <code>@stellar/stellar-sdk</code> — it stays a peer dependency.</p>
      <FeatureGrid items={[
        [<PKI.IconShield />, "Zero-infra default", "directSubmission + eventsIndexer need only an RPC URL and a factoryContractId — no relayer, no indexer service, no account."],
        [<PKI.IconRefresh />, "One-line swap", "Every submission factory returns SubmissionAdapter and every indexer factory returns IndexerAdapter, so the call site never changes."],
        [<PKI.IconKey />, "No hard coupling", "Launchtube, OZ Relayer, and Mercury are optional adapters behind the same interfaces — the SDK never requires any of them."],
      ]} />

      <h2 className="dx-h2" id="interfaces">Interfaces</h2>
      <p className="dx-p">Both seams are deliberately small. Implement these two interfaces and any backend slots in.</p>

      <h3 className="dx-h3" id="submission" style={MONO}>SubmissionAdapter</h3>
      <p className="dx-p">Sends a signed transaction XDR and resolves to a <code>SubmitResult</code>.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "interface SubmissionAdapter {\n  send(signedTxXdr: string): Promise<SubmitResult>;\n}",
        body: <code>{Kw("interface")} {Fn("SubmissionAdapter")} {"{"}{"\n"}  {Fn("send")}(signedTxXdr: {Kw("string")}): {Fn("Promise")}&lt;{Fn("SubmitResult")}&gt;;{"\n"}{"}"}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["signedTxXdr", <span className="t-type">string</span>, "The fully signed transaction, base64 XDR."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>Promise&lt;SubmitResult&gt;</code> — the outcome of submission (see below).</p>

      <h3 className="dx-h3" id="submitresult" style={MONO}>SubmitResult</h3>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "interface SubmitResult {\n  status: 'SUCCESS' | 'PENDING' | 'FAILED';\n  hash: string;\n  returnValue?: unknown;     // decoded contract return value on success\n  errorResultXdr?: string;   // base64 XDR of the failure result when failed\n}",
        body: <code>{Kw("interface")} {Fn("SubmitResult")} {"{"}{"\n"}  status: {St("'SUCCESS'")} | {St("'PENDING'")} | {St("'FAILED'")};{"\n"}  hash: {Kw("string")};{"\n"}  returnValue?: {Kw("unknown")};{"     "}{Cm("// decoded contract return value on success")}{"\n"}  errorResultXdr?: {Kw("string")};{"   "}{Cm("// base64 XDR of the failure result when failed")}{"\n"}{"}"}</code>,
      }]} />
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["status", <span className="t-type">'SUCCESS' | 'PENDING' | 'FAILED'</span>, "Terminal or in-flight state of the submission."],
        ["hash", <span className="t-type">string</span>, "Transaction hash."],
        ["returnValue", <span className="t-type">unknown?</span>, "Decoded contract return value on success (implementation-defined)."],
        ["errorResultXdr", <span className="t-type">string?</span>, "Base64 XDR of the failure result, present when status is 'FAILED'."],
      ]} />

      <h3 className="dx-h3" id="indexer" style={MONO}>IndexerAdapter</h3>
      <p className="dx-p">Resolves the smart-account C-address(es) controlled by a passkey credential.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "interface IndexerAdapter {\n  resolveByCredential(credentialId: string): Promise<ResolvedAccount[]>;\n}\n\n// ResolvedAccount = { contractId: string }",
        body: <code>{Kw("interface")} {Fn("IndexerAdapter")} {"{"}{"\n"}  {Fn("resolveByCredential")}(credentialId: {Kw("string")}): {Fn("Promise")}&lt;{Fn("ResolvedAccount")}[]&gt;;{"\n"}{"}"}{"\n\n"}{Cm("// ResolvedAccount = { contractId: string }")}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["credentialId", <span className="t-type">string</span>, "The passkey credential id to resolve."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>Promise&lt;ResolvedAccount[]&gt;</code> where <code>ResolvedAccount = {'{ contractId: string }'}</code>.</p>

      <h2 className="dx-h2" id="submission-adapters">Submission adapters</h2>
      <p className="dx-p">All three return <code>SubmissionAdapter</code>, so swapping one for another is a one-line config change.</p>

      <h3 className="dx-h3" id="direct" style={MONO}>directSubmission</h3>
      <p className="dx-p">Zero-infra default; sends straight to soroban-rpc.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "directSubmission(options: DirectSubmissionOptions): SubmissionAdapter",
        body: <code>{Fn("directSubmission")}(options: {Fn("DirectSubmissionOptions")}): {Fn("SubmissionAdapter")}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["options", <span className="t-type">DirectSubmissionOptions</span>, "Direct soroban-rpc submission options (rpcUrl + networkPassphrase)."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>SubmissionAdapter</code> that sends straight to soroban-rpc.</p>
      <CodeGroup tabs={[{
        label: "usage",
        raw: "import { directSubmission } from '@soropass/core';\nimport { Networks } from '@stellar/stellar-sdk';\n\nconst submission = directSubmission({\n  rpcUrl: 'https://soroban-testnet.stellar.org',\n  networkPassphrase: Networks.TESTNET,\n});\nconst res = await submission.send(signedTxXdr);\nif (res.status === 'SUCCESS') console.log(res.hash);\nif (res.status === 'FAILED') console.error(res.errorResultXdr);",
        body: <code>{Kw("import")} {"{ directSubmission }"} {Kw("from")} {St("'@soropass/core'")};{"\n"}{Kw("import")} {"{ Networks }"} {Kw("from")} {St("'@stellar/stellar-sdk'")};{"\n\n"}{Kw("const")} submission = {Fn("directSubmission")}({"{"}{"\n"}  rpcUrl: {St("'https://soroban-testnet.stellar.org'")},{"\n"}  networkPassphrase: Networks.TESTNET,{"\n"}{"}"});{"\n"}{Kw("const")} res = {Kw("await")} submission.{Fn("send")}(signedTxXdr);{"\n"}{Kw("if")} (res.status === {St("'SUCCESS'")}) console.{Fn("log")}(res.hash);{"\n"}{Kw("if")} (res.status === {St("'FAILED'")}) console.{Fn("error")}(res.errorResultXdr);</code>,
      }]} />

      <h3 className="dx-h3" id="launchtube" style={MONO}>launchtubeSubmission</h3>
      <p className="dx-p">Legacy relay (Launchtube) — modeled as one optional adapter.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "launchtubeSubmission(options: LaunchtubeSubmissionOptions): SubmissionAdapter",
        body: <code>{Fn("launchtubeSubmission")}(options: {Fn("LaunchtubeSubmissionOptions")}): {Fn("SubmissionAdapter")}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["options", <span className="t-type">LaunchtubeSubmissionOptions</span>, "Launchtube relay options."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>SubmissionAdapter</code> backed by the Launchtube relay.</p>
      <CodeGroup tabs={[{
        label: "usage",
        raw: "import { launchtubeSubmission } from '@soropass/core';\n\nconst submission = launchtubeSubmission({ /* LaunchtubeSubmissionOptions */ });\nconst res = await submission.send(signedTxXdr);",
        body: <code>{Kw("import")} {"{ launchtubeSubmission }"} {Kw("from")} {St("'@soropass/core'")};{"\n\n"}{Kw("const")} submission = {Fn("launchtubeSubmission")}({"{ "}{Cm("/* LaunchtubeSubmissionOptions */")}{" }"});{"\n"}{Kw("const")} res = {Kw("await")} submission.{Fn("send")}(signedTxXdr);</code>,
      }]} />

      <h3 className="dx-h3" id="ozrelayer" style={MONO}>openzeppelinRelayerSubmission</h3>
      <p className="dx-p">OZ Relayer / Defender — the post-Launchtube direction.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "openzeppelinRelayerSubmission(options: OpenZeppelinRelayerOptions): SubmissionAdapter",
        body: <code>{Fn("openzeppelinRelayerSubmission")}(options: {Fn("OpenZeppelinRelayerOptions")}): {Fn("SubmissionAdapter")}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["options", <span className="t-type">OpenZeppelinRelayerOptions</span>, "OZ Relayer / Defender options."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>SubmissionAdapter</code> backed by the OZ Relayer / Defender.</p>
      <CodeGroup tabs={[{
        label: "usage",
        raw: "import { openzeppelinRelayerSubmission } from '@soropass/core';\n\nconst submission = openzeppelinRelayerSubmission({ /* OpenZeppelinRelayerOptions */ });\nconst res = await submission.send(signedTxXdr);",
        body: <code>{Kw("import")} {"{ openzeppelinRelayerSubmission }"} {Kw("from")} {St("'@soropass/core'")};{"\n\n"}{Kw("const")} submission = {Fn("openzeppelinRelayerSubmission")}({"{ "}{Cm("/* OpenZeppelinRelayerOptions */")}{" }"});{"\n"}{Kw("const")} res = {Kw("await")} submission.{Fn("send")}(signedTxXdr);</code>,
      }]} />

      <h2 className="dx-h2" id="indexer-adapters">Indexer adapters</h2>
      <p className="dx-p">Both return <code>IndexerAdapter</code> and map a credential to its C-address.</p>

      <h3 className="dx-h3" id="events" style={MONO}>eventsIndexer</h3>
      <p className="dx-p">Zero-infra default; reads on-chain contract events (just an RPC URL + factory contract id).</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "eventsIndexer(options: EventsIndexerOptions): IndexerAdapter",
        body: <code>{Fn("eventsIndexer")}(options: {Fn("EventsIndexerOptions")}): {Fn("IndexerAdapter")}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["options", <span className="t-type">EventsIndexerOptions</span>, "On-chain events options (an RPC URL + factoryContractId)."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>IndexerAdapter</code> that reads on-chain contract events.</p>
      <CodeGroup tabs={[{
        label: "usage",
        raw: "import { eventsIndexer } from '@soropass/core';\n\nconst indexer = eventsIndexer({\n  rpcUrl: 'https://soroban-testnet.stellar.org',\n  factoryContractId: 'C...FACTORY',\n});\nconst accounts = await indexer.resolveByCredential(credentialId);\nconsole.log(accounts.map((a) => a.contractId));",
        body: <code>{Kw("import")} {"{ eventsIndexer }"} {Kw("from")} {St("'@soropass/core'")};{"\n\n"}{Kw("const")} indexer = {Fn("eventsIndexer")}({"{"}{"\n"}  rpcUrl: {St("'https://soroban-testnet.stellar.org'")},{"\n"}  factoryContractId: {St("'C...FACTORY'")},{"\n"}{"}"});{"\n"}{Kw("const")} accounts = {Kw("await")} indexer.{Fn("resolveByCredential")}(credentialId);{"\n"}console.{Fn("log")}(accounts.{Fn("map")}((a) =&gt; a.contractId));</code>,
      }]} />

      <h3 className="dx-h3" id="mercury" style={MONO}>mercuryIndexer</h3>
      <p className="dx-p">Optional Mercury index; the SDK never requires Mercury.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "mercuryIndexer(options: MercuryIndexerOptions): IndexerAdapter",
        body: <code>{Fn("mercuryIndexer")}(options: {Fn("MercuryIndexerOptions")}): {Fn("IndexerAdapter")}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["options", <span className="t-type">MercuryIndexerOptions</span>, "Mercury index options (optional)."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>IndexerAdapter</code> backed by a Mercury index.</p>
      <Callout kind="note">Mercury is strictly optional. The default <code>eventsIndexer</code> covers credential → C-address resolution with no external index service.</Callout>
      <CodeGroup tabs={[{
        label: "usage",
        raw: "import { mercuryIndexer } from '@soropass/core';\n\nconst indexer = mercuryIndexer({ /* MercuryIndexerOptions */ });\nconst accounts = await indexer.resolveByCredential(credentialId);",
        body: <code>{Kw("import")} {"{ mercuryIndexer }"} {Kw("from")} {St("'@soropass/core'")};{"\n\n"}{Kw("const")} indexer = {Fn("mercuryIndexer")}({"{ "}{Cm("/* MercuryIndexerOptions */")}{" }"});{"\n"}{Kw("const")} accounts = {Kw("await")} indexer.{Fn("resolveByCredential")}(credentialId);</code>,
      }]} />

      <h2 className="dx-h2" id="defaults">defaultAdapters</h2>
      <p className="dx-p">The zero-infra default stack: direct + events. Returns both seams pre-wired.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "defaultAdapters(options: DefaultAdapterOptions): { submission: SubmissionAdapter; indexer: IndexerAdapter }",
        body: <code>{Fn("defaultAdapters")}(options: {Fn("DefaultAdapterOptions")}): {"{"} submission: {Fn("SubmissionAdapter")}; indexer: {Fn("IndexerAdapter")} {"}"}</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["options", <span className="t-type">DefaultAdapterOptions</span>, "Options for the default direct + events stack (rpcUrl + networkPassphrase + factoryContractId)."],
      ]} />
      <p className="dx-p"><b>Returns</b> <code>{'{ submission: SubmissionAdapter; indexer: IndexerAdapter }'}</code> — the zero-infra default stack (direct submission + events indexer).</p>
      <CodeGroup tabs={[{
        label: "usage",
        raw: "import { defaultAdapters } from '@soropass/core';\nimport { Networks } from '@stellar/stellar-sdk';\n\nconst { submission, indexer } = defaultAdapters({\n  rpcUrl: 'https://soroban-testnet.stellar.org',\n  networkPassphrase: Networks.TESTNET,\n  factoryContractId: 'C...FACTORY',\n});\n\n// later\nconst accounts = await indexer.resolveByCredential(credentialId);\nconst res = await submission.send(signedTxXdr);",
        body: <code>{Kw("import")} {"{ defaultAdapters }"} {Kw("from")} {St("'@soropass/core'")};{"\n"}{Kw("import")} {"{ Networks }"} {Kw("from")} {St("'@stellar/stellar-sdk'")};{"\n\n"}{Kw("const")} {"{ submission, indexer }"} = {Fn("defaultAdapters")}({"{"}{"\n"}  rpcUrl: {St("'https://soroban-testnet.stellar.org'")},{"\n"}  networkPassphrase: Networks.TESTNET,{"\n"}  factoryContractId: {St("'C...FACTORY'")},{"\n"}{"}"});{"\n\n"}{Cm("// later")}{"\n"}{Kw("const")} accounts = {Kw("await")} indexer.{Fn("resolveByCredential")}(credentialId);{"\n"}{Kw("const")} res = {Kw("await")} submission.{Fn("send")}(signedTxXdr);</code>,
      }]} />

      <h2 className="dx-h2" id="invariant">Invariant #4 — pluggable, zero-infra by default</h2>
      <Callout kind="note">Pluggable adapters for submission + indexer; the default is zero-infra (direct + events). No hard coupling to any relayer or indexer.</Callout>
      <p className="dx-p">Because every factory returns the same interface, you can start on the zero-infra default and move to Launchtube, the OZ Relayer, or Mercury later without touching call sites. <code>@stellar/stellar-sdk</code> remains a peer dependency and is never bundled into <code>@soropass/core</code>.</p>

      <PageNav prev={["Recover & Connect", "/sdk/recover"]} next={["KitError taxonomy", "/sdk/errors"]} />
    </DocsPage>
  );
}
