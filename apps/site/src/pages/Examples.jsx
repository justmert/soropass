/* Examples (2C) — web / mobile / cross-device */
import { useState } from 'react';
import { DocsPage, CodeGroup, Callout, PageNav, Badge, I, Kw, St, Fn } from '../shell.jsx';
import RealScreen from '../RealScreen.jsx';

const TOC = [["surfaces","Surfaces",0],["web","Web (desktop)",0],["mobile","Mobile-web",0],["cross","Cross-device",0],["ossheet","OS sheet behavior",0]];

const SURF = [["web", "Web (desktop)", "Live", "yes"], ["mobile", "Mobile-web", "Live", "yes"], ["cross", "Cross-device", "Guidance", "road"]];

export default function Examples() {
  const [surf, setSurf] = useState("web");
  return (
    <DocsPage active="Examples" toc={TOC}>
      <div className="dx-breadcrumb">Guides <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Examples</span></div>
      <h1 className="dx-h1">Web, mobile and cross-device</h1>
      <p className="dx-lead">The same create / sign / recover components across desktop, mobile-web, and the desktop-initiates-on-phone case — shown live where we can, and as honest guidance where the platform takes over.</p>
      <Callout kind="note"><strong>Live today:</strong> desktop web + mobile-web (real vanilla-DOM mount, mock mode, zero network). <strong>Guidance + roadmap:</strong> native bottom-sheet container + cross-device caBLE/QR. Real ceremonies and on-chain proof live on the Security &amp; How-it-works pages — embeds run in mock mode because browsers restrict WebAuthn inside cross-origin iframes.</Callout>

      <h2 className="dx-h2" id="surfaces">Surfaces</h2>
      <div className="dx-fw">
        {SURF.map(([id, label, pill, kind]) => (
          <button key={id} className="dx-fw__tab" aria-selected={surf === id} onClick={() => setSurf(id)}>
            {label} {kind === "yes" ? <Badge kind="ship">LIVE</Badge> : <Badge kind="road">GUIDANCE</Badge>}
          </button>
        ))}
      </div>

      {surf === "web" && <section id="web">
        <h2 className="dx-h2">Web (desktop)</h2>
        <div className="dx-embed">
          <div className="dx-embed__bar"><span className="dx-embed__dot" /><span className="dx-embed__dot" /><span className="dx-embed__dot" /><span className="dx-embed__url">desktop.embed.example.xyz</span></div>
          <div className="dx-embed__body pk"><RealScreen screen="sign" state="idle" /></div>
        </div>
        <CodeGroup tabs={[
          { label: "Standalone", raw: "mountSignScreen(root, { flow, tx });", body: <code>{Fn("mountSignScreen")}(root, {"{ flow, tx }"});</code> },
          { label: "Via Wallets Kit", raw: "await kit.signTransaction(xdr);", body: <code>{Kw("await")} kit.{Fn("signTransaction")}(xdr);</code> },
          { label: "React (coming)", raw: "useEffect(() => { const h = mountSignScreen(ref.current, { flow, tx }); return () => h.unmount(); }, []);", body: <code>{Fn("useEffect")}(() =&gt; {"{"} {Kw("const")} h = {Fn("mountSignScreen")}(ref.current, {"{ flow, tx }"}); {Kw("return")} () =&gt; h.{Fn("unmount")}(); {"}"}, []);</code> },
        ]} />
      </section>}

      {surf === "mobile" && <section id="mobile">
        <h2 className="dx-h2">Mobile-web</h2>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,340px) 1fr", gap: 28, alignItems: "start" }}>
          <div className="cx-phone" style={{ margin: "0 auto" }}>
            <div className="cx-phone__notch" />
            <div className="cx-phone__bar"><span>9:41</span><span className="cx-phone__sig" /></div>
            <div className="cx-phone__body pk"><RealScreen screen="create" state="idle" /></div>
          </div>
          <div>
            <p className="dx-p">Works from 360px; ≥44–48px touch targets; calm opaque OS-sheet waiting (no spinner); bottom-edge OS-sheet hint bar; safe-area aware.</p>
            <div style={{ display: "inline-grid", placeItems: "center", width: 120, height: 120, border: "1px solid var(--pk-color-border)", borderRadius: "var(--pk-radius-md)", background: "var(--pk-color-surface)", margin: "12px 0" }}>
              <svg viewBox="0 0 100 100" width="92" height="92" aria-label="QR placeholder">{Array.from({length:100}).map((_,i)=>{const x=i%10,y=(i/10|0);const on=(x*y+x+y)%3===0||x===0||y===0||x===9||y===9;return on?<rect key={i} x={x*10} y={y*10} width="10" height="10" fill="var(--pk-color-text)" />:null;})}</svg>
            </div>
            <p className="dx-p dx-p--muted">Scan to open the live mobile-web demo on your device (mock mode, no wallet needed).</p>
          </div>
        </div>
        <Callout kind="note">On a real phone, the passkey sheet (Face ID / Touch ID) is the OS — our card stays calm behind it.</Callout>
      </section>}

      {surf === "cross" && <section id="cross">
        <h2 className="dx-h2">Cross-device (hybrid / caBLE / QR)</h2>
        <div className="dx-video"><div className="dx-video__play"><I.Play /></div><div className="dx-video__chapters"><span className="dx-chapter">Recorded desktop → phone hybrid flow · captioned device/OS/date</span></div></div>
        <p className="dx-p"><Badge kind="road">ROADMAP</Badge> Intended UX — component on roadmap:</p>
        <div className="dx-cardgroup dx-cardgroup--4">
          {[["1 · Offer", "Connect modal: “Use a passkey on another device.”"], ["2 · QR", "CrossDeviceConnect QR + calm hybrid-transport waiting (no spinner)."], ["3 · Approve", "“Approve on the phone that has your passkey.”"], ["4 · Success", "Account chip."]].map(([t, d]) => (
            <div className="dx-card" key={t}><p className="dx-card__title">{t}</p><p className="dx-card__body">{d}</p></div>
          ))}
        </div>
        <Callout kind="warn"><code>hybrid_transport</code> is sourced from MDN BCD + getClientCapabilities(), not yet machine-probed in CI (which covers internal + usb). It's a documented, sourced surface — the dedicated component is the next build. <a href="/compatibility">See the matrix row →</a></Callout>
      </section>}

      <h2 className="dx-h2" id="ossheet">How the OS sheet behaves on each surface</h2>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[["Desktop", "Calm opaque panel + pulsing glyph behind the native sheet."], ["Phone", "Same + bottom-edge OS-sheet hint bar, ≥48px targets."], ["Cross-device", "Longer wait → leans on calm + “approve on your phone,” still no spinner."]].map(([t, d]) => (
          <div className="dx-card" key={t}><p className="dx-card__title">{t}</p><p className="dx-card__body">{d}</p></div>
        ))}
      </div>
      <Callout kind="tip">Four busy looks: WaitOverlay (OS sheet up) vs WorkBlock (spinner + progress) — never both at once.</Callout>

      <PageNav prev={["Theming", "/theming"]} next={["Compatibility", "/compatibility"]} />
    </DocsPage>
  );
}
