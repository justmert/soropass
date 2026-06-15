/* SDK Reference (2B) + live Try-It */
import { useState } from 'react';
import { DocsPage, Callout, PropsTable, PageNav, I } from '../shell.jsx';
import * as PKI from '../icons.jsx';
import { ErrorState } from '../primitives.jsx';

const TOC = [["strengths","Strengths",0],["subpaths","Subpaths",0],["modules","API modules",0],["tryit","Try it · low-S",0],["badinput","Try it · bad input",0]];

/* secp256r1 order */
const N = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
const HALF = N >> 1n;
function hexToBig(h) { try { return BigInt("0x" + h.replace(/[^0-9a-fA-F]/g, "")); } catch (e) { return 0n; } }
function big2hex(b) { let s = b.toString(16); return s.padStart(64, "0"); }

function LowSRunner() {
  const [s, setS] = useState("E2A1F4C7B9D08053614AF9B2C7E0D4F6182A3C5D7E9B0F1234567890ABCDEFFF");
  const S = hexToBig(s);
  const low = S <= HALF && S > 0n;
  const norm = S > HALF ? N - S : S;
  const normLow = norm <= HALF && norm > 0n;
  return (
    <div className="dx-runner">
      <div className="dx-runner__in">
        <span className="dx-runner__label">Input · signature S (hex)</span>
        <textarea className="dx-runner__result" style={{ resize: "vertical", fontFamily: "var(--pk-font-mono)" }} rows={3} value={s} onChange={(e) => setS(e.target.value)} />
        <span className="dx-runner__label">forceHighS via mockAuthenticator → isLowS() === false → normalizeLowS()</span>
        <button className="dx-btn dx-btn--secondary" style={{ width: "fit-content" }} onClick={() => setS(big2hex(N - S))}>↺ Reflect S → n−S</button>
      </div>
      <div className="dx-runner__out">
        <span className="dx-runner__label">isLowS(S)</span>
        <span className={`dx-runner__pill dx-runner__pill--${low ? "yes" : "no"}`}>{String(low)}</span>
        <span className="dx-runner__label">normalizeLowS(S)</span>
        <div className="dx-runner__result">{big2hex(norm)}</div>
        <span className="dx-runner__label">isLowS(normalized)</span>
        <span className={`dx-runner__pill dx-runner__pill--${normLow ? "yes" : "no"}`}>{String(normLow)}</span>
      </div>
    </div>
  );
}

const BAD = [
  ["RS256 / non-P256 key", "ES256_NOT_SUPPORTED", "ceremonies/create.ts asserts alg === −7"],
  ["Malformed / >72-byte DER", "INVALID_SIGNATURE_DER", "webauthn/signature.ts derToCompact"],
  ["High-S signature (forceHighS)", "isLowS() === false", "normalizeLowS reflects to n−S"],
  ["Unreadable COSE key", "INVALID_PUBLIC_KEY", "coseKeyToSec1 throws"],
  ["Origin / challenge mismatch", "ORIGIN_MISMATCH / CHALLENGE_MISMATCH", "verifyClientDataJSON"],
];
function BadInput() {
  const [i, setI] = useState(0);
  const b = BAD[i];
  return (
    <>
      <div className="dx-fw">
        {BAD.map((x, idx) => <button key={x[1]} className="dx-fw__tab" aria-selected={i === idx} onClick={() => setI(idx)}>{x[0]}</button>)}
      </div>
      <div className="dx-runner">
        <div className="dx-runner__in">
          <span className="dx-runner__label">Raw KitError</span>
          <div className="dx-runner__result">{`{\n  "code": "${b[1]}",\n  "cause": "${b[2]}"\n}`}</div>
        </div>
        <div className="dx-runner__out">
          <span className="dx-runner__label">Rendered errorView</span>
          <div className="pk" style={{ display: "flex", justifyContent: "center" }}>
            <ErrView code={b[1]} />
          </div>
        </div>
      </div>
    </>
  );
}
function ErrView({ code }) {
  const map = { "ES256_NOT_SUPPORTED": "create:onchain", "INVALID_SIGNATURE_DER": "sign:signature", "INVALID_PUBLIC_KEY": "create:keyread", "ORIGIN_MISMATCH / CHALLENGE_MISMATCH": "sign:verify", "isLowS() === false": "sign:signature" };
  const ec = map[code] || "create:network";
  return <div className="pk-card" style={{ maxWidth: 340 }}><ErrorState code={ec} onRetry={() => {}} /></div>;
}

export default function SDK() {
  return (
    <DocsPage active="Overview" toc={TOC}>
      <div className="dx-breadcrumb">SDK reference <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Overview</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKIShield /></span> SDK Reference</h1>
      <p className="dx-lead">A minimal, headless, ES256-only passkey SDK for Stellar smart accounts.</p>

      <h2 className="dx-h2" id="strengths">Strengths</h2>
      <div className="dx-strengths">
        {[["~1.85 KB", "Tiny core", "gzip; subpaths from 0.2 KB"], ["ES256-only", "Hard-fail", "non-P256 rejected at creation"], ["Low-S", "Always", "normalized before any contract"], ["10 codes", "Typed errors", "frozen, exhaustive"]].map(([big, t, d]) => (
          <div className="dx-strength" key={t}><div className="dx-strength__big">{big}</div><div className="dx-strength__t">{t}</div><div className="dx-strength__d">{d}</div></div>
        ))}
      </div>

      <h2 className="dx-h2" id="subpaths">Subpaths &amp; import map</h2>
      <p className="dx-p">Each subpath is independently importable — tree-shaking is the headline. <code>@stellar/stellar-sdk</code> is a peer dep, never bundled.</p>
      <PropsTable cols={["Subpath", "What it gives", "Bundle"]} rows={[
        [".", "Public surface", <span className="dx-bundle">5.6 KB · <b>~1.85 KB gz</b></span>],
        ["/create", "createPasskey, assertES256", <span className="dx-bundle">~476 B</span>],
        ["/connect", "connect()", <span className="dx-bundle">~208 B</span>],
        ["/recover", "recover()", <span className="dx-bundle">~238 B</span>],
        ["/sign", "signTransaction, normalizeLowS", <span className="dx-bundle">605 B · <b>~349 B gz</b></span>],
        ["/types", "KitError, guards", <span className="dx-bundle">235 B · <b>~182 B gz</b></span>],
        ["/testing", "mockAuthenticator (dev-only)", <span className="dx-bundle">7.5 KB</span>],
      ]} />
      <Callout kind="tip">The heavy crypto (noble) is shared and pulled only when <code>/sign</code> or <code>/create</code> is imported.</Callout>

      <h2 className="dx-h2" id="modules">API reference</h2>
      <p className="dx-p dx-p--muted">Each area has its own page — signatures, options, returns, and a runnable example, generated from the real types.</p>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[
          ["Create", "/sdk/create", "createPasskey, AccountDeployer, COSE → SEC-1 key helpers"],
          ["Sign", "/sdk/sign", "signTransaction, signAuthEntry, browserPasskeySigner, low-S"],
          ["Recover & Connect", "/sdk/recover", "recover → RecoverResult[], connect → ConnectResult | null"],
          ["Adapters", "/sdk/adapters", "direct · launchtube · oz-relayer · events · mercury"],
          ["KitError taxonomy", "/sdk/errors", "10 frozen codes → cause → UI copy → recovery"],
        ].map(([t, href, d]) => (
          <a className="dx-card" key={t} href={href}>
            <p className="dx-card__title">{t}</p>
            <p className="dx-card__body">{d}</p>
          </a>
        ))}
      </div>

      <h2 className="dx-h2" id="tryit">Try it — low-S round-trip</h2>
      <p className="dx-p dx-p--muted">A real, runnable computation against the secp256r1 order n. Edit S or reflect it; watch <code>isLowS</code> flip and <code>normalizeLowS</code> bring it back.</p>
      <LowSRunner />

      <h2 className="dx-h2" id="badinput">Try it — feed it a bad input</h2>
      <p className="dx-p dx-p--muted">Each failure throws a real, code-grounded <code>KitError</code> on the left and renders the actual <code>errorView</code> on the right. One taxonomy → one layout.</p>
      <BadInput />
      <Callout kind="note">One frozen 10-code taxonomy → one error layout, copy swapped by code. See <a href="/sdk/errors">the full taxonomy</a>.</Callout>

      <PageNav prev={["Primitives", "/components/primitives"]} next={["Create", "/sdk/create"]} />
    </DocsPage>
  );
}
function PKIShield() { return PKI.IconShield({ size: 25 }); }
