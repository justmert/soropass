/* How it works (2D) — long-form trust model */
import React from 'react';
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, I, Kw, Fn } from '../shell.jsx';

const TOC = [["thesis","Thesis",0],["flow","Master flow",0],["s1","1 · Ceremony",0],["s2","2 · ES256 + low-S",0],["s3","3 · Challenge",0],["s4","4 · Wire shape",0],["s5","5 · __check_auth",0],["proof","On-chain proof",0],["pipeline","Living matrix",0]];
const Cm = (s) => <span className="c-com">{s}</span>;

/* Low-S number line: 0 … n, midpoint n/2, S in upper half reflecting to n−S */
function LowSLine() {
  const W = 680, H = 150, pad = 40, y = 80;
  const x = (t) => pad + t * (W - 2 * pad);
  const sT = 0.74, refT = 1 - sT;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 680, margin: "18px 0" }} role="img" aria-label="Low-S reflection number line">
      <rect x={x(0)} y={y - 6} width={x(0.5) - x(0)} height="12" rx="6" fill="var(--pk-color-success-soft)" />
      <rect x={x(0.5)} y={y - 6} width={x(1) - x(0.5)} height="12" rx="6" fill="var(--pk-color-error-soft)" />
      <line x1={x(0)} y1={y} x2={x(1)} y2={y} stroke="var(--pk-color-border-strong)" strokeWidth="1.5" />
      <line x1={x(0.5)} y1={y - 22} x2={x(0.5)} y2={y + 22} stroke="var(--pk-color-text-muted)" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x={x(0)} y={y + 34} fontSize="12" fill="var(--pk-color-text-faint)" fontFamily="var(--pk-font-mono)">0</text>
      <text x={x(0.5) - 12} y={y + 34} fontSize="12" fill="var(--pk-color-text-muted)" fontFamily="var(--pk-font-mono)">n/2</text>
      <text x={x(1) - 8} y={y + 34} fontSize="12" fill="var(--pk-color-text-faint)" fontFamily="var(--pk-font-mono)">n</text>
      {/* S (rejected half) */}
      <circle cx={x(sT)} cy={y} r="6" fill="var(--pk-color-error)" />
      <text x={x(sT) - 6} y={y - 14} fontSize="12" fill="var(--pk-color-error)" fontFamily="var(--pk-font-mono)">S</text>
      {/* reflection arrow */}
      <path d={`M ${x(sT)} ${y - 30} Q ${x(0.5)} ${y - 56} ${x(refT)} ${y - 30}`} fill="none" stroke="var(--pk-color-brand)" strokeWidth="1.5" markerEnd="url(#ah)" />
      <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0l6 3-6 3z" fill="var(--pk-color-brand)" /></marker></defs>
      {/* n-S accepted */}
      <circle cx={x(refT)} cy={y} r="6" fill="var(--pk-color-success)" />
      <text x={x(refT) - 16} y={y - 14} fontSize="12" fill="var(--pk-color-success)" fontFamily="var(--pk-font-mono)">n−S</text>
    </svg>
  );
}

/* generic flow diagram */
function FlowDiagram() {
  const nodes = ["Device · Secure Enclave", "Browser · navigator.credentials", "@soropass/core", "Stellar network", "WebauthnAccount.__check_auth", "host secp256r1_verify"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "18px 0" }}>
      {nodes.map((n, i) => (
        <React.Fragment key={n}>
          <div style={{ border: "1px solid var(--pk-color-border)", borderRadius: "var(--pk-radius-md)", background: i >= 4 ? "var(--pk-color-brand-soft)" : "var(--pk-color-surface)", color: i >= 4 ? "var(--pk-color-brand)" : "var(--pk-color-text)", padding: "10px 14px", fontSize: 13, fontWeight: 600, fontFamily: i >= 2 ? "var(--pk-font-mono)" : "inherit" }}>{n}</div>
          {i < nodes.length - 1 && <span style={{ color: "var(--pk-color-text-faint)" }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function EqCard() {
  return (
    <div style={{ border: "1px solid var(--pk-color-border-strong)", borderRadius: "var(--pk-radius-md)", background: "var(--pk-color-surface-sunken)", padding: "20px 24px", margin: "18px 0", textAlign: "center", fontFamily: "var(--pk-font-mono)", fontSize: 16, color: "var(--pk-color-text)" }}>
      payload = SHA256( authData ‖ SHA256(clientDataJSON) )
    </div>
  );
}

export default function HowItWorks() {
  return (
    <DocsPage active="How it works" toc={TOC}>
      <div className="dx-breadcrumb">Guides <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>How it works</span></div>
      <h1 className="dx-h1">How it works</h1>
      <p className="dx-lead">A passkey signs your transaction; a Stellar smart account verifies it on-chain — no seed phrase, no server, no trusted backend.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        {["ES256-only, hardened", "Always low-S normalized", "Proven on testnet"].map((c) => <span className="dx-freshchip" key={c}>{c}</span>)}
      </div>

      <h2 className="dx-h2" id="flow">Master flow</h2>
      <FlowDiagram />
      <p className="dx-p dx-p--muted">Three artifacts travel the wire: the assertion <code>{`{ authenticatorData, clientDataJSON, signature(DER) }`}</code>, the 43-char base64url challenge, and the <code>Secp256r1Signature</code> ScVal.</p>

      <h2 className="dx-h2" id="s1">Stage 1 — WebAuthn ceremony</h2>
      <PropsTable cols={["Artifact", "What it is"]} rows={[
        ["authenticatorData", "rpIdHash + flags + counter"],
        ["clientDataJSON", "type, challenge, origin"],
        ["signature (DER)", "secp256r1 signature over authData ‖ SHA256(cdj)"],
      ]} />
      <EqCard />
      <Callout kind="note">The <code>challenge</code> in clientDataJSON binds the signature to one specific request — the root of phishing resistance.</Callout>

      <h2 className="dx-h2" id="s2">Stage 2 — ES256-only + always low-S</h2>
      <p className="dx-p">We request <code>{`{ alg: -7 }`}</code> only; anything else hard-fails on both request and response side. Then every signature is normalized to low-S: if S is in the upper half of the curve order, reflect it to n−S.</p>
      <LowSLine />
      <Callout kind="tip">The host <code>secp256r1_verify</code> doesn't enforce low-S, so we do it once, client-side — malleability closed before a signature ever reaches a contract.</Callout>

      <h2 className="dx-h2" id="s3">Stage 3 — challenge binding</h2>
      <CodeGroup tabs={[{ label: "preimage", raw: "SorobanAuthorizationEntry → HashIdPreimage::SorobanAuthorization {\n  networkId = SHA256(passphrase), nonce, signatureExpirationLedger, invocation\n} → XDR → SHA256 → base64url = 43-char challenge",
        body: <code>SorobanAuthorizationEntry → HashIdPreimage::SorobanAuthorization {"{"}{"\n"}  networkId = {Fn("SHA256")}(passphrase), nonce, signatureExpirationLedger, invocation{"\n"}{"}"} → XDR → {Fn("SHA256")} → base64url = 43-char challenge</code> }]} />
      <Callout kind="note">A captured signature cannot be replayed for a different transaction, nonce, or network.</Callout>

      <h2 className="dx-h2" id="s4">Stage 4 — the Soroban wire shape</h2>
      <CodeGroup tabs={[
        { label: "TypeScript (assembles)", raw: "const sig = buildSignatureScVal({ authenticator_data, client_data_json, signature }); // keys alphabetical, signature 64-byte low-S",
          body: <code>{Kw("const")} sig = {Fn("buildSignatureScVal")}({"{"} authenticator_data, client_data_json, signature {"}"}); {Cm("// alphabetical, 64-byte low-S")}</code> },
        { label: "Rust (consumes)", raw: "pub struct Secp256r1Signature {\n  pub authenticator_data: Bytes,\n  pub client_data_json: Bytes,\n  pub signature: BytesN<64>,\n}",
          body: <code>{Kw("pub struct")} Secp256r1Signature {"{"}{"\n"}  {Kw("pub")} authenticator_data: Bytes,{"\n"}  {Kw("pub")} client_data_json: Bytes,{"\n"}  {Kw("pub")} signature: BytesN&lt;64&gt;,{"\n"}{"}"}</code> },
      ]} />

      <h2 className="dx-h2" id="s5">Stage 5 — __check_auth + secp256r1_verify</h2>
      <ol className="dx-steps">
        <li className="dx-step"><div className="dx-step__title">Challenge binding</div><p className="dx-step__body"><code>clientDataJSON.challenge == base64url(signature_payload)</code>, else <code>ChallengeMismatch</code>.</p></li>
        <li className="dx-step"><div className="dx-step__title">Reconstruct the message</div><p className="dx-step__body"><code>authenticator_data ‖ SHA256(client_data_json)</code>.</p></li>
        <li className="dx-step"><div className="dx-step__title">Verify</div><p className="dx-step__body"><code>secp256r1_verify(public_key, SHA256(message), signature)</code> — traps on invalid.</p></li>
      </ol>
      <EqCard />
      <p className="dx-p dx-p--muted">The same digest is computed in the browser (Stage 1) and re-derived on-chain (Stage 5) — that's the whole trust model.</p>

      <h2 className="dx-h2" id="proof">On-chain proof — positive and negative</h2>
      <div className="dx-cardgroup dx-cardgroup--2">
        <div className="dx-card" style={{ borderColor: "color-mix(in oklch, var(--pk-color-success) 40%, transparent)" }}>
          <p className="dx-card__title" style={{ color: "var(--pk-color-success)" }}>✓ Correct key → SUCCESS</p>
          <p className="dx-card__body">tx <code>f256288c…</code> — verified on testnet. <a href="https://stellar.expert/explorer/testnet/tx/f256288c75f4865f40d409d22eb1ebe2e48ebd7fdb8ed028ad6d13e4d3ed8418" target="_blank" rel="noreferrer">View on stellar.expert →</a></p>
        </div>
        <div className="dx-card" style={{ borderColor: "color-mix(in oklch, var(--pk-color-error) 40%, transparent)" }}>
          <p className="dx-card__title" style={{ color: "var(--pk-color-error)" }}>✕ Wrong key → TRAPS</p>
          <p className="dx-card__body">On-chain failure, explorer-linked. Not a mock — a live testnet round-trip you can re-run.</p>
        </div>
      </div>
      <Callout kind="warn">Simulation under-budgets CPU because it skips <code>secp256r1_verify</code> — inflate the instruction budget before submit. Real tx hashes come from <code>scripts/onchain-e2e.ts</code>, never fabricated.</Callout>

      <h2 className="dx-h2" id="pipeline">The living-matrix pipeline</h2>
      <FlowDiagram2 />
      <p className="dx-p dx-p--muted">BCD ingest → typed snapshot → virtual-authenticator CI grid → dated MergedMatrixSnapshot (provenance / tier / lastVerified) → diff vs previous → commit back. <a href="/compatibility">See the matrix →</a></p>

      <PageNav prev={["Compatibility", "/compatibility"]} next={["Security", "/security"]} />
    </DocsPage>
  );
}
function FlowDiagram2() {
  const ns = ["BCD ingest", "typed snapshot", "CI grid", "dated snapshot", "diff", "commit"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "16px 0" }}>
      {ns.map((n, i) => (
        <React.Fragment key={n}>
          <div style={{ border: "1px solid var(--pk-color-border)", borderRadius: "var(--pk-radius-full)", background: "var(--pk-color-surface)", padding: "7px 13px", fontSize: 12.5, fontFamily: "var(--pk-font-mono)", color: "var(--pk-color-text-muted)" }}>{n}</div>
          {i < ns.length - 1 && <span style={{ color: "var(--pk-color-text-faint)" }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
