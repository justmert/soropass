/* Recover component page (spine, content-filled for Recover) */
import { useState } from 'react';
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, FeatureGrid, UseCases, I, Cm, Kw, St, Fn } from '../shell.jsx';
import * as PKI from '../icons.jsx';
import RealScreen from '../RealScreen.jsx';

const TOC = [["overview","Overview",0],["usecases","Use cases",0],["features","Features",0],["preview","Preview & code",0],["installation","Installation",0],["usage","Usage",0],["states","States",0],["props","Props",1],["copy","Copy",1],["a11y","Accessibility",0],["theming","Theming",0],["kit","In Wallets Kit",0]];
const STATES = ["idle", "discovering", "resolved", "selected", "none", "error"];
const ERR = [["recover:cancelled","USER_CANCELLED"],["recover:unsupported","UNSUPPORTED_AUTHENTICATOR"],["recover:network","NETWORK_ERROR"]];

function Gallery() {
  const [si, setSi] = useState(0);
  const [err, setErr] = useState("recover:network");
  const [n, setN] = useState(3);
  const cur = STATES[si];
  return (
    <div className="dx-tabs dx-gallery">
      <div className="dx-tabs__bar" style={{ justifyContent: "space-between", alignItems: "center", paddingInlineEnd: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 0" }}>{STATES.map((s, i) => <button key={s} className="lp-statepill" aria-pressed={i === si} onClick={() => setSi(i)}>{s}</button>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(cur === "resolved" || cur === "selected") && <select className="lp-select" style={{ width: "auto" }} value={n} onChange={(e) => setN(+e.target.value)}><option value={3}>3 accts</option><option value={1}>1 acct</option></select>}
          {cur === "error" && <select className="lp-select" style={{ width: "auto", minWidth: 200 }} value={err} onChange={(e) => setErr(e.target.value)}>{ERR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
        </div>
      </div>
      <div className="dx-tabs__preview pk"><RealScreen screen="recover" state={cur} errorCode={err} accounts={n} selectedIndex={1} /></div>
    </div>
  );
}
function HeroPreview() {
  const [tab, setTab] = useState("preview");
  const [si, setSi] = useState(2);
  return (
    <div className="dx-tabs">
      <div className="dx-tabs__bar" role="tablist">
        <button role="tab" aria-selected={tab === "preview"} className="dx-tabs__tab" onClick={() => setTab("preview")}>Preview</button>
        <button role="tab" aria-selected={tab === "code"} className="dx-tabs__tab" onClick={() => setTab("code")}>Code</button>
      </div>
      {tab === "preview" ? (
        <>
          <div className="dx-tabs__preview pk"><RealScreen screen="recover" state={STATES[si]} selectedIndex={1} /></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "0 16px 18px", flexWrap: "wrap", background: "var(--pk-color-background)" }}>{STATES.map((s, i) => <button key={s} className="lp-statepill" aria-pressed={i === si} onClick={() => setSi(i)}>{s}</button>)}</div>
        </>
      ) : (
        <CodeGroup tabs={[
          { label: "Standalone", raw: "mountRecoverScreen(root, { flow, onContinue });", body: <code>{Fn("mountRecoverScreen")}(root, {"{ flow, onContinue }"});</code> },
          { label: "Via Wallets Kit", raw: "const accounts = await recover({ rpId, indexer });", body: <code>{Kw("const")} accounts = {Kw("await")} {Fn("recover")}({"{ rpId, indexer }"});</code> },
        ]} />
      )}
    </div>
  );
}

export default function Recover() {
  return (
    <DocsPage active="Recover" toc={TOC}>
      <div className="dx-breadcrumb">Components <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Recover</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconKey /></span> Recover</h1>
      <p className="dx-lead">Return on a new device and find the accounts a passkey controls — no seed phrase. A proper listbox with a full keyboard pattern, handling the one-account and many-accounts cases.</p>

      <h2 className="dx-h2" id="overview">Overview</h2>
      <p className="dx-p">Six states. The resolved list is a real <code>role="listbox"</code> with roving focus. This is <strong>discover-only</strong> — to enroll a new credential, see <a href="/components/connect">Add backup passkey</a>.</p>
      <Callout kind="note"><code>discovering</code> shows the calm OS-sheet wait. On <code>resolved</code>, focus lands on the first account row.</Callout>

      <h2 className="dx-h2" id="usecases">Use cases</h2>
      <UseCases items={[
        ["Signing in on a new device", "A returning user installs your wallet on a new phone. Recover finds the smart accounts their passkey already controls — no seed phrase, no manual import."],
        ["Restoring after cleared storage", "Local data is gone but the passkey lives in the platform keychain. Recover re-discovers the user's accounts from the credential alone."],
        ["Choosing between multiple accounts", "When one passkey controls several accounts, the resolved listbox lets the user pick the right one with a full keyboard pattern."],
      ]} />

      <h2 className="dx-h2" id="features">Features</h2>
      <FeatureGrid items={[
        [<PKI.IconKey />, "Real listbox semantics", "role=listbox with roving focus — Up/Down wrap, Home/End jump, Enter/Space select. Built to the APG pattern, not a styled div."],
        [<PKI.IconPasskey />, "1 and many, gracefully", "A single account skips straight to selected; multiple accounts render a scannable, selectable list."],
        [<PKI.IconCopy />, "Self-describing rows", "Each row pairs a deterministic identicon with a middle-truncated address and an optional meta line you supply."],
        [<PKI.IconPlus />, "Helpful empty state", "When nothing is found, the none state routes the user to create a brand-new passkey instead."],
        [<PKI.IconShield />, "Calm OS-sheet wait", "discovering shows the opaque scrim + pulsing glyph while the native sheet resolves the credential."],
        [<PKI.IconAlert />, "One error layout", "Cancelled, unsupported, and network failures share the single error view, copy swapped by KitError code."],
      ]} />

      <h2 className="dx-h2" id="preview">Preview &amp; code</h2>
      <HeroPreview />

      <h2 className="dx-h2" id="installation">Installation</h2>
      <CodeGroup tabs={[{ label: "pnpm", raw: "pnpm add @soropass/ui @soropass/core", body: <code>pnpm add @soropass/ui @soropass/core</code> }]} />

      <h2 className="dx-h2" id="usage">Usage</h2>
      <p className="dx-p">Mount on the new device's sign-in surface; supply a per-row meta line and handle the chosen account.</p>
      <CodeGroup tabs={[{ label: "signin.ts", raw: "import { mountRecoverScreen } from '@soropass/ui/styled';\n\nconst handle = mountRecoverScreen(document.querySelector('#signin'), {\n  flow,\n  accountMeta: (account) => `Last used ${account.lastUsed}`,\n  onContinue(account) {\n    session.use(account.address);\n    handle.unmount();\n  },\n  onCreateNew() { router.push('/create'); },\n});",
        body: <code>{Kw("import")} {"{ mountRecoverScreen }"} {Kw("from")} {St("'@soropass/ui/styled'")};{"\n\n"}{Kw("const")} handle = {Fn("mountRecoverScreen")}(document.{Fn("querySelector")}({St("'#signin'")}), {"{"}{"\n"}  flow,{"\n"}  accountMeta: (account) =&gt; {St("`Last used ${account.lastUsed}`")},{"\n"}  {Fn("onContinue")}(account) {"{"}{"\n"}    session.{Fn("use")}(account.address);{"\n"}    handle.{Fn("unmount")}();{"\n"}  {"}"},{"\n"}  {Fn("onCreateNew")}() {"{"} router.{Fn("push")}({St("'/create'")}); {"}"},{"\n"}{"}"});</code> }]} />

      <h2 className="dx-h2" id="states">States</h2>
      <Gallery />
      <Callout kind="note"><strong>none</strong> is the empty state — “No accounts found” + a “Create a new passkey instead” call-to-action.</Callout>

      <h2 className="dx-h2" id="props">Props</h2>
      <PropsTable cols={["Prop", "Type", "Default", "Description"]} rows={[
        [<>flow<span className="t-req">REQ</span></>, <span className="t-type">RecoverFlow</span>, <span className="t-def">—</span>, "Headless discovery controller."],
        ["copy", <span className="t-type">Partial&lt;RecoverCopy&gt;</span>, <span className="t-def">DEFAULT_RECOVER_COPY</span>, "i18n / brand voice."],
        ["accountMeta", <span className="t-type">(a, i) =&gt; string</span>, <span className="t-def">undefined</span>, "Secondary line per row."],
        ["onContinue", <span className="t-type">(a: Account) =&gt; void</span>, <span className="t-def">undefined</span>, "Selected account confirmed."],
        ["onCreateNew", <span className="t-type">() =&gt; void</span>, <span className="t-def">undefined</span>, "Empty-state CTA."],
      ]} />
      <h3 className="dx-h3" id="copy">Copy (i18n)</h3>
      <PropsTable cols={["Key", "Default string"]} rows={[["idleTitle", "Find your account"], ["recoverLabel", "Recover"], ["manyTitle(count)", "{count} accounts found  — a function"], ["noneTitle", "No accounts found"]]} />

      <h2 className="dx-h2" id="a11y">Accessibility</h2>
      <p className="dx-p dx-p--muted">The resolved list is an APG-pattern listbox.</p>
      <PropsTable cols={["Key", "Action"]} rows={[
        ["↑ / ↓", "Move active option (wraps)"],
        ["Home / End", "First / last option"],
        ["Enter / Space", "Choose the active option"],
        ["Tab", "Roving tabindex — only the active row is in the tab order"],
      ]} />
      <ul className="dx-features" style={{ gridTemplateColumns: "1fr", listStyle: "none", padding: 0 }}>{["aria-selected + check on the chosen row; visible focus ring on the active row.", "On resolved, focus lands on the first account; on error, the status paragraph.", "RTL via logical properties; reduced-motion variant included."].map((a) => <li key={a} style={{ display: "flex", gap: 10, marginBottom: 8 }}><I.Ok /> {a}</li>)}</ul>

      <h2 className="dx-h2" id="theming">Theming hooks</h2>
      <PropsTable cols={["Area", "Tokens"]} rows={[
        ["listbox row", <span className="t-type">--pk-color-surface, --pk-color-border, --pk-radius-md</span>],
        ["selected row", <span className="t-type">--pk-color-brand, --pk-color-brand-soft</span>],
        ["focus ring", <span className="t-type">--pk-focus-color / -width / -offset / -halo</span>],
        ["discovering", <span className="t-type">--pk-scrim, --pk-busy-opacity</span>],
      ]} />

      <h2 className="dx-h2" id="kit">In Stellar Wallets Kit</h2>
      <CodeGroup tabs={[{ label: "Wallets Kit", raw: "// Recover seam → RecoverFlow\nconst accounts = await recover({ rpId, indexer });", body: <code>{Cm("// Recover seam → RecoverFlow")}{"\n"}{Kw("const")} accounts = {Kw("await")} {Fn("recover")}({"{ rpId, indexer }"});</code> }]} />

      <PageNav prev={["Sign", "/components/sign"]} next={["New components", "/components/connect"]} />
    </DocsPage>
  );
}
