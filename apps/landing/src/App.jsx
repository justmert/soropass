import { useEffect, useState } from 'react';
import RealScreen from './RealScreen.jsx';
import Demo from './Demo.jsx';

const DOCS_URL = 'https://docs.soropass.dev';
const GITHUB_URL = 'https://github.com/justmert/soropass';
const KIT_URL = 'https://github.com/Creit-Tech/Stellar-Wallets-Kit';
const EXPLORER = 'https://stellar.expert/explorer/testnet';

const PROOF = {
  factory: 'CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM',
  account: 'CDGZK67TRXJTSQL36PBBUIBKBULTGROX3ZIWVNHAY6DWEIATO2HZJ7VQ',
  successTx: '95cc2693764384f0b1b32bd5b0510573decc19b749a812a6292f9c3b272a55f6',
  failTx: '72854d4fbe602c4aadb6cfdd1ec7e48f2b6ec01c922b3fa66c6dfaaa84bc3226',
};

function Svg({ children, s = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const I = {
  passkey: () => (
    <Svg>
      <path d="M12 10a2 2 0 0 1 2 2c0 2.5-.4 5-1.2 7" />
      <path d="M8.5 6.6A6 6 0 0 1 18 12c0 1.2-.1 2.4-.3 3.5" />
      <path d="M6 12a6 6 0 0 1 .8-3" />
      <path d="M9 19c.7-1.4 1-3.3 1-5.5a2 2 0 0 1 .2-1" />
    </Svg>
  ),
  blocks: () => (
    <Svg>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <path d="M17 13v4M15 15h4" />
    </Svg>
  ),
  shield: () => (
    <Svg>
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
      <path d="M9 11.5l2 2 4-4" />
    </Svg>
  ),
  chart: () => (
    <Svg>
      <path d="M4 19V5M20 19H4" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </Svg>
  ),
};

function useTheme() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    try {
      const s = localStorage.getItem('soropass-theme');
      if (s === 'dark' || s === 'light') setTheme(s);
    } catch (e) {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('soropass-theme', theme);
    } catch (e) {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme];
}

const COVERS = [
  [I.passkey, 'Passwordless login', 'Users sign in with Face ID, Touch ID, or a security key. No passwords, no seed phrases to lose.'],
  [I.blocks, 'Drop-in, not a rebuild', 'Real create / sign / recover screens + a tiny SDK. Use our UI or yours; theme it with tokens.'],
  [I.shield, 'Proven on-chain', 'Signatures are verified by Stellar’s native secp256r1. Every claim links to a real testnet transaction.'],
  [I.chart, 'Honest compatibility', 'Passkey support is uneven across browsers. We machine-check 88 cells and show the gaps — never a fake green.'],
];

// A real-shaped preview of the living matrix (the full, dated, sourced one is in the docs).
const MX_PLATFORMS = ['Chrome', 'Edge', 'Safari', 'iOS', 'Firefox', 'Android'];
const MX_GLYPH = { 2: '✓', 1: '◐', 0: '✕', '-1': '?' };
const MX_ROWS = [
  ['PublicKeyCredential', [2, 2, 2, 2, 2, 2]],
  ['isUVPAA()', [2, 2, 2, 2, 2, 2]],
  ['ES256 (alg −7)', [2, 2, 2, 2, 2, 2]],
  ['Conditional UI', [2, 2, 2, 2, 0, 2]],
  ['Related Origin', [2, 2, 1, 1, 0, 2]],
  ['Hybrid / caBLE', [1, 1, 1, 1, -1, 1]],
];

export default function App() {
  const [theme, setTheme] = useTheme();
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="lp">
      {/* ── nav ───────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-nav__inner">
          <a className="lp-brand" href="/">
            <span className="lp-brand__glyph"><I.passkey s={18} /></span>
            <span className="lp-brand__name">soropass</span>
          </a>
          <nav className="lp-nav__links">
            <a href={DOCS_URL}>Docs</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            <button className="lp-themebtn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <a className="lp-btn lp-btn--primary" href="#demo" onClick={(e) => { e.preventDefault(); scrollTo('demo'); }}>Try the demo</a>
          </nav>
        </div>
      </header>

      {/* ── hero ──────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero__copy">
          <div className="lp-eyebrow">Passkeys for Stellar · a drop-in layer</div>
          <h1 className="lp-h1">Sign in to Stellar with <span className="lp-grad">Face ID</span> — not a seed phrase.</h1>
          <p className="lp-sub">
            Soropass lets wallet &amp; app builders add <strong>passkey accounts</strong> to Stellar. Your users create an
            account and approve transactions with Touch&nbsp;ID, Face&nbsp;ID, or a security key — you don’t build WebAuthn
            or the on-chain signing. It’s done, and proven on testnet. <strong>Try it below in under a minute.</strong>
          </p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn--primary lp-btn--lg" href="#demo" onClick={(e) => { e.preventDefault(); scrollTo('demo'); }}>
              Create a wallet live ↓
            </a>
            <a className="lp-btn lp-btn--ghost lp-btn--lg" href={DOCS_URL}>Read the docs →</a>
          </div>
          <div className="lp-trust">
            <span>no seed phrases</span><i /><span>no passwords</span><i />
            <a href={`${EXPLORER}/tx/${PROOF.successTx}`} target="_blank" rel="noreferrer">proven on testnet ↗</a>
          </div>
        </div>
        <div className="lp-hero__art">
          <div className="lp-hero__card pk">
            <RealScreen screen="create" state="success" />
          </div>
        </div>
      </section>

      {/* ── what you get ──────────────────────────────── */}
      <section className="lp-section">
        <h2 className="lp-h2">What you get</h2>
        <div className="lp-covers">
          {COVERS.map(([Icon, t, d]) => (
            <div className="lp-cover" key={t}>
              <span className="lp-cover__ic"><Icon /></span>
              <p className="lp-cover__t">{t}</p>
              <p className="lp-cover__d">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── live demo ─────────────────────────────────── */}
      <section className="lp-section lp-demo" id="demo">
        <div className="lp-demo__head">
          <h2 className="lp-h2">Create a wallet and move real XLM — with your face.</h2>
          <p className="lp-sub lp-sub--center">
            One tap: your Touch&nbsp;ID makes a passkey, a smart account is deployed on testnet, and your passkey sends a
            real <strong>25 XLM</strong> to a fresh account. ~45 seconds, nothing faked — every step links to the live
            transaction.
          </p>
        </div>
        <Demo />
      </section>

      {/* ── kit integration (short) ───────────────────── */}
      <section className="lp-section lp-kit">
        <div className="lp-kit__grid">
          <div className="lp-kit__copy">
            <h2 className="lp-h2 lp-h2--start">Plugs into the wallet picker you already use</h2>
            <p className="lp-sub">
              <a href={KIT_URL} target="_blank" rel="noreferrer">Stellar Wallets Kit</a> is the standard “Connect Wallet”
              library for Stellar apps. Register Soropass as one module and passkeys appear in that picker — no
              passkey-specific code on your side. Prefer no kit? Call the SDK directly.
            </p>
            <a className="lp-btn lp-btn--ghost" href={`${DOCS_URL}/quickstart`}>Quickstart →</a>
          </div>
          <pre className="lp-code">
            <span className="c-key">import</span> {'{ PasskeyModule }'} <span className="c-key">from</span> <span className="c-str">'@soropass/wallets-kit-module'</span>;{'\n\n'}
            <span className="c-fn">StellarWalletsKit</span>.<span className="c-fn">init</span>({'{'}{'\n'}
            {'  '}network: Networks.TESTNET,{'\n'}
            {'  '}modules: [ <span className="c-key">new</span> <span className="c-fn">PasskeyModule</span>({'{ rpId, rpName, indexer, deployer }'}) ],{'\n'}
            {'}'});{'\n\n'}
            <span className="c-com">{'// passkeys now appear in the wallet picker'}</span>
          </pre>
        </div>
      </section>

      {/* ── compatibility ─────────────────────────────── */}
      <section className="lp-section lp-compat" id="compat">
        <h2 className="lp-h2">Passkey support, measured — not guessed.</h2>
        <p className="lp-sub lp-sub--center">
          It’s uneven across browsers. We track it in a living matrix — sourced from MDN browser-compat data and
          machine-probed by a virtual-authenticator CI. Unknowns stay honest, never a fake green.
        </p>
        <div className="lp-mx">
          <div className="lp-mx__grid" style={{ gridTemplateColumns: `minmax(120px, 1.4fr) repeat(${MX_PLATFORMS.length}, 1fr)` }}>
            <div className="lp-mx__corner" />
            {MX_PLATFORMS.map((p) => (
              <div className="lp-mx__col" key={p}>{p}</div>
            ))}
            {MX_ROWS.map(([feat, cells]) => (
              <div className="lp-mx__contents" key={feat} style={{ display: 'contents' }}>
                <div className="lp-mx__feat">{feat}</div>
                {cells.map((st, i) => (
                  <div className="lp-mx__cell" key={i}>
                    <span className={`lp-mx__dot lp-mx__dot--${st}`}>{MX_GLYPH[st]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="lp-mx__foot">
            <span className="lp-mx__legend">
              <b className="lp-mx__dot--2">✓</b> supported <b className="lp-mx__dot--1">◐</b> partial{' '}
              <b className="lp-mx__dot--0">✕</b> no <b className="lp-mx__dot--n1">?</b> unprobed
            </span>
            <span className="lp-mx__fresh">88 cells · MDN BCD 8.0.0 + CI · re-probed every release</span>
          </div>
        </div>
        <a className="lp-btn lp-btn--ghost" href={`${DOCS_URL}/compatibility`}>Explore the full living matrix →</a>
      </section>

      {/* ── proof ─────────────────────────────────────── */}
      <section className="lp-section lp-proof">
        <h2 className="lp-h2">Don’t trust — verify.</h2>
        <p className="lp-sub lp-sub--center">
          The same passkey transaction, two outcomes — both real on Stellar testnet. Click through to the live chain.
        </p>
        <div className="lp-verify">
          <a className="lp-vcard lp-vcard--ok" href={`${EXPLORER}/tx/${PROOF.successTx}`} target="_blank" rel="noreferrer">
            <span className="lp-vcard__icon">✓</span>
            <span className="lp-vcard__label">Correct passkey</span>
            <span className="lp-vcard__status">VERIFIED on-chain</span>
            <code className="lp-vcard__tx">{PROOF.successTx.slice(0, 18)}…</code>
            <span className="lp-vcard__btn">View on Stellar Expert ↗</span>
          </a>
          <span className="lp-verify__vs">vs</span>
          <a className="lp-vcard lp-vcard--err" href={`${EXPLORER}/tx/${PROOF.failTx}`} target="_blank" rel="noreferrer">
            <span className="lp-vcard__icon">✕</span>
            <span className="lp-vcard__label">Wrong key</span>
            <span className="lp-vcard__status">REJECTED on-chain</span>
            <code className="lp-vcard__tx">{PROOF.failTx.slice(0, 18)}…</code>
            <span className="lp-vcard__btn">View on Stellar Expert ↗</span>
          </a>
        </div>
        <div className="lp-proofmeta">
          <a className="lp-chip" href={`${EXPLORER}/contract/${PROOF.factory}`} target="_blank" rel="noreferrer">
            Account factory <code>{PROOF.factory.slice(0, 6)}…{PROOF.factory.slice(-4)}</code> ↗
          </a>
          <a className="lp-chip" href={`${EXPLORER}/contract/${PROOF.account}`} target="_blank" rel="noreferrer">
            A created wallet <code>{PROOF.account.slice(0, 6)}…{PROOF.account.slice(-4)}</code> ↗
          </a>
          <span className="lp-chip lp-chip--cmd">reproduce · <code>pnpm exec tsx scripts/transfer-e2e.ts</code></span>
        </div>
      </section>

      {/* ── footer ────────────────────────────────────── */}
      <footer className="lp-foot">
        <div className="lp-foot__inner">
          <a className="lp-brand" href="/">
            <span className="lp-brand__glyph"><I.passkey s={18} /></span>
            <span className="lp-brand__name">soropass</span>
          </a>
          <div className="lp-foot__links">
            <a href={DOCS_URL}>Docs</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            <a href={`${DOCS_URL}/compatibility`}>Compatibility</a>
            <a href={`${DOCS_URL}/security`}>Security</a>
          </div>
          <p className="lp-foot__note">Apache-2.0 · a passkey layer for Stellar smart accounts</p>
        </div>
      </footer>
    </div>
  );
}
