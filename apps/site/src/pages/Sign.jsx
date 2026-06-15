/* Sign component page (spine, content-filled for Sign) */
import { useState } from 'react';
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, FeatureGrid, UseCases, I, Cm, Kw, St, Fn } from '../shell.jsx';
import * as PKI from '../icons.jsx';
import RealScreen from '../RealScreen.jsx';

const TOC = [["overview","Overview",0],["usecases","Use cases",0],["features","Features",0],["preview","Preview & code",0],["installation","Installation",0],["usage","Usage",0],["states","States",0],["props","Props",1],["tx","TxSummaryData",1],["copy","Copy",1],["a11y","Accessibility",0],["theming","Theming",0],["kit","In Wallets Kit",0]];
const STATES = ["idle", "prompting", "submitting", "done", "error"];
const ERR = [["sign:cancelled","USER_CANCELLED"],["sign:unsupported","UNSUPPORTED_AUTHENTICATOR"],["sign:verify","CHALLENGE_MISMATCH"],["sign:network","NETWORK_ERROR"],["sign:signature","INVALID_SIGNATURE_DER"]];

function Gallery() {
  const [si, setSi] = useState(0);
  const [err, setErr] = useState("sign:verify");
  const cur = STATES[si];
  return (
    <div className="dx-tabs dx-gallery">
      <div className="dx-tabs__bar" style={{ justifyContent: "space-between", alignItems: "center", paddingInlineEnd: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 0" }}>{STATES.map((s, i) => <button key={s} className="lp-statepill" aria-pressed={i === si} onClick={() => setSi(i)}>{s}</button>)}</div>
        {cur === "error" && <select className="lp-select" style={{ width: "auto", minWidth: 220 }} value={err} onChange={(e) => setErr(e.target.value)}>{ERR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
      </div>
      <div className="dx-tabs__preview pk"><RealScreen screen="sign" state={cur} errorCode={err} /></div>
    </div>
  );
}
function HeroPreview() {
  const [tab, setTab] = useState("preview");
  const [si, setSi] = useState(0);
  return (
    <div className="dx-tabs">
      <div className="dx-tabs__bar" role="tablist">
        <button role="tab" aria-selected={tab === "preview"} className="dx-tabs__tab" onClick={() => setTab("preview")}>Preview</button>
        <button role="tab" aria-selected={tab === "code"} className="dx-tabs__tab" onClick={() => setTab("code")}>Code</button>
      </div>
      {tab === "preview" ? (
        <>
          <div className="dx-tabs__preview pk"><RealScreen screen="sign" state={STATES[si]} /></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "0 16px 18px", flexWrap: "wrap", background: "var(--pk-color-background)" }}>{STATES.map((s, i) => <button key={s} className="lp-statepill" aria-pressed={i === si} onClick={() => setSi(i)}>{s}</button>)}</div>
        </>
      ) : (
        <CodeGroup tabs={[
          { label: "Standalone", raw: "mountSignScreen(root, { flow, tx, onDone });", body: <code>{Fn("mountSignScreen")}(root, {"{ flow, tx, onDone }"});</code> },
          { label: "Via Wallets Kit", raw: "const res = await StellarWalletsKit.signTransaction(txXdr, { networkPassphrase });", body: <code>{Kw("const")} res = {Kw("await")} {Fn("StellarWalletsKit")}.{Fn("signTransaction")}(txXdr, {"{ networkPassphrase }"});</code> },
        ]} />
      )}
    </div>
  );
}

export default function Sign() {
  return (
    <DocsPage active="Sign" toc={TOC}>
      <div className="dx-breadcrumb">Components <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Sign</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconShield /></span> Sign</h1>
      <p className="dx-lead">Approve a specific transaction with the passkey. The summary is supplied by the host app — amount, destination, and a function name — and stays legible as it moves into the OS-sheet wait.</p>

      <h2 className="dx-h2" id="overview">Overview</h2>
      <p className="dx-p">Five states. The transaction summary card is a pure prop — the component never reads tx details from inside itself, so any wallet can drive it.</p>
      <Callout kind="note">The trigger click is the WebAuthn gesture. <code>prompting</code> dims the summary behind a calm opaque scrim (no spinner); <code>submitting</code> shows a spinner + progress because we're working.</Callout>

      <h2 className="dx-h2" id="usecases">Use cases</h2>
      <UseCases items={[
        ["Approving a payment or swap", "The host app builds a transaction and hands Sign the amount, destination, and action. The user reviews the summary and approves with one biometric prompt."],
        ["Confirming a contract call in a dApp", "Show exactly what a user is authorizing — the function name renders as a tag — before the passkey signs the SorobanAuthorizationEntry."],
        ["Drop-in replacement for a sign modal", "Wired through the kit, Sign becomes the approval surface for any transaction your wallet already routes through signTransaction."],
      ]} />

      <h2 className="dx-h2" id="features">Features</h2>
      <FeatureGrid items={[
        [<PKI.IconShield />, "Host-supplied summary", "Amount, destination, and action are pure props — the component never reads tx details from inside itself, so any wallet can drive it."],
        [<PKI.IconPasskey />, "Summary stays legible", "The transaction card remains visible as it dims behind the calm OS-sheet scrim, so users always see what they're approving."],
        [<PKI.IconExternal />, "Explorer link on done", "Success shows the transaction hash as a copyable row with a one-tap link to the block explorer."],
        [<PKI.IconAlert />, "One error layout", "Verification, signature, and network failures all render through the single error view, copy swapped by KitError code."],
        [<PKI.IconRefresh />, "Clear submit state", "A spinner + indeterminate progress while the signed transaction is submitted to the network."],
        [<PKI.IconCheckCircle />, "Accessible by default", "Polite / assertive live regions, focus management on terminal states, full keyboard order, RTL and reduced-motion."],
      ]} />

      <h2 className="dx-h2" id="preview">Preview &amp; code</h2>
      <HeroPreview />

      <h2 className="dx-h2" id="installation">Installation</h2>
      <CodeGroup tabs={[{ label: "pnpm", raw: "pnpm add @soropass/ui @soropass/core", body: <code>pnpm add @soropass/ui @soropass/core</code> }]} />

      <h2 className="dx-h2" id="usage">Usage</h2>
      <p className="dx-p">Pass the host-built transaction summary and handle the result. <code>handle.unmount()</code> tears it down.</p>
      <CodeGroup tabs={[{ label: "checkout.ts", raw: "import { mountSignScreen } from '@soropass/ui/styled';\n\nconst handle = mountSignScreen(document.querySelector('#approve'), {\n  flow,\n  tx: {\n    amountValue: '250.00 USDC',\n    amountFiat: '≈ $250.00',\n    destination: order.recipient,\n    action: 'transfer',\n  },\n  onDone(result) {\n    toast(`Sent · ${result.hash}`);\n    handle.unmount();\n  },\n  onCancel() { handle.unmount(); },\n});",
        body: <code>{Kw("import")} {"{ mountSignScreen }"} {Kw("from")} {St("'@soropass/ui/styled'")};{"\n\n"}{Kw("const")} handle = {Fn("mountSignScreen")}(document.{Fn("querySelector")}({St("'#approve'")}), {"{"}{"\n"}  flow,{"\n"}  tx: {"{"}{"\n"}    amountValue: {St("'250.00 USDC'")},{"\n"}    amountFiat: {St("'≈ $250.00'")},{"\n"}    destination: order.recipient,{"\n"}    action: {St("'transfer'")},{"\n"}  {"}"},{"\n"}  {Fn("onDone")}(result) {"{"}{"\n"}    {Fn("toast")}(`Sent · ${"{"}result.hash{"}"}`);{"\n"}    handle.{Fn("unmount")}();{"\n"}  {"}"},{"\n"}  {Fn("onCancel")}() {"{"} handle.{Fn("unmount")}(); {"}"},{"\n"}{"}"});</code> }]} />

      <h2 className="dx-h2" id="states">States</h2>
      <Gallery />

      <h2 className="dx-h2" id="props">Props</h2>
      <PropsTable cols={["Prop", "Type", "Default", "Description"]} rows={[
        [<>flow<span className="t-req">REQ</span></>, <span className="t-type">SignFlow</span>, <span className="t-def">—</span>, "Headless sign controller."],
        [<>tx<span className="t-req">REQ</span></>, <span className="t-type">TxSummaryData</span>, <span className="t-def">—</span>, "Host-supplied summary (see below)."],
        ["copy", <span className="t-type">Partial&lt;SignCopy&gt;</span>, <span className="t-def">DEFAULT_SIGN_COPY</span>, "i18n / brand voice."],
        ["onCancel", <span className="t-type">() =&gt; void</span>, <span className="t-def">undefined</span>, "Secondary action on idle."],
        ["onDone", <span className="t-type">(r: SubmitResult) =&gt; void</span>, <span className="t-def">undefined</span>, "Fires on the done screen."],
        ["onExplorer", <span className="t-type">(hash: string) =&gt; void</span>, <span className="t-def">undefined</span>, "Explorer link click."],
      ]} />
      <h3 className="dx-h3" id="tx">TxSummaryData</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["amountValue", <span className="t-type">string</span>, "e.g. “250.00 USDC” (host-formatted)."],
        ["amountFiat", <span className="t-type">string?</span>, "Optional secondary line."],
        ["destination", <span className="t-type">string</span>, "Address; middle-truncated in the UI."],
        ["action", <span className="t-type">string</span>, "Function / action name (rendered as a tag)."],
      ]} />
      <h3 className="dx-h3" id="copy">Copy (i18n)</h3>
      <PropsTable cols={["Key", "Default string"]} rows={[["idleTitle", "Approve transaction"], ["signLabel", "Sign"], ["submittingTitle", "Submitting transaction…"], ["doneTitle", "Transaction sent"]]} />

      <h2 className="dx-h2" id="a11y">Accessibility</h2>
      <FeatureGrid items={[
        [<PKI.IconCheckCircle />, "Announced status", "Polite role=status for prompting / submitting; assertive role=alert for the error view."],
        [<PKI.IconArrowLeft />, "Focus management", "Focus moves to the status paragraph on done / error (tabIndex=-1, preventScroll)."],
        [<PKI.IconKey />, "Keyboard & focus ring", "Cancel / Sign form a logical Tab order, each with a visible focus ring."],
        [<PKI.IconRefresh />, "RTL & reduced-motion", "Mirrors via CSS logical properties; a reduced-motion variant freezes pulses and spins."],
      ]} />

      <h2 className="dx-h2" id="theming">Theming hooks</h2>
      <PropsTable cols={["Area", "Tokens"]} rows={[
        ["summary", <span className="t-type">--pk-color-surface-sunken, --pk-radius-md, --pk-space-*</span>],
        ["WaitOverlay", <span className="t-type">--pk-scrim, --pk-busy-opacity, --pk-pulse-duration</span>],
        ["submitting", <span className="t-type">--pk-spinner-*, --pk-progress-*</span>],
        ["done", <span className="t-type">--pk-color-success / -soft</span>],
      ]} />

      <h2 className="dx-h2" id="kit">In Stellar Wallets Kit</h2>
      <CodeGroup tabs={[{ label: "Wallets Kit", raw: "// Sign seam → SignFlow\nconst res = await StellarWalletsKit.signTransaction(txXdr, { networkPassphrase });", body: <code>{Cm("// Sign seam → SignFlow")}{"\n"}{Kw("const")} res = {Kw("await")} {Fn("StellarWalletsKit")}.{Fn("signTransaction")}(txXdr, {"{ networkPassphrase }"});</code> }]} />

      <PageNav prev={["Create", "/components/create"]} next={["Recover", "/components/recover"]} />
    </DocsPage>
  );
}
