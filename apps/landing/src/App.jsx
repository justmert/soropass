import { useState } from 'react';

// ── links (landing soropass.dev · docs docs.soropass.dev · demo demo.soropass.dev)
const DOCS = 'https://docs.soropass.dev/docs';
const DEMO = 'https://demo.soropass.dev';
const GH = 'https://github.com/justmert/soropass';
const QUICKSTART = `${DOCS}/quickstart`;
const COMPAT = `${DOCS}/compatibility`;
const KIT_GUIDE = `${DOCS}/wallets-kit`;
const COMPONENTS = `${DOCS}/components`;
const NPM = 'https://www.npmjs.com/package/@soropass/core';
const MAINNET_TX =
  'https://stellar.expert/explorer/public/tx/6a532cc4b69d3361646cb7902c6e1040e0e0c84555fb2effb2f5297ad5b325e1';

// ── icons (inline SVG, stroke-based, 24px grid) ─────────────────────────────
const Fp = ({ s = 15, sw = 2 }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 11a2 2 0 0 0-2 2c0 2 0 4-1 6" />
    <path d="M12 7a6 6 0 0 0-6 6c0 1 0 2-.5 3.5" />
    <path d="M12 7a6 6 0 0 1 6 6c0 1.5-.3 3-.8 4" />
    <path d="M12 11a2 2 0 0 1 2 2c0 2 .3 3.5 1 5" />
    <path d="M9 4.5a8 8 0 0 1 9 1.5" />
  </svg>
);
const Octocat = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </svg>
);
const Stroke = ({ s = 16, sw = 1.8, children, ...rest }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);
const ArrowR = ({ s = 15 }) => (
  <Stroke s={s} sw={2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);
const Play = ({ s = 15 }) => (
  <Stroke s={s}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
  </Stroke>
);
const CopyIcon = ({ s = 16 }) => (
  <Stroke s={s}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Stroke>
);
const Check = ({ s = 15 }) => (
  <Stroke s={s} sw={2.2}>
    <path d="M5 13l4 4 10-10" />
  </Stroke>
);
const Shield = ({ s = 19 }) => (
  <Stroke s={s}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </Stroke>
);
const Pkg = ({ s = 19 }) => (
  <Stroke s={s}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.3 7l8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </Stroke>
);
const Grid4 = ({ s = 19 }) => (
  <Stroke s={s} sw={1.7}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </Stroke>
);
const CodeIc = ({ s = 19 }) => (
  <Stroke s={s}>
    <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
  </Stroke>
);
const WalletIc = ({ s = 19 }) => (
  <Stroke s={s}>
    <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h12v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
    <path d="M16 13h.01" />
  </Stroke>
);
const Globe = ({ s = 16 }) => (
  <Stroke s={s}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15 15 0 0 1 0 18" />
    <path d="M12 3a15 15 0 0 0 0 18" />
  </Stroke>
);
const KeyIc = ({ s = 16 }) => (
  <Stroke s={s}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3L21 3" />
    <path d="M17 7l2 2" />
  </Stroke>
);
const PhoneIc = ({ s = 16 }) => (
  <Stroke s={s}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M12 18h.01" />
  </Stroke>
);
const MonitorIc = ({ s = 16 }) => (
  <Stroke s={s}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Stroke>
);
const ExtLink = ({ s = 14 }) => (
  <Stroke s={s}>
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Stroke>
);

// ── code samples (static, pre-highlighted) ──────────────────────────────────
const HEADLESS_CODE = `<span class="tk-kw">import</span> { createPasskey } <span class="tk-kw">from</span> <span class="tk-str">'@soropass/core/create'</span>;
<span class="tk-kw">import</span> { sendSmartWalletTx, browserPasskeySigner }
  <span class="tk-kw">from</span> <span class="tk-str">'@soropass/core/sign'</span>;

<span class="tk-cm">// mint an ES256 passkey, deploy its smart account</span>
<span class="tk-kw">const</span> account = <span class="tk-kw">await</span> createPasskey({ ...cfg, deployer });

<span class="tk-cm">// any Soroban op, authorized by Face ID or Touch ID</span>
<span class="tk-kw">const</span> res = <span class="tk-kw">await</span> sendSmartWalletTx({
  operation,
  rpcUrl, networkPassphrase,
  sign: browserPasskeySigner({
    rpId,
    allowCredentials: [account.credentialId],
  }),
});

<span class="tk-cm">// res.hash -&gt; on Stellar Expert</span>`;

const KIT_CODE = `<span class="tk-kw">import</span> { PasskeyModule, PASSKEY_ID }
  <span class="tk-kw">from</span> <span class="tk-str">'@creit.tech/stellar-wallets-kit/modules/passkey'</span>;
<span class="tk-kw">import</span> { StellarWalletsKit }
  <span class="tk-kw">from</span> <span class="tk-str">'@creit.tech/stellar-wallets-kit/sdk'</span>;

<span class="tk-cm">// your wallet, your brand, in the kit picker</span>
<span class="tk-kw">const</span> passkey = <span class="tk-kw">new</span> PasskeyModule({
  rpId: location.hostname,
  productName: <span class="tk-str">'Acme Wallet'</span>,
  networkPassphrase, deployer, indexer,
});
StellarWalletsKit.init({ network, modules: [passkey] });

<span class="tk-cm">// the calls you already use, now passkey-backed</span>
StellarWalletsKit.setWallet(PASSKEY_ID);
<span class="tk-kw">const</span> { address } = <span class="tk-kw">await</span> StellarWalletsKit.getAddress();
<span class="tk-kw">const</span> { signedTxXdr } = <span class="tk-kw">await</span> StellarWalletsKit
  .signTransaction(txXdr, { address });`;

// ── compatibility matrix teaser (full matrix lives in the docs) ─────────────
const MX_COLS = ['Chrome', 'Edge', 'Safari', 'Firefox', 'iOS', 'Android'];
const MX_ROWS = [
  ['isUVPAA', ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']],
  ['ES256 (-7)', ['ok', 'ok', 'ok', 'part', 'ok', 'ok']],
  ['Conditional UI', ['ok', 'ok', 'ok', 'no', 'ok', 'part']],
  ['Hybrid transport', ['ok', 'ok', 'part', 'no', 'ok', 'part']],
];
const GLYPH = { ok: '✓', part: '◐', no: '✕' };

function IconTile({ tone = 'brand', children }) {
  return <span className={`sp-icontile sp-icontile--${tone}`}>{children}</span>;
}

function CopyChip({ text, className = '', prompt = true }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <button type="button" className={`sp-cmd ${className}`} onClick={copy}>
      {prompt && <span className="sp-cmd__prompt">$</span>}
      <span className="sp-cmd__text">{text}</span>
      <span className="sp-cmd__copy">{copied ? <Check s={15} /> : <CopyIcon s={16} />}</span>
    </button>
  );
}

export default function App() {
  return (
    <div className="sp-page">
      {/* ── NAV ─────────────────────────────────────────── */}
      <div className="sp-nav">
        <div className="sp-nav__inner">
          <a className="sp-brand" href="/">
            <span className="sp-brandmark">
              <Fp s={15} />
            </span>
            <span className="sp-brandname">SoroPass</span>
          </a>
          <div className="sp-navright">
            <a className="sp-navlink" href={DOCS} target="_blank" rel="noopener noreferrer">
              Docs
            </a>
            <a className="sp-navlink" href={DEMO} target="_blank" rel="noopener noreferrer">
              Live demo
            </a>
            <a className="sp-navlink" href={COMPAT} target="_blank" rel="noopener noreferrer">
              Compatibility
            </a>
            <a className="sp-navlink" href={KIT_GUIDE} target="_blank" rel="noopener noreferrer">
              Wallets Kit
            </a>
            <a className="sp-navbtn" href={GH} target="_blank" rel="noopener noreferrer">
              <Octocat s={14} /> GitHub
            </a>
          </div>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────── */}
      <div className="sp-hero">
        <div className="sp-hero__copy">
          <span className="sp-badge">
            <span className="sp-badge__dot" /> Live on mainnet &middot; on npm today
          </span>
          <h1 className="sp-h1">Add passkey sign-in to your Stellar wallet.</h1>
          <p className="sp-sub">
            SoroPass is a layer, not a wallet: you keep your brand, your UI, and your users, and add
            passkey sign-in through one module in the stellar-wallets-kit picker. Users approve
            payments with Face ID or Touch ID, no seed phrase to write down, and their Soroban smart
            account verifies every signature on-chain.
          </p>
          <div className="sp-ctarow">
            <a
              className="sp-btn sp-btn--brand"
              href={QUICKSTART}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get started <ArrowR s={15} />
            </a>
            <a
              className="sp-btn sp-btn--white"
              href={DEMO}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Play s={15} /> Try the live demo
            </a>
          </div>
          <CopyChip text="npm i @soropass/core" className="sp-cmd--hero" />
        </div>

        {/* kit picker mock with touch id sheet */}
        <div className="sp-pickerwrap">
          <div className="sp-picker">
            <div className="sp-picker__head">
              <span>Connect a wallet</span>
              <span className="sp-picker__x">&times;</span>
            </div>
            <div className="sp-picker__list">
              <div className="sp-pickrow">
                <span className="sp-picktile">
                  <Globe s={16} />
                </span>
                <span className="sp-pickrow__name">Browser wallet</span>
              </div>
              <div className="sp-pickrow">
                <span className="sp-picktile">
                  <KeyIc s={16} />
                </span>
                <span className="sp-pickrow__name">Hardware wallet</span>
              </div>
              <div className="sp-pickrow sp-pickrow--active">
                <span className="sp-picktile sp-picktile--brand">
                  <Fp s={17} />
                </span>
                <span className="sp-pickrow__info">
                  <span className="sp-pickrow__name sp-pickrow__name--strong">Acme Wallet</span>
                  <span className="sp-pickrow__sub">Sign in with a passkey</span>
                </span>
                <span className="sp-pickrow__ok">
                  <Check s={15} />
                </span>
              </div>
              <div className="sp-pickrow">
                <span className="sp-picktile">
                  <PhoneIc s={16} />
                </span>
                <span className="sp-pickrow__name">Mobile wallet</span>
              </div>
            </div>
          </div>
          <div className="sp-touchsheet">
            <span className="sp-touchsheet__icon">
              <Fp s={25} sw={1.8} />
            </span>
            <span className="sp-touchsheet__t">Confirm with Touch ID</span>
            <span className="sp-touchsheet__s">Send 25 XLM from your smart account</span>
          </div>
        </div>
      </div>

      {/* ── PROOF BAND ──────────────────────────────────── */}
      <div className="sp-proof">
        <a className="sp-proofcard" href={MAINNET_TX} target="_blank" rel="noopener noreferrer">
          <div className="sp-proofcard__head">
            <IconTile tone="green">
              <Shield s={19} />
            </IconTile>
            <span>Proven on mainnet</span>
          </div>
          <p>
            A real passkey signed a mainnet payment; a wrong key was rejected by the chain. Both on
            Stellar Expert.
          </p>
          <span className="sp-proofcard__meta">tx 6a532cc4&hellip;b325e1 &#8599;</span>
        </a>
        <a className="sp-proofcard" href={NPM} target="_blank" rel="noopener noreferrer">
          <div className="sp-proofcard__head">
            <IconTile tone="brand">
              <Pkg s={19} />
            </IconTile>
            <span>Install it today</span>
          </div>
          <p>
            <code>@soropass/core</code> is on npm, Apache-2.0, with two runtime deps and stellar-sdk
            as a peer.
          </p>
          <span className="sp-proofcard__meta">v0.3.1 &middot; ESM + CJS + types</span>
        </a>
        <a className="sp-proofcard" href={COMPAT} target="_blank" rel="noopener noreferrer">
          <div className="sp-proofcard__head">
            <IconTile tone="amber">
              <Grid4 s={19} />
            </IconTile>
            <span>Built on the matrix</span>
          </div>
          <p>
            Every fallback comes from a living compatibility matrix, probed in CI across browser
            engines.
          </p>
          <span className="sp-proofcard__meta">docs.soropass.dev/compatibility &#8599;</span>
        </a>
      </div>

      {/* ── INSTALL & INTEGRATE ─────────────────────────── */}
      <div className="sp-install" id="install">
        <div className="sp-sechead">
          <span className="sp-eyebrow">INSTALL &amp; INTEGRATE</span>
          <h2 className="sp-h2">One install. Two ways in.</h2>
          <p className="sp-sechead__sub">
            Same passkey engine underneath. Go headless and own every pixel, or register one module
            in Stellar Wallets Kit and keep the calls you already use.
          </p>
        </div>

        <CopyChip
          text={'npm i @soropass/core "@stellar/stellar-sdk@>=17"'}
          className="sp-cmd--bar"
        />

        <div className="sp-ways">
          <div className="sp-way">
            <div className="sp-way__head">
              <IconTile tone="brand">
                <CodeIc s={19} />
              </IconTile>
              <span className="sp-way__info">
                <span className="sp-way__t">Headless SDK</span>
                <span className="sp-way__s">You own the UI. Four calls cover the lifecycle.</span>
              </span>
            </div>
            <div className="sp-codewin">
              <div className="sp-codewin__bar">
                <span />
                <span />
                <span />
                <span className="sp-codewin__name">headless.ts</span>
              </div>
              <pre className="sp-code" dangerouslySetInnerHTML={{ __html: HEADLESS_CODE }} />
            </div>
            <div className="sp-way__foot">
              <span className="sp-way__pkg">@soropass/core &middot; any framework, or none</span>
              <a href={QUICKSTART} target="_blank" rel="noopener noreferrer">
                Quickstart &#8594;
              </a>
            </div>
          </div>

          <div className="sp-way">
            <div className="sp-way__head">
              <IconTile tone="brand">
                <WalletIc s={19} />
              </IconTile>
              <span className="sp-way__info">
                <span className="sp-way__t">Via Stellar Wallets Kit</span>
                <span className="sp-way__s">
                  One module, your brand in the picker. Kit calls unchanged.
                </span>
              </span>
            </div>
            <div className="sp-codewin">
              <div className="sp-codewin__bar">
                <span />
                <span />
                <span />
                <span className="sp-codewin__name">wallets-kit.ts</span>
              </div>
              <pre className="sp-code" dangerouslySetInnerHTML={{ __html: KIT_CODE }} />
            </div>
            <div className="sp-way__foot">
              <span className="sp-way__pkg">
                PasskeyModule &middot; kit v2.6.0 &middot; proposed upstream
              </span>
              <a href={KIT_GUIDE} target="_blank" rel="noopener noreferrer">
                Integration guide &#8594;
              </a>
            </div>
          </div>
        </div>

        <div className="sp-uistrip">
          <IconTile tone="green">
            <Stroke s={19}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </Stroke>
          </IconTile>
          <span className="sp-uistrip__text">
            Either way, drop-in <strong>create / sign / recover / add-device</strong> screens are
            one import away with <code>@soropass/ui</code>: every state handled, themed by
            tokens.css.
          </span>
          <a href={COMPONENTS} target="_blank" rel="noopener noreferrer">
            Components &#8594;
          </a>
        </div>
      </div>

      {/* ── HOW IT FITS ─────────────────────────────────── */}
      <div className="sp-fits">
        <div className="sp-sechead">
          <span className="sp-eyebrow">HOW IT FITS</span>
          <h2 className="sp-h2 sp-h2--md">
            A thin layer between your app and Stellar. Never a custodian.
          </h2>
        </div>
        <div className="sp-pipe">
          <div className="sp-node">
            <div className="sp-node__t">
              <MonitorIc s={16} /> Your wallet / dApp
            </div>
            <div className="sp-node__d">Embeds the SDK or the kit module.</div>
          </div>
          <span className="sp-arrow">&#8594;</span>
          <div className="sp-node sp-node--brand">
            <div className="sp-node__t">
              <Fp s={16} /> SoroPass
            </div>
            <div className="sp-node__d">Passkey SDK + drop-in UI + kit module.</div>
          </div>
          <span className="sp-arrow">&#8594;</span>
          <div className="sp-node">
            <div className="sp-node__t sp-mono">
              <WalletIc s={16} /> stellar-wallets-kit
            </div>
            <div className="sp-node__d">The standard wallet connector.</div>
          </div>
          <span className="sp-arrow">&#8594;</span>
          <div className="sp-node">
            <div className="sp-node__t">
              <Shield s={16} /> Soroban smart account
            </div>
            <div className="sp-node__d">Verifies the passkey signature on-chain.</div>
          </div>
        </div>
        <div className="sp-pills">
          <span className="sp-pill">
            <Check s={13} /> No custody of funds
          </span>
          <span className="sp-pill">
            <Check s={13} /> No key storage
          </span>
          <span className="sp-pill">
            <Check s={13} /> No infra to run
          </span>
          <span className="sp-pill">
            <Check s={13} /> Multi-device recovery on-chain
          </span>
        </div>
      </div>

      {/* ── COMPATIBILITY ───────────────────────────────── */}
      <div className="sp-compat" id="compat">
        <div className="sp-compat__head">
          <div className="sp-sechead">
            <span className="sp-eyebrow">COMPATIBILITY</span>
            <h2 className="sp-h2 sp-h2--md">What works where, probed, not promised.</h2>
          </div>
          <a className="sp-morelink" href={COMPAT} target="_blank" rel="noopener noreferrer">
            Explore the full matrix &#8594;
          </a>
        </div>
        <div className="sp-mxwrap">
          <div className="sp-mx">
            <div className="sp-mx__h sp-mx__h--cap">CAPABILITY</div>
            {MX_COLS.map((c) => (
              <div className="sp-mx__h" key={c}>
                {c}
              </div>
            ))}
            {MX_ROWS.map(([cap, cells]) => (
              <div className="sp-mx__row" key={cap}>
                <div className="sp-mx__cap">{cap}</div>
                {cells.map((status, i) => (
                  <div className={`sp-mx__cell sp-mx__cell--${status}`} key={i}>
                    {GLYPH[status]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KIT CTA ─────────────────────────────────────── */}
      <div className="sp-cta">
        <div className="sp-cta__copy">
          <h2 className="sp-cta__t">Your brand in the picker, one module away.</h2>
          <p>
            The PasskeyModule implements the kit&apos;s ModuleInterface (kit v2.6.0) and is proposed
            upstream; until it lands in a kit release, the same flows run through @soropass/core
            directly. Try it in the live demo, then follow the integration guide.
          </p>
          <div className="sp-ctarow">
            <a
              className="sp-btn sp-btn--brand"
              href={KIT_GUIDE}
              target="_blank"
              rel="noopener noreferrer"
            >
              Kit integration guide <ArrowR s={14} />
            </a>
            <a
              className="sp-btn sp-btn--white"
              href={DEMO}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExtLink s={14} /> demo.soropass.dev
            </a>
          </div>
        </div>
        <div className="sp-ctachip">
          <span className="sp-ctachip__icon">
            <Fp s={18} sw={1.8} />
          </span>
          <span className="sp-ctachip__info">
            <span className="sp-ctachip__t">Acme Wallet</span>
            <span className="sp-ctachip__s">in the wallet picker</span>
          </span>
          <span className="sp-ctachip__ok">
            <Check s={15} />
          </span>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <div className="sp-foot">
        <div className="sp-foot__inner">
          <span>SoroPass &middot; Apache-2.0 &middot; Developed by Mert K&ouml;kl&uuml;</span>
          <span className="sp-mono sp-foot__links">
            <a href={DOCS} target="_blank" rel="noopener noreferrer">
              docs.soropass.dev
            </a>{' '}
            &middot;{' '}
            <a href={DEMO} target="_blank" rel="noopener noreferrer">
              demo.soropass.dev
            </a>{' '}
            &middot;{' '}
            <a href={GH} target="_blank" rel="noopener noreferrer">
              github.com/justmert/soropass
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
