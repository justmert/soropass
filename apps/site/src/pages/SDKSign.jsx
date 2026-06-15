/* SDK reference — @soropass/core/sign (signTransaction, signAuthEntry, signer, low-S, soroban auth) */
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, FeatureGrid, I, Kw, St, Fn, Cm } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const TOC = [
  ["signTransaction", "signTransaction", 0],
  ["signAuthEntry", "signAuthEntry", 0],
  ["options", "SorobanSignOptions", 1],
  ["browserPasskeySigner", "browserPasskeySigner", 0],
  ["signerOptions", "BrowserPasskeySignerOptions", 1],
  ["lows", "Low-S normalization", 0],
  ["isLowS", "isLowS", 1],
  ["normalizeLowS", "normalizeLowS", 1],
  ["derToCompact", "derToCompact", 1],
  ["derToCompactLowS", "derToCompactLowS", 1],
  ["soroban", "Soroban auth", 0],
  ["reconstructSignedPayload", "reconstructSignedPayload", 1],
  ["authEntryChallenge", "authEntryChallenge", 1],
  ["authEntryChallengeBytes", "authEntryChallengeBytes", 1],
  ["applyAssertionToEntry", "applyAssertionToEntry", 1],
  ["production", "Production note", 0],
];

const MONO = { fontFamily: "var(--pk-font-mono)" };

export default function SDKSign() {
  return (
    <DocsPage active="Sign" toc={TOC}>
      <div className="dx-breadcrumb">SDK reference <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Sign</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconShield /></span> Sign API</h1>
      <p className="dx-lead">Turn a Soroban transaction or a single authorization entry into a passkey-signed envelope. The <code style={MONO}>@soropass/core/sign</code> subpath obtains a WebAuthn assertion, low-S-normalizes it, and assembles the contract signature your <code style={MONO}>__check_auth</code> re-derives. <code style={MONO}>@stellar/stellar-sdk</code> is a peer dependency — it is never bundled into the SDK output.</p>

      <FeatureGrid items={[
        [<PKI.IconShield />, "Address-credential auth", "Signs every address-credential Soroban auth entry carried by the InvokeHostFunction operations of a transaction."],
        [<PKI.IconKey />, "Always low-S", "Every assertion is low-S-normalized downstream — Soroban's secp256r1_verify does not enforce it, so the SDK must."],
        [<PKI.IconRefresh />, "Pluggable signer", "browserPasskeySigner adapts navigator.credentials.get; inject a custom WebAuthnClient for tests or non-browser hosts."],
      ]} />

      <h2 className="dx-h2" id="signTransaction" style={MONO}>signTransaction</h2>
      <p className="dx-p">Sign every address-credential Soroban auth entry carried by the <code style={MONO}>InvokeHostFunction</code> operations of a transaction (base64 XDR envelope). Returns the signed envelope XDR.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "signTransaction(txXdr: string, options: SorobanSignOptions): Promise<string>",
        body: <code>{Fn("signTransaction")}(txXdr: {Kw("string")}, options: SorobanSignOptions): {Kw("Promise")}&lt;{Kw("string")}&gt;</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["txXdr", <span className="t-type">string</span>, "Base64 XDR transaction envelope to sign."],
        ["options", <span className="t-type">SorobanSignOptions</span>, "Network passphrase + WebAuthn signer (see below)."],
      ]} />
      <p className="dx-p"><strong>Returns</strong> <code style={MONO}>Promise&lt;string&gt;</code> — the signed envelope as base64 XDR.</p>
      <CodeGroup tabs={[{
        label: "sign-tx.ts",
        raw: "import { signTransaction, browserPasskeySigner } from '@soropass/core/sign';\n\nconst sign = browserPasskeySigner({ rpId, allowCredentials: [credentialId] });\nconst signedXdr = await signTransaction(txXdr, { networkPassphrase, sign });",
        body: <code>{Kw("import")} {"{ signTransaction, browserPasskeySigner }"} {Kw("from")} {St("'@soropass/core/sign'")};{"\n\n"}{Kw("const")} sign = {Fn("browserPasskeySigner")}({"{ rpId, allowCredentials: [credentialId] }"});{"\n"}{Kw("const")} signedXdr = {Kw("await")} {Fn("signTransaction")}(txXdr, {"{ networkPassphrase, sign }"});</code>,
      }]} />

      <h2 className="dx-h2" id="signAuthEntry" style={MONO}>signAuthEntry</h2>
      <p className="dx-p">Obtain a WebAuthn assertion, low-S-normalize, and assemble the contract signature. Returns the signed entry as base64 XDR.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "signAuthEntry(entryXdr: string, options: SorobanSignOptions): Promise<string>",
        body: <code>{Fn("signAuthEntry")}(entryXdr: {Kw("string")}, options: SorobanSignOptions): {Kw("Promise")}&lt;{Kw("string")}&gt;</code>,
      }]} />
      <PropsTable cols={["Param", "Type", "Description"]} rows={[
        ["entryXdr", <span className="t-type">string</span>, "Base64 XDR of a single SorobanAuthorizationEntry."],
        ["options", <span className="t-type">SorobanSignOptions</span>, "Network passphrase + WebAuthn signer (see below)."],
      ]} />
      <p className="dx-p"><strong>Returns</strong> <code style={MONO}>Promise&lt;string&gt;</code> — the signed entry as base64 XDR.</p>
      <CodeGroup tabs={[{
        label: "sign-entry.ts",
        raw: "import { signAuthEntry, browserPasskeySigner } from '@soropass/core/sign';\n\nconst sign = browserPasskeySigner({ rpId, allowCredentials: [credentialId] });\nconst signedEntry = await signAuthEntry(entryXdr, { networkPassphrase, sign });",
        body: <code>{Kw("import")} {"{ signAuthEntry, browserPasskeySigner }"} {Kw("from")} {St("'@soropass/core/sign'")};{"\n\n"}{Kw("const")} sign = {Fn("browserPasskeySigner")}({"{ rpId, allowCredentials: [credentialId] }"});{"\n"}{Kw("const")} signedEntry = {Kw("await")} {Fn("signAuthEntry")}(entryXdr, {"{ networkPassphrase, sign }"});</code>,
      }]} />

      <h3 className="dx-h3" id="options" style={MONO}>SorobanSignOptions</h3>
      <p className="dx-p">The options object shared by <code style={MONO}>signTransaction</code> and <code style={MONO}>signAuthEntry</code>.</p>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["networkPassphrase", <span className="t-type">string</span>, "Network passphrase bound into the auth challenge (networkId = SHA256(networkPassphrase))."],
        ["sign", <span className="t-type">WebAuthnSigner</span>, "The signer that produces the assertion — usually browserPasskeySigner(...)."],
      ]} />

      <h2 className="dx-h2" id="browserPasskeySigner" style={MONO}>browserPasskeySigner</h2>
      <p className="dx-p">Adapt <code style={MONO}>navigator.credentials.get</code> into the <code style={MONO}>WebAuthnSigner</code> that <code style={MONO}>signTransaction</code> / <code style={MONO}>signAuthEntry</code> expect. Hands the signer a base64url challenge (the Soroban auth preimage), decodes it, runs the assertion, returns the fields the auth assembler needs. The DER signature is low-S normalized downstream.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "browserPasskeySigner(options: BrowserPasskeySignerOptions): WebAuthnSigner",
        body: <code>{Fn("browserPasskeySigner")}(options: BrowserPasskeySignerOptions): WebAuthnSigner</code>,
      }]} />
      <p className="dx-p"><strong>Returns</strong> <code style={MONO}>WebAuthnSigner</code> — pass it as <code style={MONO}>options.sign</code> to the sign functions above.</p>

      <h3 className="dx-h3" id="signerOptions" style={MONO}>BrowserPasskeySignerOptions</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        [<span style={MONO}>rpId</span>, <span className="t-type">string</span>, "Relying Party ID (registrable domain)."],
        [<span style={MONO}>allowCredentials?</span>, <span className="t-type">string[]</span>, "base64url credential ids; omit for a discoverable prompt."],
        [<span style={MONO}>userVerification?</span>, <span className="t-type">'discouraged' | 'preferred' | 'required'</span>, "WebAuthn user-verification requirement."],
        [<span style={MONO}>webauthn?</span>, <span className="t-type">WebAuthnClient</span>, "Inject a custom client (tests / non-browser)."],
      ]} />
      <Callout kind="tip">Omit <code style={MONO}>allowCredentials</code> to drive a discoverable (resident-key) prompt where the authenticator surfaces the credential itself.</Callout>
      <CodeGroup tabs={[{
        label: "signer.ts",
        raw: "import { browserPasskeySigner, signTransaction } from '@soropass/core/sign';\n\nconst sign = browserPasskeySigner({\n  rpId: 'app.example.com',\n  allowCredentials: [credentialId], // omit for a discoverable prompt\n  userVerification: 'required',\n});\n\nconst signedXdr = await signTransaction(txXdr, { networkPassphrase, sign });",
        body: <code>{Kw("import")} {"{ browserPasskeySigner, signTransaction }"} {Kw("from")} {St("'@soropass/core/sign'")};{"\n\n"}{Kw("const")} sign = {Fn("browserPasskeySigner")}({"{"}{"\n"}  rpId: {St("'app.example.com'")},{"\n"}  allowCredentials: [credentialId], {Cm("// omit for a discoverable prompt")}{"\n"}  userVerification: {St("'required'")},{"\n"}{"}"});{"\n\n"}{Kw("const")} signedXdr = {Kw("await")} {Fn("signTransaction")}(txXdr, {"{ networkPassphrase, sign }"});</code>,
      }]} />

      <h2 className="dx-h2" id="lows">Low-S normalization</h2>
      <p className="dx-p">Invariant #2. Roughly 50% of Apple Touch ID / Face ID assertions come back high-S, and Soroban's <code style={MONO}>secp256r1_verify</code> does <strong>not</strong> enforce low-S — so the SDK must emit low-S before any contract sees the signature.</p>
      <Callout kind="warn">A high-S signature is malleable: the same message has two valid encodings. Always normalize to canonical low-S (S ≤ n/2) client-side.</Callout>

      <h3 className="dx-h3" id="isLowS" style={MONO}>isLowS</h3>
      <p className="dx-p">True if a 64-byte compact signature is canonical low-S (<code style={MONO}>S ≤ n/2</code>).</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "isLowS(compactSignature: Uint8Array): boolean",
        body: <code>{Fn("isLowS")}(compactSignature: {Kw("Uint8Array")}): {Kw("boolean")}</code>,
      }]} />

      <h3 className="dx-h3" id="normalizeLowS" style={MONO}>normalizeLowS</h3>
      <p className="dx-p">If <code style={MONO}>S &gt; n/2</code>, replace S with <code style={MONO}>n − S</code>. Idempotent.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "normalizeLowS(compactSignature: Uint8Array): Uint8Array",
        body: <code>{Fn("normalizeLowS")}(compactSignature: {Kw("Uint8Array")}): {Kw("Uint8Array")}</code>,
      }]} />

      <h3 className="dx-h3" id="derToCompact" style={MONO}>derToCompact</h3>
      <p className="dx-p">ASN.1 DER → 64-byte raw <code style={MONO}>R‖S</code> (noble parser). Does <strong>not</strong> enforce low-S.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "derToCompact(der: Uint8Array): Uint8Array",
        body: <code>{Fn("derToCompact")}(der: {Kw("Uint8Array")}): {Kw("Uint8Array")}</code>,
      }]} />

      <h3 className="dx-h3" id="derToCompactLowS" style={MONO}>derToCompactLowS</h3>
      <p className="dx-p">DER → 64-byte canonical low-S compact (what the ceremony uses).</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "derToCompactLowS(der: Uint8Array): Uint8Array",
        body: <code>{Fn("derToCompactLowS")}(der: {Kw("Uint8Array")}): {Kw("Uint8Array")}</code>,
      }]} />
      <CodeGroup tabs={[{
        label: "low-s.ts",
        raw: "import { derToCompactLowS, isLowS, normalizeLowS } from '@soropass/core/sign';\n\n// DER from the authenticator → canonical 64-byte low-S compact\nconst compact = derToCompactLowS(assertion.signatureDer);\n\nisLowS(compact); // true — ready for the contract\nnormalizeLowS(compact); // idempotent: returns compact unchanged",
        body: <code>{Kw("import")} {"{ derToCompactLowS, isLowS, normalizeLowS }"} {Kw("from")} {St("'@soropass/core/sign'")};{"\n\n"}{Cm("// DER from the authenticator → canonical 64-byte low-S compact")}{"\n"}{Kw("const")} compact = {Fn("derToCompactLowS")}(assertion.signatureDer);{"\n\n"}{Fn("isLowS")}(compact); {Cm("// true — ready for the contract")}{"\n"}{Fn("normalizeLowS")}(compact); {Cm("// idempotent: returns compact unchanged")}</code>,
      }]} />

      <h2 className="dx-h2" id="soroban">Soroban auth</h2>
      <p className="dx-p">The primitives that derive the challenge the authenticator signs and assemble the assertion back into a <code style={MONO}>SorobanAuthorizationEntry</code> the contract can verify.</p>

      <h3 className="dx-h3" id="reconstructSignedPayload" style={MONO}>reconstructSignedPayload</h3>
      <p className="dx-p"><code style={MONO}>SHA256(authData ‖ SHA256(clientDataJSON))</code> — the 32-byte payload <code style={MONO}>__check_auth</code> re-derives.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "reconstructSignedPayload({ authenticatorData, clientDataJSON }): Uint8Array",
        body: <code>{Fn("reconstructSignedPayload")}({"{ authenticatorData, clientDataJSON }"}): {Kw("Uint8Array")}</code>,
      }]} />

      <h3 className="dx-h3" id="authEntryChallenge" style={MONO}>authEntryChallenge</h3>
      <p className="dx-p">base64url challenge (43 chars) the authenticator signs.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "authEntryChallenge(entry, networkPassphrase): string",
        body: <code>{Fn("authEntryChallenge")}(entry, networkPassphrase): {Kw("string")}</code>,
      }]} />

      <h3 className="dx-h3" id="authEntryChallengeBytes" style={MONO}>authEntryChallengeBytes</h3>
      <p className="dx-p"><code style={MONO}>SHA256(XDR(HashIdPreimage::SorobanAuthorization{"{...}"}))</code>; <code style={MONO}>networkId = SHA256(networkPassphrase)</code>.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "authEntryChallengeBytes(entry, networkPassphrase): Uint8Array",
        body: <code>{Fn("authEntryChallengeBytes")}(entry, networkPassphrase): {Kw("Uint8Array")}</code>,
      }]} />

      <h3 className="dx-h3" id="applyAssertionToEntry" style={MONO}>applyAssertionToEntry</h3>
      <p className="dx-p">Sets the entry signature to <code style={MONO}>ScVal::Map {"{ authenticator_data, client_data_json, signature: BytesN<64> }"}</code> (alphabetical keys). The signature MUST already be 64-byte low-S.</p>
      <CodeGroup tabs={[{
        label: "signature",
        raw: "applyAssertionToEntry(entry, assertion): SorobanAuthorizationEntry",
        body: <code>{Fn("applyAssertionToEntry")}(entry, assertion): SorobanAuthorizationEntry</code>,
      }]} />
      <Callout kind="warn">The <code style={MONO}>signature</code> passed to <code style={MONO}>applyAssertionToEntry</code> must already be the 64-byte low-S compact form. Use <code style={MONO}>derToCompactLowS</code> first.</Callout>
      <CodeGroup tabs={[{
        label: "soroban-auth.ts",
        raw: "import {\n  authEntryChallenge,\n  reconstructSignedPayload,\n  applyAssertionToEntry,\n} from '@soropass/core/sign';\n\n// 1. the base64url challenge the authenticator signs\nconst challenge = authEntryChallenge(entry, networkPassphrase);\n\n// 2. after the assertion, the 32-byte payload __check_auth re-derives\nconst payload = reconstructSignedPayload({\n  authenticatorData,\n  clientDataJSON,\n});\n\n// 3. signature must already be 64-byte low-S\nconst signed = applyAssertionToEntry(entry, {\n  authenticatorData,\n  clientDataJSON,\n  signature, // BytesN<64>, low-S\n});",
        body: <code>{Kw("import")} {"{"}{"\n"}  authEntryChallenge,{"\n"}  reconstructSignedPayload,{"\n"}  applyAssertionToEntry,{"\n"}{"}"} {Kw("from")} {St("'@soropass/core/sign'")};{"\n\n"}{Cm("// 1. the base64url challenge the authenticator signs")}{"\n"}{Kw("const")} challenge = {Fn("authEntryChallenge")}(entry, networkPassphrase);{"\n\n"}{Cm("// 2. after the assertion, the 32-byte payload __check_auth re-derives")}{"\n"}{Kw("const")} payload = {Fn("reconstructSignedPayload")}({"{"}{"\n"}  authenticatorData,{"\n"}  clientDataJSON,{"\n"}{"}"});{"\n\n"}{Cm("// 3. signature must already be 64-byte low-S")}{"\n"}{Kw("const")} signed = {Fn("applyAssertionToEntry")}(entry, {"{"}{"\n"}  authenticatorData,{"\n"}  clientDataJSON,{"\n"}  signature, {Cm("// BytesN<64>, low-S")}{"\n"}{"}"});</code>,
      }]} />

      <h2 className="dx-h2" id="production">Production note</h2>
      <Callout kind="warn"><code style={MONO}>simulateTransaction</code> does not run <code style={MONO}>secp256r1_verify</code>, so it under-budgets <code style={MONO}>__check_auth</code>. Raise the instruction budget + resource fee before submit, or use a managed submitter.</Callout>
      <p className="dx-p">For the matching error codes raised by these functions — including <code style={MONO}>INVALID_SIGNATURE_DER</code> and challenge/origin mismatches — see <a href="/sdk/errors">the KitError taxonomy</a>.</p>

      <PageNav prev={["Create", "/sdk/create"]} next={["Recover & Connect", "/sdk/recover"]} />
    </DocsPage>
  );
}
