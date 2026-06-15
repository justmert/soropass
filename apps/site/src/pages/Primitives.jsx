/* Primitives */
import { DocsPage, Callout, PropsTable, PageNav, Badge, I } from '../shell.jsx';
import { Button, AddressChip, Identicon, Spinner, StatusLine } from '../primitives.jsx';
import * as PKI from '../icons.jsx';

const TOC = [["live","Live primitives",0],["icons","Icon set",0],["signatures","Signatures",0]];

function Demo({ title, children, tokens }) {
  return (
    <div style={{ border: "1px solid var(--pk-color-border)", borderRadius: "var(--pk-radius-lg)", overflow: "hidden", margin: "14px 0" }}>
      <div style={{ padding: "26px", background: "var(--pk-color-background)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110 }} className="pk">{children}</div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--pk-color-border)", background: "var(--pk-color-surface)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <code style={{ fontFamily: "var(--pk-font-mono)", fontSize: 11.5, color: "var(--pk-color-text-faint)" }}>{tokens}</code>
      </div>
    </div>
  );
}

export default function Primitives() {
  return (
    <DocsPage active="Primitives" toc={TOC}>
      <div className="dx-breadcrumb">Components <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Primitives</span></div>
      <h1 className="dx-h1">Primitives</h1>
      <p className="dx-lead">The building blocks the three screens compose from — every one token-driven and individually usable.</p>

      <h2 className="dx-h2" id="live">Live primitives</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Demo title="Button" tokens="--pk-color-brand, --pk-radius-md">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
        </Demo>
        <Demo title="Spinner" tokens="--pk-spinner-*">
          <Spinner />
        </Demo>
        <Demo title="AddressChip" tokens="--pk-color-surface-sunken">
          <AddressChip address="CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4" label="Account" />
        </Demo>
        <Demo title="Identicon" tokens="OKLCH from FNV-1a">
          <div style={{ display: "flex", gap: 10 }}>
            {["CA3F", "CDEF", "CBQ9", "CXYZ"].map((s) => <Identicon key={s} seed={s} size={36} />)}
          </div>
        </Demo>
        <Demo title="StatusLine · polite" tokens="role=status, aria-live">
          <StatusLine tone="info" icon={<PKI.IconShield size={16} />}>Setting up your account…</StatusLine>
        </Demo>
        <Demo title="StatusLine · error" tokens="role=alert, assertive">
          <StatusLine tone="error" icon={<PKI.IconAlert size={16} />}>Couldn't reach the network.</StatusLine>
        </Demo>
      </div>

      <h2 className="dx-h2" id="icons">Icon set</h2>
      <p className="dx-p dx-p--muted">Thin line (1.75px stroke), <code>currentColor</code>, 24px grid. Chevron / arrowLeft are defined-but-unused, available for nav.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
        {["IconPasskey", "IconKey", "IconShield", "IconCopy", "IconCheck", "IconCheckCircle", "IconAlert", "IconExternal", "IconRefresh", "IconPlus", "IconChevron", "IconHelp", "IconArrowLeft"].map((name) => {
          const Ic = PKI[name];
          return (
            <div key={name} style={{ border: "1px solid var(--pk-color-border)", borderRadius: "var(--pk-radius-md)", padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "var(--pk-color-surface)", color: "var(--pk-color-text)" }}>
              <Ic size={22} />
              <code style={{ fontFamily: "var(--pk-font-mono)", fontSize: 10.5, color: "var(--pk-color-text-faint)" }}>{name.replace("Icon", "").toLowerCase()}</code>
            </div>
          );
        })}
      </div>

      <h2 className="dx-h2" id="signatures">Signatures</h2>
      <PropsTable cols={["Primitive", "Signature / notes"]} rows={[
        ["Card", <span className="t-type">max-width 384px · .is-waiting · dir</span>],
        ["Button", <span className="t-type">variant: primary | secondary | ghost · busy · 48px min</span>],
        ["AddressChip", <span className="t-type">{`{ address, label, showIdenticon }`} · copy-with-feedback</span>],
        ["Identicon", <span className="t-type">{`{ seed, size }`} · deterministic 5×5 symmetric</span>],
        ["TxSummary", <span className="t-type">host-supplied {`{ amountValue, amountFiat?, destination, action }`}</span>],
        ["RecoverList", <span className="t-type">listbox · roving focus · Up/Down/Home/End</span>],
        ["WaitOverlay", <span className="t-type">calm OS-sheet look + .pk-ossheet peek bar · NO spinner</span>],
        ["WorkBlock", <span className="t-type">spinner + indeterminate progress</span>],
        ["errorView", <span className="t-type">single layout, copy by KitError code</span>],
      ]} />
      <Callout kind="note">Promote-to-standalone candidates (AccountChip, Skeleton, Empty / Success / Error) carry <Badge kind="road">ROADMAP</Badge> badges.</Callout>

      <PageNav prev={["Create", "/components/create"]} next={["SDK reference", "/sdk"]} />
    </DocsPage>
  );
}
