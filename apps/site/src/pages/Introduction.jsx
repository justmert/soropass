/* Overview — the front-door page (route "/"). */
import { DocsPage, CodeGroup, Callout, PageNav, I, Kw, St, Fn, Cm } from '../shell.jsx';
import * as PKI from '../icons.jsx';

const TOC = [
  ['proven', 'Proven, not promised', 0],
  ['layer', 'Where it fits', 0],
  ['adopt', 'Two ways to adopt', 0],
  ['surface', 'Minimal surface', 0],
  ['example', 'Try it in 20 seconds', 0],
  ['box', "What's in the box", 0],
];

const LAYERS = [
  ['You', 'Your wallet / dApp', 'your product + design system', false],
  ['We are', '@soropass', 'SDK + UI + PasskeyModule', true],
  ['Through', 'stellar-wallets-kit', 'the kit you already use', false],
  ['On-chain', 'Soroban smart account', 'native secp256r1 verify', false],
];

const PROOF_URL =
  'https://stellar.expert/explorer/testnet/contract/CB3IBD2JTLOFPLT4JFJ3KOIALDTKUMGLSSDZTOK7W2YWCZTPTZU66XB2';

export default function Introduction() {
  return (
    <DocsPage active="Overview" toc={TOC}>
      <div className="dx-breadcrumb">
        Get started <I.ChevR /> <span style={{ color: 'var(--pk-color-text-muted)' }}>Overview</span>
      </div>
      <h1 className="dx-h1">
        <span className="dx-h1__glyph">
          <PKI.IconPasskey />
        </span>{' '}
        Overview
      </h1>
      <p className="dx-lead">
        A minimal passkey SDK plus drop-in create / sign / recover components for Stellar smart accounts — adopted into{' '}
        stellar-wallets-kit. Wallet teams ship passkeys without hand-rolling WebAuthn, on-chain signing, or compatibility
        logic. It is a <strong>layer, not a wallet</strong>: no accounts to manage, no balances of our own.
      </p>

      <h2 className="dx-h2" id="proven">
        Proven, not promised
      </h2>
      <Callout kind="tip">
        The secp256r1 <code>__check_auth</code> path is <strong>verified on testnet</strong>, not modeled — a real
        passkey signature authorizes a smart-account call (success), and a wrong-key signature is rejected on-chain. See
        the deployed{' '}
        <a href={PROOF_URL} target="_blank" rel="noreferrer">
          webauthn-account contract
        </a>{' '}
        and its <code>__check_auth</code> on Stellar Expert.
      </Callout>

      <h2 className="dx-h2" id="layer">
        Where it fits — a layer, not an app
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '18px 0' }}>
        {LAYERS.map(([role, name, sub, accent], i) => (
          <div key={name}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                border: '1px solid var(--pk-color-border)',
                borderRadius: 'var(--pk-radius-md)',
                background: accent ? 'var(--pk-color-brand-soft)' : 'var(--pk-color-surface)',
                borderColor: accent ? 'var(--pk-color-brand)' : 'var(--pk-color-border)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: accent ? 'var(--pk-color-brand)' : 'var(--pk-color-text-faint)',
                  width: 70,
                  flex: 'none',
                }}
              >
                {role}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 650,
                  fontFamily: accent ? 'var(--pk-font-mono)' : 'inherit',
                  color: accent ? 'var(--pk-color-brand)' : 'var(--pk-color-text)',
                }}
              >
                {name}
              </span>
              <span style={{ marginInlineStart: 'auto', fontSize: 12.5, color: 'var(--pk-color-text-muted)' }}>
                {sub}
              </span>
            </div>
            {i < LAYERS.length - 1 && (
              <span style={{ display: 'block', textAlign: 'center', color: 'var(--pk-color-border-strong)' }}>↓</span>
            )}
          </div>
        ))}
      </div>
      <p className="dx-p">
        <strong>You own your product and design system.</strong> We're the passkey layer in between — built on the
        already-deployed, audited smart-account contracts. We don't reinvent the contract layer.
      </p>

      <h2 className="dx-h2" id="adopt">
        Two ways to adopt
      </h2>
      <div className="dx-cardgroup dx-cardgroup--2">
        <a className="dx-card" href="/quickstart">
          <p className="dx-card__title">1 · Through Stellar Wallets Kit</p>
          <p className="dx-card__body">
            Register a <code>PasskeyModule</code> and passkeys appear in the standard wallet picker. Call{' '}
            <code>StellarWalletsKit.authModal()</code> / <code>.getAddress()</code> / <code>.signTransaction()</code> —
            the kit API you already use, no passkey-specific code on your side.
          </p>
        </a>
        <a className="dx-card" href="/sdk">
          <p className="dx-card__title">2 · Headless / direct</p>
          <p className="dx-card__body">
            Import <code>@soropass/core</code> straight: <code>createPasskey</code>, <code>signTransaction</code>,{' '}
            <code>recover</code>, <code>connect</code> with pluggable submission + indexer adapters. Drive the headless
            UI flows yourself, or skip the UI entirely.
          </p>
        </a>
      </div>

      <h2 className="dx-h2" id="surface">
        Minimal surface
      </h2>
      <ul className="dx-features" style={{ gridTemplateColumns: '1fr' }}>
        {[
          ['ES256-only', 'pubKeyCredParams pinned to alg −7; anything else throws ES256_NOT_SUPPORTED.'],
          ['Always low-S', 'Signatures are low-S normalized client-side — the ~50% of Apple passkeys that emit high-S still verify on-chain.'],
          ['~2 runtime deps', 'A tiny core (noble p256 + base64) — large frameworks lose RFP points, so there aren’t any.'],
          ['@stellar/stellar-sdk is a peer', 'Declared as a peer dependency and never bundled into the SDK output.'],
          ['Tree-shakeable subpaths', "Import only what you use: '@soropass/core/create', '/sign', '/recover', '/connect', '/types', '/testing'."],
        ].map(([t, d]) => (
          <li key={t}>
            <I.Ok />{' '}
            <span>
              <strong>{t}</strong> — <span style={{ color: 'var(--pk-color-text-muted)' }}>{d}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="dx-h2" id="example">
        Try it in 20 seconds
      </h2>
      <p className="dx-p dx-p--muted">
        Mock mode — zero network, no authenticator, runs in CI. The same facade swaps to <code>mode: 'real'</code> for
        production.
      </p>
      <CodeGroup
        tabs={[
          {
            label: 'demo.ts',
            raw: "import { createPasskeyKit } from '@soropass/core/testing';\n\nconst kit = createPasskeyKit({ mode: 'mock', rpId: 'localhost' });\n\nconst cred = await kit.createPasskey({ userName: 'alice' });\nconsole.log(cred.contractId); // C-address of the new smart account\n\nconst signed = await kit.signAuthEntry(entryXdr);\nconst accounts = await kit.recover(); // RecoverResult[]",
            body: (
              <code>
                {Kw('import')} {'{ createPasskeyKit }'} {Kw('from')} {St("'@soropass/core/testing'")};{'\n\n'}
                {Kw('const')} kit = {Fn('createPasskeyKit')}({'{'} mode: {St("'mock'")}, rpId: {St("'localhost'")} {'}'}
                );{'\n\n'}
                {Kw('const')} cred = {Kw('await')} kit.{Fn('createPasskey')}({'{'} userName: {St("'alice'")} {'}'});{'\n'}
                console.{Fn('log')}(cred.contractId); {Cm('// C-address of the new smart account')}
                {'\n\n'}
                {Kw('const')} signed = {Kw('await')} kit.{Fn('signAuthEntry')}(entryXdr);{'\n'}
                {Kw('const')} accounts = {Kw('await')} kit.{Fn('recover')}(); {Cm('// RecoverResult[]')}
              </code>
            ),
          },
        ]}
      />

      <h2 className="dx-h2" id="box">
        What's in the box
      </h2>
      <div className="dx-cardgroup dx-cardgroup--3">
        {[
          ['Quickstart', '/quickstart', 'Add passkey to your wallet in under 15 minutes.'],
          ['Components', '/components', 'Create / sign / recover screens, every state, drop-in.'],
          ['Compatibility', '/compatibility', 'The living matrix — what works, what breaks, fallbacks.'],
          ['SDK reference', '/sdk', 'Tiny surface, typed errors, pluggable adapters.'],
          ['How it works', '/how-it-works', 'WebAuthn → low-S → Soroban __check_auth.'],
          ['Live demo', '#', 'The components running end-to-end through the kit.'],
        ].map(([t, h, d]) => (
          <a className="dx-card" href={h} key={t}>
            <p className="dx-card__title">{t}</p>
            <p className="dx-card__body">{d}</p>
          </a>
        ))}
      </div>

      <PageNav next={['Quickstart', '/quickstart']} />
    </DocsPage>
  );
}
