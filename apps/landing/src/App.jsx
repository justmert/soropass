import { useState } from 'react';
import Flow1CreateSpend from './flows/Flow1CreateSpend.jsx';
import Flow2DappAction from './flows/Flow2DappAction.jsx';
import Flow3SignMessage from './flows/Flow3SignMessage.jsx';

// ── links (landing soropass.dev · docs docs.soropass.dev) ───────────────────
const DOCS = 'https://docs.soropass.dev/docs';
const ARCH = 'https://soropass.notion.site/';
const GH = 'https://github.com/justmert/soropass';
const KIT = 'https://github.com/Creit-Tech/Stellar-Wallets-Kit';
const KIT_ISSUES = `${KIT}/issues/95`;
const PASSKEYKIT_ISSUES = 'https://github.com/kalepail/passkey-kit/issues/32';

// ── icons (inline SVG, matching the handoff) ────────────────────────────────
const Fp = ({ s = 15, sw = 1.8 }) => (
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
const ListIcon = ({ s = 15 }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 5h12M4 12h16M4 19h9" />
  </svg>
);
const Speech = ({ s = 13 }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </svg>
);
const Grid = ({ s = 24 }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </svg>
);
const Code = ({ s = 24, sw = 1.8 }) => (
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
  >
    <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
  </svg>
);
const Users = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="oklch(0.6 0.01 271)"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.85" />
  </svg>
);
const Bolt = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="oklch(0.6 0.01 271)" aria-hidden="true">
    <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
  </svg>
);
const Palette = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="oklch(0.6 0.01 271)"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="13.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="12.5" r="2.5" />
    <circle cx="8.5" cy="7.5" r="2.5" />
    <circle cx="6.5" cy="13.5" r="2.5" />
    <path d="M12 22a10 10 0 1 1 10-10c0 2-2 3-4 3h-1a2 2 0 0 0-1 3.5A2 2 0 0 1 12 22z" />
  </svg>
);
const Target = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="oklch(0.6 0.01 271)"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.6" fill="oklch(0.6 0.01 271)" />
  </svg>
);

// ── compatibility matrix data (from the handoff dataset) ────────────────────
const MX_COLS = ['Chrome', 'Edge', 'Safari', 'Firefox', 'iOS', 'Android'];
const GLYPH = { ok: '✓', part: '◐', no: '✕' };
const MX_ROWS = [
  [
    'isUVPAA',
    [
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['ok', 'bcd'],
      ['ok', 'ci'],
      ['ok', 'ci'],
    ],
  ],
  [
    'ES256 (−7)',
    [
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['part', 'bcd'],
      ['ok', 'ci'],
      ['ok', 'ci'],
    ],
  ],
  [
    'Conditional UI',
    [
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['no', 'bcd'],
      ['ok', 'ci'],
      ['part', 'bcd'],
    ],
  ],
  [
    'Resident keys',
    [
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['part', 'bcd'],
      ['ok', 'ci'],
      ['ok', 'ci'],
    ],
  ],
  [
    'Hybrid transport',
    [
      ['ok', 'ci'],
      ['ok', 'ci'],
      ['part', 'bcd'],
      ['no', 'bcd'],
      ['ok', 'ci'],
      ['ok', 'bcd'],
    ],
  ],
];

function GhCard({ href, repo, name, title, desc }) {
  return (
    <a className="sp-ghcard" href={href} target="_blank" rel="noopener noreferrer">
      <div className="sp-ghcard__top">
        <div className="sp-ghrepo">
          <Octocat s={19} />
          <span>
            {repo} / <strong>{name}</strong>
          </span>
        </div>
        <span className="sp-openpill">
          <span /> Open
        </span>
      </div>
      <div className="sp-ghcard__title">{title}</div>
      <div className="sp-ghcard__desc">{desc}</div>
      <div className="sp-ghcard__foot">
        <span className="sp-ghthread">
          <Speech /> discussion thread
        </span>
        <span className="sp-ghjoin">Join the discussion ↗</span>
      </div>
    </a>
  );
}

function Frame({ children }) {
  return (
    <div className="sp-frame">
      <div className="sp-frame__body">{children}</div>
    </div>
  );
}

function Thread({ label }) {
  return (
    <div className="sp-thread">
      <div className="sp-thread__line" />
      <span className="sp-thread__pill">
        <Fp s={13} /> {label}
      </span>
      <div className="sp-thread__line" />
    </div>
  );
}

export default function App() {
  const [wallet, setWallet] = useState(null);

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
            <a className="sp-navlink" href={ARCH} target="_blank" rel="noopener noreferrer">
              Architecture
            </a>
            <a className="sp-navbtn" href={DOCS} target="_blank" rel="noopener noreferrer">
              <ListIcon /> Docs
            </a>
            <a
              className="sp-navbtn sp-navbtn--dark"
              href={GH}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Octocat /> GitHub
            </a>
          </div>
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────── */}
      <div className="sp-hero">
        <div className="sp-hero__grid">
          <div>
            <div className="sp-eyebrow-pill">
              <span className="sp-dot" /> open-source · built to plug into stellar-wallets-kit
            </div>
            <h1 className="sp-h1">
              The passkey layer for
              <br />
              Soroban smart accounts.
            </h1>
            <p className="sp-sub">
              A minimal, composable SDK and drop-in create / sign / recover components, built on a
              living map of what actually works across devices, browsers, and hardware. Designed to
              plug into <code className="sp-codechip">stellar-wallets-kit</code>, so any wallet
              could ship passkeys without rebuilding.
            </p>
            <div className="sp-btnrow">
              <a
                className="sp-btn sp-btn--brand"
                href={DOCS}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit docs
              </a>
              <a
                className="sp-btn sp-btn--white"
                href={GH}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Octocat s={16} /> See on GitHub
              </a>
              <a className="sp-btn sp-btn--white" href="#usecases">
                <span className="sp-play">
                  <i />
                </span>{' '}
                Watch the demo
              </a>
              <a
                className="sp-btn sp-btn--ghost"
                href={ARCH}
                target="_blank"
                rel="noopener noreferrer"
              >
                Technical architecture →
              </a>
            </div>
          </div>

          <div className="sp-ghcards">
            <div className="sp-ghnote">// we started the conversation upstream, in the open</div>
            <GhCard
              href={KIT_ISSUES}
              repo="Creit-Tech"
              name="stellar-wallets-kit"
              title="Proposing a first-class passkey module"
              desc="An RFC to register SoroPass in the standard wallets kit, so any kit-based Stellar wallet can offer passkey sign-in."
            />
            <GhCard
              href={PASSKEYKIT_ISSUES}
              repo="kalepail"
              name="passkey-kit"
              title="Built on passkey-kit's secp256r1 work"
              desc="SoroPass ports passkey-kit's WebAuthn ceremony and low-S signing. Confirming the smart-wallet auth-entry wire shape for interop."
            />
          </div>
        </div>
      </div>

      {/* ── HOW IT FITS ─────────────────────────────────── */}
      <div className="sp-fits">
        <div className="sp-fits__inner">
          <div className="sp-fits__grid">
            <div className="sp-fits__copy">
              <div className="sp-eyebrow">HOW IT FITS</div>
              <h2 className="sp-h2 sp-h2--sm">
                A thin passkey layer between your app and Stellar.
              </h2>
              <p>
                SoroPass brings <strong>passkeys</strong> to the Stellar wallets people already use
                every day, so signing in and approving payments works like the apps they know, with
                no seed phrase to write down. Their <strong>Stellar smart account</strong> checks
                that passkey on-chain. It is a small piece you drop into your wallet, and it never
                holds funds or keys.
              </p>
              <div className="sp-pills">
                <span className="sp-pill">
                  <span className="sp-pill__ok">✓</span> No custody of funds
                </span>
                <span className="sp-pill">
                  <span className="sp-pill__ok">✓</span> No key storage
                </span>
                <span className="sp-pill">
                  <span className="sp-pill__ok">✓</span> No infra to run
                </span>
              </div>
            </div>
            <div className="sp-pipe">
              <div className="sp-pipenode">
                <div className="sp-pipenode__t">Your wallet / dApp</div>
                <div className="sp-pipenode__d">Embeds the SDK + UI.</div>
              </div>
              <div className="sp-arrow">↓</div>
              <div className="sp-pipenode sp-pipenode--brand">
                <div className="sp-pipenode__t">
                  <span className="sp-pipeicon">
                    <Fp s={11} sw={2} />
                  </span>{' '}
                  SoroPass
                </div>
                <div className="sp-pipenode__d">Passkey SDK + drop-in UI + kit module.</div>
              </div>
              <div className="sp-arrow">↓</div>
              <div className="sp-pipenode">
                <div className="sp-pipenode__t sp-mono">stellar-wallets-kit</div>
                <div className="sp-pipenode__d">The standard wallet connector.</div>
              </div>
              <div className="sp-arrow">↓</div>
              <div className="sp-pipenode">
                <div className="sp-pipenode__t">Soroban smart account</div>
                <div className="sp-pipenode__d">Verifies the passkey signature on-chain.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── USE CASES (live flows mounted in the frames) ── */}
      <div className="sp-ucs" id="usecases">
        {/* UC1 */}
        <div className="sp-uc" id="uc1">
          <div className="sp-uc__head">
            <div className="sp-uc__titlerow">
              <span className="sp-uc__num">01</span>
              <h2 className="sp-uc__title">Create a wallet &amp; make a payment</h2>
            </div>
            <p className="sp-uc__desc">
              Tap once. A passkey is created, a Soroban smart account is deployed and funded on
              testnet, then the passkey authorizes a real 25 XLM transfer. The chain rejects a
              wrong-key signature. Proof, not a promise.
            </p>
          </div>
          <Frame>
            <Flow1CreateSpend onWallet={setWallet} />
          </Frame>
        </div>

        <Thread label="the same passkey continues →" />

        {/* UC2 */}
        <div className="sp-uc" id="uc2">
          <div className="sp-uc__head">
            <div className="sp-uc__titlerow">
              <span className="sp-uc__num">02</span>
              <h2 className="sp-uc__title">Approve a dApp action</h2>
            </div>
            <p className="sp-uc__desc">
              A connected app asks your passkey wallet to approve an on-chain action. You confirm
              with your passkey, and your smart account verifies the signature on-chain with
              secp256r1. A wrong-key signature is rejected by the chain.
            </p>
          </div>
          <Frame>
            <Flow2DappAction wallet={wallet} />
          </Frame>
        </div>

        <Thread label="the same passkey signs →" />

        {/* UC3 */}
        <div className="sp-uc" id="uc3">
          <div className="sp-uc__head">
            <div className="sp-uc__titlerow">
              <span className="sp-uc__num">03</span>
              <h2 className="sp-uc__title">Sign in &amp; sign a message</h2>
            </div>
            <p className="sp-uc__desc">
              Reconnect with your passkey, then sign any message and watch the secp256r1 signature
              verified locally. It is the exact check Soroban’s host function runs. Valid against
              your key, rejected for any other.
            </p>
          </div>
          <Frame>
            <Flow3SignMessage wallet={wallet} />
          </Frame>
        </div>
      </div>

      {/* ── COMPATIBILITY MATRIX ────────────────────────── */}
      <div className="sp-section" id="compat">
        <div className="sp-section__top">
          <div className="sp-mx__head">
            <div>
              <h2 className="sp-h2">Browser compatibility, probed</h2>
              <p>
                What actually works, by capability. Each <strong>row</strong> is a passkey
                capability, each <strong>column</strong> a browser engine, and each cell shows
                whether it works plus where we got the data.
              </p>
            </div>
            <div className="sp-mx__meta">
              <span className="sp-stamp">last probed: 2026-06-14</span>
              <a
                className="sp-difflink"
                href={`${DOCS}/compatibility`}
                target="_blank"
                rel="noopener noreferrer"
              >
                diff ↗
              </a>
            </div>
          </div>

          <div className="sp-mxscroll">
            <div className="sp-mx">
              <div className="sp-mx__row sp-mx__hrow">
                <div className="sp-mx__hcap">Capability</div>
                {MX_COLS.map((c) => (
                  <div key={c} className="sp-mx__hcol">
                    {c}
                  </div>
                ))}
              </div>
              {MX_ROWS.map(([cap, cells]) => (
                <div className="sp-mx__row" key={cap}>
                  <div className="sp-mx__cap">{cap}</div>
                  {cells.map(([status, prov], i) => (
                    <div className="sp-mx__cell" key={i}>
                      <span className={`sp-cellpill sp-cellpill--${status}`}>
                        {GLYPH[status]}
                        <span className={`sp-prov sp-prov--${prov}`} />
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="sp-legend">
            <div className="sp-legend__items">
              <span>
                <span
                  className="sp-legbox"
                  style={{ background: 'oklch(0.96 0.03 158)', color: 'oklch(0.48 0.14 158)' }}
                >
                  ✓
                </span>{' '}
                works
              </span>
              <span>
                <span
                  className="sp-legbox"
                  style={{ background: 'oklch(0.97 0.05 80)', color: 'oklch(0.52 0.12 80)' }}
                >
                  ◐
                </span>{' '}
                partial
              </span>
              <span>
                <span
                  className="sp-legbox"
                  style={{ background: 'oklch(0.97 0.025 25)', color: 'oklch(0.54 0.18 25)' }}
                >
                  ✕
                </span>{' '}
                none
              </span>
              <span className="sp-legdiv" />
              <span>
                <span className="sp-legdot" style={{ background: 'oklch(0.55 0.18 264)' }} /> corner
                dot = we probed it in CI
              </span>
              <span>
                <span
                  className="sp-legdot"
                  style={{ background: '#fff', border: '1.5px solid oklch(0.72 0.06 264)' }}
                />{' '}
                from caniuse / BCD
              </span>
            </div>
            <a
              className="sp-difflink"
              style={{ fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 600 }}
              href={`${DOCS}/compatibility`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore the full matrix →
            </a>
          </div>

          <div className="sp-cards2">
            <div className="sp-rcard sp-rcard--ok">
              <div className="sp-rcard__head">
                <span className="sp-rcard__icon sp-rcard__icon--ok">✓</span>
                <div>
                  <div className="sp-rcard__t">Works reliably</div>
                  <div className="sp-rcard__s">solid across the engines we tested</div>
                </div>
              </div>
              <div className="sp-rlist">
                <div className="sp-rrow">
                  <span className="sp-rrow__ok">✓</span>{' '}
                  <span>
                    <code>isUVPAA</code> detection on every engine
                  </span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__ok">✓</span> <span>ES256 create + sign</span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__ok">✓</span>{' '}
                  <span>
                    On-chain <code>secp256r1</code> verify on testnet
                  </span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__ok">✓</span>{' '}
                  <span>Recovery from factory events, no indexer</span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__ok">✓</span> <span>Low-S signatures normalized</span>
                </div>
              </div>
            </div>
            <div className="sp-rcard sp-rcard--warn">
              <div className="sp-rcard__head">
                <span className="sp-rcard__icon sp-rcard__icon--warn">◐</span>
                <div>
                  <div className="sp-rcard__t">Needs a fallback</div>
                  <div className="sp-rcard__s">degrade gracefully on these</div>
                </div>
              </div>
              <div className="sp-rlist">
                <div className="sp-rrow">
                  <span className="sp-rrow__arrow">→</span>{' '}
                  <span>
                    <strong>Firefox:</strong> no conditional UI, use modal autofill
                  </span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__arrow">→</span>{' '}
                  <span>
                    <strong>Safari / iOS:</strong> hybrid varies, feature-detect
                  </span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__arrow">→</span>{' '}
                  <span>
                    <strong>Android:</strong> hybrid flaky, fall back to QR transport
                  </span>
                </div>
                <div className="sp-rrow">
                  <span className="sp-rrow__arrow">→</span>{' '}
                  <span>
                    <strong>Apple:</strong> high-S sigs, normalize to low-S before submit
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TWO WAYS TO ADOPT ───────────────────────────── */}
      <div className="sp-section" id="kit">
        <div className="sp-section__top">
          <div className="sp-eyebrow">ADOPT</div>
          <h2 className="sp-h2">Drop in our components, or build your own</h2>
          <p className="sp-adopt__sub">
            Same passkey engine underneath. Choose how much of the UI you want us to bring.
          </p>

          <div className="sp-optcards">
            <div className="sp-opt sp-opt--a">
              <div className="sp-opt__head">
                <div className="sp-opt__icon sp-opt__icon--a">
                  <Grid />
                </div>
                <span className="sp-opt__tag sp-opt__tag--a">drop-in · fastest</span>
              </div>
              <h3 className="sp-opt__t">Ready-made components</h3>
              <p className="sp-opt__d">
                Finished create, sign, and recover screens you embed as-is.
              </p>
              <div className="sp-opt__list">
                <div className="sp-opt__li sp-opt__li--a">
                  <span>✓</span> Every screen state handled for you: waiting on the passkey, working
                  on-chain, success, and errors.
                </div>
                <div className="sp-opt__li sp-opt__li--a">
                  <span>✓</span> Accessibility, multiple languages, and reduced-motion built in.
                </div>
                <div className="sp-opt__li sp-opt__li--a">
                  <span>✓</span> Re-skin the whole set to your brand with theme tokens (colors,
                  corners, spacing). No forking.
                </div>
              </div>
              <div className="sp-opt__best">
                <strong>Best for:</strong> teams who want passkeys live in days and are happy
                theming to taste.
              </div>
              <a
                className="sp-btn sp-btn--brand sp-opt__cta"
                href={`${DOCS}/components`}
                target="_blank"
                rel="noopener noreferrer"
              >
                See the components library →
              </a>
            </div>

            <div className="sp-opt sp-opt--b">
              <div className="sp-opt__head">
                <div className="sp-opt__icon sp-opt__icon--b">
                  <Code />
                </div>
                <span className="sp-opt__tag sp-opt__tag--b">full control</span>
              </div>
              <h3 className="sp-opt__t">Headless (build your own)</h3>
              <p className="sp-opt__d">
                The passkey logic and accessibility without any visuals. You render the screens in
                your own design system.
              </p>
              <div className="sp-opt__list">
                <div className="sp-opt__li sp-opt__li--b">
                  <span>›</span> Ready-made flow states and accessibility wiring, so you only build
                  the look.
                </div>
                <div className="sp-opt__li sp-opt__li--b">
                  <span>›</span> Or go down to the raw passkey + signing engine and build 100% of
                  the UI yourself.
                </div>
              </div>
              <div className="sp-opt__best">
                <strong>Best for:</strong> strict design systems, custom layouts, or unusual
                surfaces (extension popup, in-app webview).
              </div>
              <a
                className="sp-btn sp-btn--white sp-opt__cta"
                href={`${DOCS}/sdk`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Headless mode docs →
              </a>
            </div>
          </div>

          <div className="sp-cmp">
            <div className="sp-cmp__row">
              <div className="sp-cmp__hblank" />
              <div className="sp-cmp__hcol sp-cmp__hcol--a">
                <span className="sp-cmp__hico sp-cmp__hico--a">
                  <Grid s={13} />
                </span>
                <span className="sp-cmp__hname--a">Ready-made</span>
              </div>
              <div className="sp-cmp__hcol sp-cmp__hcol--b">
                <span className="sp-cmp__hico sp-cmp__hico--b">
                  <Code s={13} sw={2} />
                </span>
                <span className="sp-cmp__hname--b">Headless</span>
              </div>
            </div>
            <div className="sp-cmp__row">
              <div className="sp-cmp__label">
                <Users /> Who builds the UI
              </div>
              <div className="sp-cmp__a" style={{ fontWeight: 600 }}>
                Us (themeable)
              </div>
              <div className="sp-cmp__b" style={{ fontWeight: 600 }}>
                You
              </div>
            </div>
            <div className="sp-cmp__row">
              <div className="sp-cmp__label">
                <Bolt /> Time to ship
              </div>
              <div className="sp-cmp__a">
                <span className="sp-cmp__green">Fastest</span>
              </div>
              <div className="sp-cmp__b">More effort</div>
            </div>
            <div className="sp-cmp__row">
              <div className="sp-cmp__label">
                <Palette /> Brand match
              </div>
              <div className="sp-cmp__a">Via theme tokens</div>
              <div className="sp-cmp__b">
                <span className="sp-cmp__blue">Pixel-exact</span>
              </div>
            </div>
            <div className="sp-cmp__row">
              <div className="sp-cmp__label">
                <Target /> Best for
              </div>
              <div className="sp-cmp__a">Ship now, theme to taste</div>
              <div className="sp-cmp__b">Bespoke design systems</div>
            </div>
          </div>

          <div className="sp-kitpanel">
            <div className="sp-kitpanel__l">
              <div className="sp-kitpanel__t">How it plugs into the wallets kit</div>
              <p>
                Both options run on the same passkey engine and can plug into{' '}
                <code className="sp-codechip" style={{ fontSize: '12.5px' }}>
                  @creit.tech/stellar-wallets-kit
                </code>
                , so “Passkey” appears in the kit’s wallet picker like any other option. The kit
                handles sign-in and signing; the components or headless flows cover the richer
                create and recover screens on your own surfaces.
              </p>
            </div>
            <div className="sp-kitchip">
              <span className="sp-kitchip__icon">
                <Fp s={15} />
              </span>
              <div style={{ flex: 1 }}>
                <div className="sp-kitchip__t">Passkey</div>
                <div className="sp-kitchip__s">in the wallet picker</div>
              </div>
              <span className="sp-mono" style={{ fontSize: '11px', color: 'oklch(0.48 0.14 158)' }}>
                ✓
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <div className="sp-foot">
        <div className="sp-foot__inner">
          <div className="sp-brand">
            <span className="sp-brandmark" style={{ width: 24, height: 24 }}>
              <Fp s={14} />
            </span>
            <span className="sp-brandname" style={{ fontSize: 15 }}>
              SoroPass
            </span>
          </div>
          <div className="sp-foot__r">
            <span>Developed by Mert Köklü</span>
            <a className="sp-foot__gh" href={GH} target="_blank" rel="noopener noreferrer">
              <Octocat s={15} /> SoroPass on GitHub
            </a>
            <span className="sp-mono" style={{ fontSize: 12, color: 'oklch(0.55 0.015 271)' }}>
              Apache-2.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
