/* Security — threat model for @soropass/core (v2 spine).
   Sourced from docs/security/threat-model.md + onchain-verification.md — no invented threats. */
import React from 'react';
import { DocsPage, Callout, PropsTable, PageNav, I, Kw, St, Fn, Cm } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const TOC = [
  ['low-s', 'Low-S enforcement', 0],
  ['challenge', 'Challenge & replay', 0],
  ['rp-id', 'RP-ID & origin binding', 0],
  ['recovery', 'Recovery model', 0],
  ['summary', 'Threat model summary', 0],
];

const PROOF =
  'https://stellar.expert/explorer/testnet/contract/CB3IBD2JTLOFPLT4JFJ3KOIALDTKUMGLSSDZTOK7W2YWCZTPTZU66XB2';

/* Equation card — same visual language as How it works */
function EqCard({ children }) {
  return (
    <div
      style={{
        border: '1px solid var(--pk-color-border-strong)',
        borderRadius: 'var(--pk-radius-md)',
        background: 'var(--pk-color-surface-sunken)',
        padding: '18px 22px',
        margin: '18px 0',
        textAlign: 'center',
        fontFamily: 'var(--pk-font-mono)',
        fontSize: 15,
        color: 'var(--pk-color-text)',
        overflowX: 'auto',
      }}
    >
      {children}
    </div>
  );
}

/* Trust-boundary flow: who is trusted, who is not */
function BoundaryFlow() {
  const nodes = [
    ['Authenticator', false],
    ['Browser · RP JS', false],
    ['@soropass/core', false],
    ['Submission / indexer', false],
    ['__check_auth', true],
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '18px 0' }}>
      {nodes.map(([n, authority], i) => (
        <React.Fragment key={n}>
          <div
            style={{
              border: `1px solid ${authority ? 'var(--pk-color-brand)' : 'var(--pk-color-border)'}`,
              borderRadius: 'var(--pk-radius-md)',
              background: authority ? 'var(--pk-color-brand-soft)' : 'var(--pk-color-surface)',
              color: authority ? 'var(--pk-color-brand)' : 'var(--pk-color-text)',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--pk-font-mono)',
            }}
          >
            {n}
          </div>
          {i < nodes.length - 1 && <span style={{ color: 'var(--pk-color-text-faint)' }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Security() {
  return (
    <DocsPage active="Security" toc={TOC}>
      <div className="dx-breadcrumb">
        Docs <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Security</span>
      </div>
      <h1 className="dx-h1">
        <span className="dx-h1__glyph">
          <PKI.IconShield />
        </span>{' '}
        Security
      </h1>
      <p className="dx-lead">
        The threat model for <code>@soropass/core</code>. Each mitigation is backed by a concrete test or living-matrix
        row, and the on-chain verification path is proven against a real <code>__check_auth</code> on Stellar testnet —
        not a JS model.
      </p>

      <p className="dx-p dx-p--muted">
        Trust flows left to right. The authenticator, the browser, your relayer and your indexer are all
        outside the trust boundary — the deployed contract&apos;s <code>__check_auth</code> is the ultimate authority and
        verifies the signature and its challenge-binding regardless of how every layer before it behaved.
      </p>
      <BoundaryFlow />

      {/* ── Low-S ───────────────────────────────────────────── */}
      <h2 className="dx-h2" id="low-s">
        Low-S enforcement
      </h2>
      <p className="dx-p">
        ECDSA signatures are malleable: for a signature <code>(r, s)</code>, the reflected value <code>(r, n−s)</code>{' '}
        verifies just as well. Roughly <strong>50% of Apple Touch ID / Face ID assertions are high-S</strong>, and
        Soroban&apos;s <code>secp256r1_verify</code> host function does <strong>not</strong> reject high-S signatures — so
        canonicality is the SDK&apos;s responsibility, not the chain&apos;s.
      </p>
      <p className="dx-p">
        Invariant #2: the SDK <strong>always</strong> low-S normalizes client-side (<code>S &gt; n/2 → n−S</code>) before
        assembling the authorization entry. A verifier that <em>does</em> enforce low-S still accepts our signatures, and
        any on-chain identity or replay logic keyed on the signature bytes stays stable. We additionally recommend the
        contract reject non-canonical S as defense-in-depth.
      </p>
      <EqCard>
        DER ECDSA → R‖S (64 bytes) → if S &gt; n/2 then S = n−S <Cm>{'// derToCompactLowS'}</Cm>
      </EqCard>
      <p className="dx-p dx-p--muted">
        Proven both directions in <code>anchors.test.ts</code> (anchor <code>low-s-normalization</code>): high-S in →
        low-S out, and a non-normalized signature is rejected by a low-S enforcer.
      </p>
      <Callout kind="tip">
        For the full geometry — the number line, the <code>n/2</code> midpoint and the reflection — see the low-S
        explainer in <a href="/how-it-works">How it works → ES256 + low-S</a>.
      </Callout>

      {/* ── Challenge & replay ──────────────────────────────── */}
      <h2 className="dx-h2" id="challenge">
        Challenge &amp; replay
      </h2>
      <p className="dx-p">
        The WebAuthn <code>challenge</code> the SDK signs is not a random nonce — it <strong>is</strong> the Soroban
        auth-entry preimage hash. That binds every assertion to a single network, nonce, expiration ledger and exact
        invocation, so a signature can never be replayed against a different call.
      </p>
      <EqCard>
        challenge = base64url( SHA256( XDR( SorobanAuthorization{'{'} networkId, nonce, sigExpLedger, invocation {'}'} ) )
        )
      </EqCard>
      <p className="dx-p">
        On-chain, <code>__check_auth</code> re-derives the same preimage and asserts{' '}
        <code>clientDataJSON.challenge == base64url(signature_payload)</code>. If the SDK or the contract sees a mismatch
        it fails closed with <code>CHALLENGE_MISMATCH</code>. The reference verifier{' '}
        <code>referenceCheckAuth</code> mirrors the contract; <code>soroban.test.ts</code> proves a signature over the
        wrong challenge — or signed under the wrong network passphrase — is rejected.
      </p>
      <Callout kind="note">
        <code>signCount</code> is parsed but <strong>never</strong> hard-gated. Synced passkeys (iCloud Keychain, Google
        Password Manager) report <code>signCount = 0</code> or unreliable counters, so counter-based cloning detection is
        not viable and would break legitimate users. It is surfaced, not enforced.
      </Callout>

      {/* ── RP-ID & origin ──────────────────────────────────── */}
      <h2 className="dx-h2" id="rp-id">
        RP-ID &amp; origin binding
      </h2>
      <p className="dx-p">
        Passkeys are scoped to an eTLD+1 — the RP-ID. Two independent checks pin an assertion to your origin:
      </p>
      <PropsTable
        cols={['Check', 'What it verifies', 'Error code']}
        rows={[
          [
            <span className="t-type">verifyRpIdHash</span>,
            <>
              <code>authData.rpIdHash === SHA256(rpId)</code> — the authenticator signed for your RP-ID, not a spoofed
              one.
            </>,
            <span className="t-type">RP_ID_MISMATCH</span>,
          ],
          [
            <span className="t-type">origin allow-list</span>,
            <>
              <code>clientDataJSON.origin</code> is checked against the allowed origins — the assertion came from a page
              you control.
            </>,
            <span className="t-type">ORIGIN_MISMATCH</span>,
          ],
        ]}
      />
      <p className="dx-p">
        Multi-origin products use <strong>Related Origin Requests</strong> — a <code>/.well-known/webauthn</code>{' '}
        document listing allowed <code>origins</code> (browsers honor roughly five labels). Its browser support is
        tracked as a verified row in the{' '}
        <a href="/compatibility">living compatibility matrix</a> (<code>related_origin_requests</code>) rather than
        assumed. The residual risk is structural: a passkey bound to a single domain becomes unusable if that domain is
        lost — which is why recovery recommends a second signer on a different domain or device.
      </p>

      {/* ── Recovery ────────────────────────────────────────── */}
      <h2 className="dx-h2" id="recovery">
        Recovery model
      </h2>
      <p className="dx-p">
        There is no seed phrase to back up — so recovery is about finding the accounts a credential already controls,
        and about adding signers safely. The <code>recover()</code> ceremony performs a{' '}
        <strong>discoverable-credential</strong> assertion (no stored credential id) and resolves the resulting
        credential through an indexer to every account it controls.
      </p>
      <PropsTable
        cols={['Credential type', 'Survives device loss?', 'Trade-off']}
        rows={[
          [
            <span className="t-type">Synced (default)</span>,
            'Yes — via the platform cloud',
            'You trust the platform provider (iCloud Keychain / Google Password Manager).',
          ],
          [
            <span className="t-type">Device-bound</span>,
            'No — lost with the device',
            'Stronger isolation, but requires a backup signer.',
          ],
          [
            <span className="t-type">Multi-signer (recommended)</span>,
            'Yes — any one signer recovers',
            'A second passkey on another device/domain, an Ed25519 backup key, or an OZ policy signer.',
          ],
        ]}
      />
      <Callout kind="warn">
        <strong>Add-device is an account-takeover path.</strong> Adding a new signer grants it the power to authorize the
        account, so the add-device flow must be gated behind a fresh re-authentication with an existing signer — never an
        unauthenticated mutation. The styled add-device screen requires that re-auth before it will submit.
      </Callout>
      <p className="dx-p dx-p--muted">
        The smart account itself supports multiple signers; <code>recover()</code> finds all accounts a credential
        controls (<code>ceremonies.test.ts</code>, matrix <code>conditional_mediation</code>).
      </p>

      {/* ── Summary ─────────────────────────────────────────── */}
      <h2 className="dx-h2" id="summary">
        Threat model summary
      </h2>
      <p className="dx-p dx-p--muted">
        Every row maps to a backing test (<code>security.test.ts</code> fails the build if a cited test or anchor id does
        not exist) or a verified matrix row.
      </p>
      <PropsTable
        cols={['Threat', 'Mitigation', 'Where it lives']}
        rows={[
          [
            'Signature malleability (high-S)',
            <>
              Client-side low-S normalization (<code>S &gt; n/2 → n−S</code>); recommend the contract reject
              non-canonical S.
            </>,
            <span className="t-type">anchors.test.ts · anchor low-s-normalization</span>,
          ],
          [
            'Replay / wrong-context signing',
            <>
              Challenge = auth-entry preimage; SDK + <code>__check_auth</code> reject mismatches.
            </>,
            <span className="t-type">soroban.test.ts · CHALLENGE_MISMATCH</span>,
          ],
          [
            'Non-ES256 credential (unverifiable on-chain)',
            <>
              RS256 / other algorithms hard-fail at create-time (<code>ES256_NOT_SUPPORTED</code>).
            </>,
            <span className="t-type">anchors.test.ts · anchor rs256-hard-fail</span>,
          ],
          [
            'RP-ID spoofing',
            <>
              <code>verifyRpIdHash</code>: <code>authData.rpIdHash === SHA256(rpId)</code>.
            </>,
            <span className="t-type">authData.test.ts · matrix webauthn</span>,
          ],
          [
            'Origin spoofing',
            <>
              <code>clientDataJSON.origin</code> allow-list (<code>ORIGIN_MISMATCH</code>).
            </>,
            <span className="t-type">clientData.test.ts · matrix related_origin_requests</span>,
          ],
          [
            'Ceremony auto-trigger / Safari silent reject',
            <>
              User-activation guard (<code>USER_CANCELLED</code>).
            </>,
            <span className="t-type">anchors.test.ts · anchor apple-user-gesture</span>,
          ],
          [
            'Lost device / cleared storage',
            <>
              Discoverable-credential <code>recover()</code> → indexer resolution.
            </>,
            <span className="t-type">ceremonies.test.ts · matrix conditional_mediation</span>,
          ],
          [
            'Malicious relayer / indexer',
            'Untrusted, pluggable adapters — cannot forge an authorization; at most they delay submission or mis-report a lookup.',
            <span className="t-type">submission / indexer adapters (S12)</span>,
          ],
        ]}
      />

      <Callout kind="tip">
        This is not just a JS model. A <code>SorobanAuthorizationEntry</code> assembled and signed by{' '}
        <code>@soropass/core</code> was accepted by a real deployed <code>__check_auth</code> on Stellar testnet — the{' '}
        <strong>positive</strong> run (the account&apos;s registered P-256 key) succeeded and the{' '}
        <strong>negative</strong> run (a different key) was trapped by the host <code>secp256r1_verify</code>. See the
        on-chain proof contract{' '}
        <a href={PROOF} target="_blank" rel="noreferrer">
          on stellar.expert <PKI.IconExternal />
        </a>
        .
      </Callout>

      <PageNav prev={['How it works', '/how-it-works']} next={['Compatibility', '/compatibility']} />
    </DocsPage>
  );
}
