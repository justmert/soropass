/* SDK reference — @soropass/core/create API page (v2 spine) */
import { DocsPage, CodeGroup, Callout, PropsTable, PageNav, FeatureGrid, I, Kw, St, Fn, Cm } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const TOC = [
  ["overview", "Overview", 0],
  ["highlights", "Highlights", 0],
  ["createPasskey", "createPasskey", 0],
  ["options", "CreatePasskeyOptions", 1],
  ["credential", "PasskeyCredential", 1],
  ["deployer", "AccountDeployer", 0],
  ["helpers", "Assertions & options", 0],
  ["assertES256", "assertES256", 1],
  ["assertUserActivation", "assertUserActivation", 1],
  ["buildCreateOptions", "buildCreateOptions", 1],
  ["clients", "Clients & storage", 0],
  ["keys", "Public-key extraction", 0],
];

const MONO = { fontFamily: "var(--pk-font-mono)" };

export default function SDKCreate() {
  return (
    <DocsPage active="Create" toc={TOC}>
      <div className="dx-breadcrumb">SDK reference <I.ChevR /> <span style={{ color: "var(--pk-color-text-muted)" }}>Create</span></div>
      <h1 className="dx-h1"><span className="dx-h1__glyph"><PKI.IconShield /></span> Create API</h1>
      <p className="dx-lead">The <code style={MONO}>@soropass/core/create</code> subpath: register an ES256-only passkey, extract its SEC-1 public key, deploy a smart account through your factory, and persist the credential id. ES256 is enforced at the source — anything else hard-fails.</p>

      <h2 className="dx-h2" id="overview">Overview</h2>
      <p className="dx-p">Import only what you need from the <code style={MONO}>/create</code> subpath. <code style={MONO}>createPasskey</code> is the one call most apps need; the rest are the building blocks it composes, exported for advanced flows and testing.</p>
      <CodeGroup tabs={[{ label: "import", raw: "import {\n  createPasskey,\n  assertES256,\n  buildCreateOptions,\n  browserWebAuthnClient,\n  defaultCredentialStorage,\n  coseKeyToSec1,\n} from '@soropass/core/create';",
        body: <code>{Kw("import")} {"{"}{"\n"}  createPasskey,{"\n"}  assertES256,{"\n"}  buildCreateOptions,{"\n"}  browserWebAuthnClient,{"\n"}  defaultCredentialStorage,{"\n"}  coseKeyToSec1,{"\n"}{"}"} {Kw("from")} {St("'@soropass/core/create'")};</code> }]} />
      <Callout kind="warn"><strong>ES256-only invariant.</strong> <code>pubKeyCredParams</code> is exactly <code>[{"{"} type:&nbsp;'public-key', alg:&nbsp;-7 {"}"}]</code>. Any other algorithm (RS256, EdDSA, …) throws <code>KitError('ES256_NOT_SUPPORTED')</code> — Soroban verifies only secp256r1.</Callout>
      <Callout kind="note"><code>@stellar/stellar-sdk</code> is a peer dependency and is <strong>never</strong> bundled into the SDK output. The contract-specific work lives behind the <code>AccountDeployer</code> you supply.</Callout>

      <h2 className="dx-h2" id="highlights">Highlights</h2>
      <FeatureGrid items={[
        [<PKI.IconShield />, "ES256 at the source", "buildCreateOptions emits pubKeyCredParams [{ type:'public-key', alg:-7 }] only; assertES256 throws unless alg === -7."],
        [<PKI.IconKey />, "SEC-1 extraction", "The CBOR COSE EC2 key is decoded to a 65-byte SEC-1 0x04‖X‖Y point; non-P-256 keys (RS256) hard-fail."],
        [<PKI.IconPasskey />, "Safari gesture rule", "assertUserActivation enforces the WebKit active-user-gesture requirement — the create-button click is the gesture."],
        [<PKI.IconPlus />, "Factory deploy", "Your AccountDeployer deploys the smart account for the new passkey and returns its contractId."],
        [<PKI.IconRefresh />, "Pluggable clients", "browserWebAuthnClient and defaultCredentialStorage are defaults — pass your own WebAuthnClient / CredentialStorage."],
        [<PKI.IconCheckCircle />, "Credential persisted", "The credential id is stored so connect() can find the account later, with an in-memory fallback for Node / SSR."],
      ]} />

      {/* ───────────────────────── createPasskey ───────────────────────── */}
      <h2 className="dx-h2" id="createPasskey" style={MONO}>createPasskey()</h2>
      <p className="dx-p">Register an ES256-only passkey, extract its SEC-1 public key (RS256 hard-fails), deploy a smart account via the factory, persist the credential id, and return the account.</p>
      <CodeGroup tabs={[{ label: "signature", raw: "createPasskey(options: CreatePasskeyOptions): Promise<PasskeyCredential>",
        body: <code>{Fn("createPasskey")}(options: CreatePasskeyOptions): Promise&lt;PasskeyCredential&gt;</code> }]} />

      <h3 className="dx-h3" id="options">CreatePasskeyOptions</h3>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        [<>rpId<span className="t-req">REQ</span></>, <span className="t-type">string</span>, "Your site's registrable domain."],
        [<>rpName<span className="t-req">REQ</span></>, <span className="t-type">string</span>, "Human-readable relying-party name shown in the OS sheet."],
        [<>userName<span className="t-req">REQ</span></>, <span className="t-type">string</span>, "Account name presented to the user during registration."],
        [<>deployer<span className="t-req">REQ</span></>, <span className="t-type">AccountDeployer</span>, "Deploys the smart account for the new passkey (contract-specific)."],
        ["webauthn", <span className="t-type">WebAuthnClient</span>, "WebAuthn client; defaults to browserWebAuthnClient()."],
        ["storage", <span className="t-type">CredentialStorage</span>, "Where the credential id is persisted; defaults to defaultCredentialStorage()."],
        ["userId", <span className="t-type">Uint8Array</span>, "Optional user handle bytes; generated if omitted."],
        ["challenge", <span className="t-type">Uint8Array</span>, "Optional registration challenge; generated if omitted."],
        ["residentKey", <span className="t-type">'discouraged' | 'preferred' | 'required'</span>, "authenticatorSelection.residentKey hint."],
        ["userVerification", <span className="t-type">'discouraged' | 'preferred' | 'required'</span>, "authenticatorSelection.userVerification hint."],
        ["userActivation", <span className="t-type">{"{ isActive: boolean }"}</span>, <>Pass <code>navigator.userActivation</code> to enforce the Safari gesture rule.</>],
      ]} />

      <h3 className="dx-h3" id="credential">Returns — PasskeyCredential</h3>
      <p className="dx-p"><strong>Returns</strong> <code style={MONO}>Promise&lt;PasskeyCredential&gt;</code> — the deployed account and its passkey.</p>
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["contractId", <span className="t-type">string</span>, "C-address of the deployed smart account."],
        ["credentialId", <span className="t-type">string</span>, "WebAuthn credential id, persisted via storage for later connect()."],
        ["publicKey", <span className="t-type">Uint8Array</span>, "65-byte SEC-1 secp256r1 public key (0x04‖X‖Y)."],
      ]} />

      <CodeGroup tabs={[{ label: "register.ts", raw: "import { createPasskey } from '@soropass/core/create';\n\nconst account = await createPasskey({\n  rpId: 'app.example.com',\n  rpName: 'Example',\n  userName: 'alice@example.com',\n  deployer,                         // your AccountDeployer\n  residentKey: 'required',\n  userVerification: 'preferred',\n  userActivation: navigator.userActivation, // Safari gesture rule\n});\n\nconsole.log(account.contractId);    // C... smart-account address\nconsole.log(account.credentialId);  // persisted for connect()\nconsole.log(account.publicKey.length); // 65 (SEC-1)",
        body: <code>{Kw("import")} {"{ createPasskey }"} {Kw("from")} {St("'@soropass/core/create'")};{"\n\n"}{Kw("const")} account = {Kw("await")} {Fn("createPasskey")}({"{"}{"\n"}  rpId: {St("'app.example.com'")},{"\n"}  rpName: {St("'Example'")},{"\n"}  userName: {St("'alice@example.com'")},{"\n"}  deployer,                         {Cm("// your AccountDeployer")}{"\n"}  residentKey: {St("'required'")},{"\n"}  userVerification: {St("'preferred'")},{"\n"}  userActivation: navigator.userActivation, {Cm("// Safari gesture rule")}{"\n"}{"}"});{"\n\n"}console.{Fn("log")}(account.contractId);    {Cm("// C... smart-account address")}{"\n"}console.{Fn("log")}(account.credentialId);  {Cm("// persisted for connect()")}{"\n"}console.{Fn("log")}(account.publicKey.length); {Cm("// 65 (SEC-1)")}</code> }]} />
      <Callout kind="tip">The create button click <strong>is</strong> the WebAuthn user gesture — call <code>createPasskey</code> directly from the click handler so the registration ceremony is allowed to prompt.</Callout>

      {/* ───────────────────────── AccountDeployer ───────────────────────── */}
      <h2 className="dx-h2" id="deployer" style={MONO}>AccountDeployer</h2>
      <p className="dx-p">The contract-specific seam. <code style={MONO}>createPasskey</code> hands your deployer the extracted SEC-1 public key and credential id, and expects the deployed smart-account address back. Keeps the SDK free of any contract coupling.</p>
      <CodeGroup tabs={[{ label: "signature", raw: "interface AccountDeployer {\n  deploy(input: {\n    publicKey: Uint8Array;\n    credentialId: string;\n  }): Promise<{ contractId: string; txHash?: string }>;\n}",
        body: <code>{Kw("interface")} AccountDeployer {"{"}{"\n"}  {Fn("deploy")}(input: {"{"}{"\n"}    publicKey: Uint8Array;{"\n"}    credentialId: string;{"\n"}  {"}"}): Promise&lt;{"{ contractId: string; txHash?: string }"}&gt;;{"\n"}{"}"}</code> }]} />
      <PropsTable cols={["Field", "Type", "Description"]} rows={[
        ["input.publicKey", <span className="t-type">Uint8Array</span>, "65-byte SEC-1 public key of the new passkey."],
        ["input.credentialId", <span className="t-type">string</span>, "WebAuthn credential id to bind to the account."],
        ["→ contractId", <span className="t-type">string</span>, "C-address of the deployed smart account."],
        ["→ txHash", <span className="t-type">string?</span>, "Optional deploy transaction hash."],
      ]} />

      {/* ───────────────────────── Assertions & options ───────────────────────── */}
      <h2 className="dx-h2" id="helpers">Assertions &amp; options</h2>
      <p className="dx-p">The guards and option-builder that enforce the invariants. <code style={MONO}>createPasskey</code> calls these internally; they're exported so you can assert at your own boundaries.</p>

      <h3 className="dx-h3" id="assertES256" style={MONO}>assertES256()</h3>
      <p className="dx-p">Throws <code>ES256_NOT_SUPPORTED</code> unless <code>alg === -7</code>.</p>
      <CodeGroup tabs={[{ label: "signature", raw: "assertES256(alg: number): void",
        body: <code>{Fn("assertES256")}(alg: number): void</code> }]} />

      <h3 className="dx-h3" id="assertUserActivation" style={MONO}>assertUserActivation()</h3>
      <p className="dx-p">Throws <code>USER_CANCELLED</code> if not an active user gesture (Safari / WebKit rule).</p>
      <CodeGroup tabs={[{ label: "signature", raw: "assertUserActivation(activation?: { isActive: boolean }): void",
        body: <code>{Fn("assertUserActivation")}(activation?: {"{ isActive: boolean }"}): void</code> }]} />
      <CodeGroup tabs={[{ label: "guards.ts", raw: "import { assertES256, assertUserActivation } from '@soropass/core/create';\n\nbutton.addEventListener('click', () => {\n  assertUserActivation(navigator.userActivation); // throws USER_CANCELLED otherwise\n  assertES256(-7);                                // ok; -257 (RS256) throws\n});",
        body: <code>{Kw("import")} {"{ assertES256, assertUserActivation }"} {Kw("from")} {St("'@soropass/core/create'")};{"\n\n"}button.{Fn("addEventListener")}({St("'click'")}, () =&gt; {"{"}{"\n"}  {Fn("assertUserActivation")}(navigator.userActivation); {Cm("// throws USER_CANCELLED otherwise")}{"\n"}  {Fn("assertES256")}(-7);                                {Cm("// ok; -257 (RS256) throws")}{"\n"}{"}"});</code> }]} />

      <h3 className="dx-h3" id="buildCreateOptions" style={MONO}>buildCreateOptions()</h3>
      <p className="dx-p">Builds a <code>PublicKeyCredentialCreationOptions</code> with <code>pubKeyCredParams</code> <code>[{"{"} type:&nbsp;'public-key', alg:&nbsp;-7 {"}"}]</code> only.</p>
      <CodeGroup tabs={[{ label: "signature", raw: "buildCreateOptions(/* ... */): PublicKeyCredentialCreationOptions",
        body: <code>{Fn("buildCreateOptions")}({Cm("/* ... */")}): PublicKeyCredentialCreationOptions</code> }]} />

      {/* ───────────────────────── Clients & storage ───────────────────────── */}
      <h2 className="dx-h2" id="clients">Clients &amp; storage</h2>
      <p className="dx-p">Default, swappable adapters for the WebAuthn ceremony and credential persistence. Override either via <code>CreatePasskeyOptions.webauthn</code> / <code>.storage</code>.</p>

      <PropsTable cols={["Function", "Returns", "Description"]} rows={[
        [<span style={MONO}>browserWebAuthnClient()</span>, <span className="t-type">WebAuthnClient</span>, "navigator.credentials-backed client (the default)."],
        [<span style={MONO}>defaultCredentialStorage()</span>, <span className="t-type">CredentialStorage</span>, "localStorage with an in-memory fallback (Node / SSR)."],
      ]} />
      <CodeGroup tabs={[{ label: "signatures", raw: "browserWebAuthnClient(): WebAuthnClient\ndefaultCredentialStorage(): CredentialStorage",
        body: <code>{Fn("browserWebAuthnClient")}(): WebAuthnClient{"\n"}{Fn("defaultCredentialStorage")}(): CredentialStorage</code> }]} />
      <Callout kind="note">In Node / SSR there is no <code>localStorage</code>; <code>defaultCredentialStorage()</code> falls back to an in-memory store so the SDK stays import-safe outside the browser.</Callout>

      {/* ───────────────────────── Public-key extraction ───────────────────────── */}
      <h2 className="dx-h2" id="keys">Public-key extraction</h2>
      <p className="dx-p">The path from a WebAuthn attestation to the 65-byte SEC-1 point the contract verifies. Each step is exported so you can extract from whichever shape you hold.</p>

      <PropsTable cols={["Function", "Returns", "Description"]} rows={[
        [<span style={MONO}>coseKeyToSec1(coseKey)</span>, <span className="t-type">Uint8Array</span>, "CBOR COSE EC2 → 65-byte SEC-1 0x04‖X‖Y; enforces P-256, else throws ES256_NOT_SUPPORTED."],
        [<span style={MONO}>extractPublicKeyFromAuthData(authData)</span>, <span className="t-type">Uint8Array</span>, "Pulls the COSE key out of authenticatorData and returns the SEC-1 point."],
        [<span style={MONO}>extractPublicKeyFromAttestationObject(attestationObject)</span>, <span className="t-type">Uint8Array</span>, "Decodes the attestationObject and returns the SEC-1 point."],
      ]} />
      <CodeGroup tabs={[{ label: "signatures", raw: "coseKeyToSec1(coseKey: Uint8Array): Uint8Array\nextractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array\nextractPublicKeyFromAttestationObject(attestationObject: Uint8Array): Uint8Array",
        body: <code>{Fn("coseKeyToSec1")}(coseKey: Uint8Array): Uint8Array{"\n"}{Fn("extractPublicKeyFromAuthData")}(authData: Uint8Array): Uint8Array{"\n"}{Fn("extractPublicKeyFromAttestationObject")}(attestationObject: Uint8Array): Uint8Array</code> }]} />
      <CodeGroup tabs={[{ label: "extract.ts", raw: "import {\n  extractPublicKeyFromAttestationObject,\n} from '@soropass/core/create';\n\n// 65-byte SEC-1 point: 0x04 ‖ X ‖ Y — non-P-256 keys throw ES256_NOT_SUPPORTED\nconst publicKey = extractPublicKeyFromAttestationObject(attestationObject);",
        body: <code>{Kw("import")} {"{"}{"\n"}  extractPublicKeyFromAttestationObject,{"\n"}{"}"} {Kw("from")} {St("'@soropass/core/create'")};{"\n\n"}{Cm("// 65-byte SEC-1 point: 0x04 ‖ X ‖ Y — non-P-256 keys throw ES256_NOT_SUPPORTED")}{"\n"}{Kw("const")} publicKey = {Fn("extractPublicKeyFromAttestationObject")}(attestationObject);</code> }]} />
      <Callout kind="tip">Need the full error taxonomy? See <a href="/sdk/errors">KitError taxonomy</a> for every code these functions can throw.</Callout>

      <PageNav prev={["Overview", "/sdk"]} next={["Sign", "/sdk/sign"]} />
    </DocsPage>
  );
}
