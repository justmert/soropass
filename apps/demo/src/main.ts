/**
 * SoroPass interactive demo (demo.soropass.dev).
 *
 * Reskin of the "SoroPass Demo" design (Claude Design): a sticky header + sidebar
 * shell, an overview, and five separate live-flow pages — create, sign, reject a
 * wrong key, back up a device, recover — each a header + "how it works" + a flow
 * card (live toolbar, the real @soropass/ui screen full-width, then a bottom
 * progressive status list with pending/active/done/failed rows, Stellar Expert
 * proof links, and a completion banner + Continue button). The design's scripted
 * timeline is replaced with the REAL testnet flows in ./v1Demo; the styled screens
 * come from @soropass/ui and are driven by their actual states.
 */
import './polyfills'; // MUST be first: sets globalThis.Buffer/process for @stellar/stellar-sdk
import '@soropass/ui/styled.css';
import './demo.css';

import {
  createView,
  signView,
  recoverView,
  addDeviceView,
  DEFAULT_CREATE_COPY,
  DEFAULT_SIGN_COPY,
  DEFAULT_RECOVER_COPY,
  DEFAULT_ADDDEVICE_COPY,
  type CreateCtx,
  type SignCtx,
  type RecoverCtx,
  type AddDeviceCtx,
  type TxSummaryData,
} from '@soropass/ui/styled';
import type {
  CreateFlowState,
  SignFlowState,
  RecoverFlowState,
  AddDeviceFlowState,
} from '@soropass/ui/headless';
import type { KitErrorCode } from '@soropass/core/types';
import type { RecoverResult } from '@soropass/core/recover';
import {
  createWalletV1,
  payFromWalletV1,
  addSecondDeviceV1,
  recoverWalletV1,
  EXPLORER,
  type V1Wallet,
} from './v1Demo';

// ── tiny DOM helper ───────────────────────────────────────────────────────────
type Attrs = Record<string, string | ((e: Event) => void) | undefined>;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: Array<Node | string | false | null | undefined>
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'onClick' && typeof v === 'function') n.addEventListener('click', v);
    else if (typeof v === 'string') n.setAttribute(k, v);
  }
  for (const c of kids) if (c || c === '') n.append(c as Node | string);
  return n;
}
function svg(inner: string, size = 18): SVGElement {
  const wrap = el('span');
  wrap.innerHTML = `<svg width="${String(size)}" height="${String(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  return wrap.firstElementChild as SVGElement;
}
const short = (a?: string): string => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

const ICON = {
  doc: '<path d="M6 3h7l5 5v13H6z"/><path d="M13 3v5h5"/><path d="M9.5 13.5h5"/><path d="M9.5 17h5"/>',
  headless: '<path d="M8.5 7.5 4 12l4.5 4.5"/><path d="M15.5 7.5 20 12l-4.5 4.5"/>',
  grid: '<rect x="3.2" y="3.2" width="7.6" height="7.6" rx="1.7"/><rect x="13.2" y="3.2" width="7.6" height="7.6" rx="1.7"/><rect x="3.2" y="13.2" width="7.6" height="7.6" rx="1.7"/><rect x="13.2" y="13.2" width="7.6" height="7.6" rx="1.7"/>',
  palette: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  git: '<circle cx="7" cy="5.5" r="2.4"/><circle cx="7" cy="18.5" r="2.4"/><circle cx="17" cy="8.5" r="2.4"/><path d="M7 7.9v8.2"/><path d="M17 10.9c0 3.4-4.3 2.7-7 4.8"/>',
  tCreate: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8.3v7.4"/><path d="M8.3 12h7.4"/>',
  tSign: '<path d="M5 19 19 5"/><path d="M8.5 5H19v10.5"/>',
  tReject: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  tBackup: '<rect x="3.5" y="3.5" width="12.5" height="12.5" rx="2.4"/><path d="M8.5 20.5H18a2.5 2.5 0 0 0 2.5-2.5V8.5"/>',
  tRecover: '<path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1"/><path d="M3.5 4.6v5.2h5.2"/>',
};

// ── app state ─────────────────────────────────────────────────────────────────
type Route = 'overview' | 'create' | 'sign' | 'reject' | 'backup' | 'recover';
type FlowKey = 'create' | 'sign' | 'reject' | 'backup' | 'recover';
const FLOW_KEYS: FlowKey[] = ['create', 'sign', 'reject', 'backup', 'recover'];

let route: Route = 'overview';
let theme: 'light' | 'dark' = 'light';
let wallet: V1Wallet | null = null;

const DOCS = 'https://docs.soropass.dev/docs'; // fumadocs serves pages under /docs/*
const GH = 'https://github.com/justmert/soropass';

// ── progressive-step + proof types (bottom status list, like the landing) ──────
interface ProofLink {
  label: string;
  href: string;
}
interface Proof {
  addr?: string;
  links?: ProofLink[];
}

/** The controller a flow page hands to its driver: it owns the styled screen,
 *  the bottom progressive status list, and the completion banner. */
interface CardApi {
  renderStage(node: HTMLElement): void;
  /** Mark step `i` active (earlier steps done); clears any completion banner. */
  active(i: number): void;
  /** Attach a proof (address + Stellar Expert links) to a step. */
  proof(i: number, p: Proof): void;
  /** Mark step `i` failed (earlier done) with no completion banner — a real error. */
  fail(i: number): void;
  /** Positive completion: all steps done (or `failStep` shown as ✕), plus a banner. */
  finish(opts: {
    failStep?: number;
    title: string;
    detail?: string;
    next?: { route: Route; label: string };
  }): void;
  clear(): void;
}

/** What a flow driver exposes to the toolbar: start (or restart) and reset. */
interface Driver {
  run: () => void;
  reset: () => void;
}

// ── copy (from the design) ─────────────────────────────────────────────────────
interface HowStep {
  t: string;
  d: string;
}
interface FlowMeta {
  num: string;
  eyebrow: string;
  title: string;
  lead: string;
  err?: boolean;
  banner?: string;
  how: HowStep[];
  steps: [string, string, string];
  liveLabel: string;
  runLabel: string;
}
const META: Record<FlowKey, FlowMeta> = {
  create: {
    num: '01',
    eyebrow: '01 · create',
    title: 'Create a wallet',
    lead: 'Proves that a wallet can exist with no seed phrase: the passkey is generated in the device secure enclave, and its public key becomes the sole signer on a freshly deployed smart account.',
    how: [
      { t: 'Enrol the passkey', d: 'The browser asks the device for a new ES256 credential. Face ID or Touch ID authorises it.' },
      { t: 'Deploy the account', d: 'SoroPass reads the public key out of the attestation and deploys a smart account bound to it.' },
      { t: 'Fund and confirm', d: 'Friendbot funds it. The C-address is now yours and the private half never left the enclave.' },
    ],
    steps: ['Enrol the passkey', 'Deploy the account', 'Fund and confirm'],
    liveLabel: 'live · testnet',
    runLabel: 'Run flow',
  },
  sign: {
    num: '02',
    eyebrow: '02 · sign',
    title: 'Sign a payment',
    lead: 'Proves that one biometric prompt is enough to move value: the passkey signs the transaction hash, and the contract verifies that signature on-chain before the payment settles.',
    how: [
      { t: 'Build and hash', d: 'The payment is built and hashed. That hash becomes the WebAuthn challenge.' },
      { t: 'Sign on the device', d: 'The device signs it after a biometric check and returns a DER signature.' },
      { t: 'Verify and submit', d: "The contract's __check_auth verifies it against the stored key, then the payment executes." },
    ],
    steps: ['Build and hash', 'Sign on the device', 'Verify and submit'],
    liveLabel: 'live · testnet',
    runLabel: 'Run flow',
  },
  reject: {
    num: '03',
    eyebrow: '03 · reject',
    title: 'Reject a wrong key',
    lead: 'This run is meant to fail. A valid passkey that is not a signer on the account tries to authorise the same payment — and the smart contract refuses it. The rejection happens on-chain, not in this interface.',
    err: true,
    banner:
      'Nothing breaks here. A safe, deliberate failure is the point: the guarantee holds even if the UI is hostile, patched, or replaced entirely.',
    how: [
      { t: 'An unauthorised key', d: 'A second, unrelated passkey is generated — real, valid, and unknown to your account.' },
      { t: 'It signs anyway', d: 'The signature is cryptographically sound, so the client has no reason to refuse it.' },
      { t: 'The contract refuses', d: '__check_auth compares the credential id to its signer set, finds no match, and panics. The payment never happens.' },
    ],
    steps: ['An unauthorised key', 'It signs anyway', 'The contract refuses'],
    liveLabel: 'live · expected to fail',
    runLabel: 'Run the wrong key',
  },
  backup: {
    num: '04',
    eyebrow: '04 · back up',
    title: 'Back up a device',
    lead: 'Proves that losing a phone is not losing a wallet. A second passkey is registered as an additional signer on the same account, so either device can approve on its own.',
    how: [
      { t: 'Enrol the second key', d: 'The new device enrols its own passkey — a second keypair, in its own enclave.' },
      { t: 'Authorise add_signer', d: 'Your current passkey signs the change — the account approves its own signer set.' },
      { t: 'Two keys, one account', d: 'Either one alone can move funds — which is exactly why the warning is there.' },
    ],
    steps: ['Enrol the second key', 'Authorise add_signer', 'Two keys, one account'],
    liveLabel: 'live · testnet',
    runLabel: 'Run flow',
  },
  recover: {
    num: '05',
    eyebrow: '05 · recover',
    title: 'Recover an account',
    lead: 'Proves that the passkey is the account. On a brand-new device with no local storage, a single biometric prompt is enough to find every wallet that passkey controls and reconnect to it.',
    how: [
      { t: 'Ask the passkey', d: 'The device offers whichever passkeys it has synced for this site — no address to type.' },
      { t: 'Resolve on-chain', d: 'Its credential id is looked up in the on-chain index of signer sets.' },
      { t: 'Pick the account', d: 'Every account it can sign for comes back. Choose one and the session is restored.' },
    ],
    steps: ['Ask the passkey', 'Resolve on-chain', 'Pick the account'],
    liveLabel: 'live · new device',
    runLabel: 'Run flow',
  },
};

// ── error mapping ──────────────────────────────────────────────────────────────
function errCode(e: unknown): KitErrorCode {
  const err = e as { message?: string; name?: string };
  const m = err?.message ?? '';
  if (err?.name === 'NotAllowedError' || /cancel|not allowed|aborted/i.test(m)) return 'USER_CANCELLED';
  if (/network|fetch|rpc|timeout|friendbot/i.test(m)) return 'NETWORK_ERROR';
  return 'CONTRACT_AUTH_FAILED';
}

// ── session / header ───────────────────────────────────────────────────────────
function setTheme(t: 'light' | 'dark'): void {
  theme = t;
  document.documentElement.dataset.theme = t;
  const seg = document.querySelector('.dm-theme');
  seg?.querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.theme === t)),
  );
}
function setWallet(w: V1Wallet): void {
  const first = !wallet;
  wallet = w;
  // Update the header chip in place (don't rebuild the running flow card).
  const chipHost = document.getElementById('dm-wallet-host');
  if (chipHost) chipHost.replaceChildren(walletChip());
  // On the first wallet, refresh the sidebar so gated items read as reachable.
  if (first) buildSidebar();
}
function walletChip(): Node {
  if (!wallet) return document.createComment('no-wallet');
  return el(
    'div',
    { class: 'dm-wallet', title: wallet.contractId },
    el('span', { class: 'dm-wallet__dot' }),
    el('span', { class: 'dm-wallet__label' }, 'wallet'),
    el('span', { class: 'dm-wallet__addr' }, short(wallet.contractId)),
  );
}

// ── navigation ─────────────────────────────────────────────────────────────────
function go(r: Route): void {
  route = r;
  if (location.hash !== `#/${r}`) location.hash = `#/${r}`;
  renderMain();
  syncNav();
  window.scrollTo(0, 0);
}
function syncNav(): void {
  document.querySelectorAll<HTMLElement>('[data-route]').forEach((n) => {
    if (n.dataset.route === route) n.setAttribute('aria-current', 'page');
    else n.removeAttribute('aria-current');
  });
}

// ═══ SHELL ══════════════════════════════════════════════════════════════════════
function header(): HTMLElement {
  const themeSeg = el(
    'div',
    { class: 'dm-theme' },
    (() => {
      const b = el('button', { type: 'button', 'data-theme': 'light', onClick: () => setTheme('light') }, 'Light');
      b.setAttribute('aria-pressed', String(theme === 'light'));
      return b;
    })(),
    (() => {
      const b = el('button', { type: 'button', 'data-theme': 'dark', onClick: () => setTheme('dark') }, 'Dark');
      b.setAttribute('aria-pressed', String(theme === 'dark'));
      return b;
    })(),
  );
  return el(
    'header',
    { class: 'dm-header' },
    el(
      'div',
      { class: 'dm-brand' },
      el('span', { class: 'dm-brand__dot' }),
      el('span', { class: 'dm-brand__name' }, 'SoroPass'),
    ),
    (() => {
      const t = el('div', { class: 'pk' });
      t.append(el('span', { class: 'pk-tag' }, 'testnet'));
      return t;
    })(),
    el('div', { id: 'dm-wallet-host' }, walletChip()),
    el('div', { class: 'dm-spacer' }),
    el(
      'nav',
      { class: 'dm-topnav' },
      el('a', { href: DOCS, target: '_blank', rel: 'noreferrer' }, 'Docs'),
      el('a', { href: GH, target: '_blank', rel: 'noreferrer' }, 'GitHub'),
    ),
    themeSeg,
  );
}

function navBtn(r: Route, label: string, num?: string, ico?: string): HTMLElement {
  const b = el(
    'button',
    { class: 'dm-nav', type: 'button', 'data-route': r, onClick: () => go(r) },
    num
      ? el('span', { class: 'dm-nav__num' }, num)
      : el('span', { class: 'dm-nav__ico' }, ico ? svg(ico) : ''),
    label,
  );
  if (route === r) b.setAttribute('aria-current', 'page');
  return b;
}
function extLink(href: string, label: string, ico: string): HTMLElement {
  return el(
    'a',
    { class: 'dm-nav', href, target: '_blank', rel: 'noreferrer' },
    el('span', { class: 'dm-nav__ico' }, svg(ico)),
    label,
    el('span', { class: 'dm-nav__ext' }, '↗'),
  );
}
function buildSidebar(): void {
  const host = document.getElementById('dm-side');
  if (!host) return;
  host.replaceChildren(
    el(
      'div',
      { class: 'dm-side__inner' },
      el(
        'section',
        { class: 'dm-side__group' },
        el('div', { class: 'dm-side__label' }, 'Get started'),
        navBtn('overview', 'Overview', undefined, ICON.doc),
      ),
      el(
        'section',
        { class: 'dm-side__group' },
        el('div', { class: 'dm-side__label' }, 'Live flows (testnet)'),
        navBtn('create', 'Create a wallet', '01'),
        navBtn('sign', 'Sign a payment', '02'),
        navBtn('reject', 'Reject a wrong key', '03'),
        navBtn('backup', 'Back up a device', '04'),
        navBtn('recover', 'Recover an account', '05'),
      ),
      el(
        'section',
        { class: 'dm-side__group' },
        el('div', { class: 'dm-side__label' }, 'Under the hood'),
        extLink(`${DOCS}/sdk`, 'Headless layer', ICON.headless),
        extLink(`${DOCS}/components`, 'Components', ICON.grid),
        extLink(`${DOCS}/theming`, 'Theming', ICON.palette),
        extLink(GH, 'Source on GitHub', ICON.git),
      ),
      el(
        'p',
        { class: 'dm-side__foot' },
        'Testnet only. Accounts are friendbot-funded and disposable.',
      ),
    ),
  );
}

// ═══ OVERVIEW ════════════════════════════════════════════════════════════════════
function overview(): HTMLElement {
  const tile = (r: Route, ico: string, title: string, desc: string, danger = false): HTMLElement =>
    el(
      'button',
      { class: `dm-tile${danger ? ' dm-tile--danger' : ''}`, type: 'button', onClick: () => go(r) },
      el(
        'span',
        { class: 'dm-tile__head' },
        el('span', { class: `dm-tile__ico${danger ? ' dm-tile__ico--danger' : ''}` }, svg(ico, 20)),
        el('span', { class: 'dm-tile__title' }, title),
      ),
      el('span', { class: 'dm-tile__desc' }, desc),
    );
  return el(
    'article',
    { class: 'dm-overview' },
    el(
      'section',
      { class: 'dm-hero' },
      el('span', { class: 'dm-eyebrow' }, 'passkey wallet layer · stellar'),
      el('h1', { class: 'dm-hero__title' }, 'Your face is the private key.'),
      el(
        'p',
        { class: 'dm-hero__lead' },
        "SoroPass turns a passkey — Face ID, Touch ID, a security key — into a signer on a Stellar smart account. The secret never leaves the device's secure enclave, so there is no seed phrase to write down, lose, or phish.",
      ),
      el(
        'div',
        { class: 'dm-hero__actions' },
        el('button', { class: 'pk-btn pk-btn--primary', type: 'button', onClick: () => go('create') }, 'Run the first flow'),
        el('a', { class: 'dm-hero__link', href: DOCS, target: '_blank', rel: 'noreferrer' }, 'Read the docs →'),
      ),
    ),
    el(
      'section',
      { class: 'dm-section' },
      el('h2', { class: 'dm-section-label' }, 'Five things to try'),
      el(
        'div',
        { class: 'dm-tiles' },
        tile('create', ICON.tCreate, 'Create a wallet', 'A passkey is enrolled and a smart account is deployed for it.'),
        tile('sign', ICON.tSign, 'Sign a payment', 'One biometric prompt authorises a real testnet transfer.'),
        tile('reject', ICON.tReject, 'Reject a wrong key', 'Watch an unauthorised signer get refused by the contract itself.', true),
        tile('backup', ICON.tBackup, 'Back up a device', 'Add a second passkey so a lost phone is not a lost wallet.'),
        tile('recover', ICON.tRecover, 'Recover an account', 'Arrive on a new device and find your account from the passkey alone.'),
      ),
    ),
    el(
      'p',
      { class: 'dm-overview__foot' },
      'Every account here is funded by friendbot on Stellar testnet and holds no real value. SoroPass is non-custodial — the demo server never sees a key, only signed payloads. Each transaction below links to Stellar Expert so you can verify it independently.',
    ),
  );
}

// ═══ FLOW PAGE ════════════════════════════════════════════════════════════════════
type StepState = 'pending' | 'active' | 'done' | 'failed';
interface Completion {
  failStep?: number;
  title: string;
  detail?: string;
  next?: { route: Route; label: string };
}

/** Builds the flow card: a full-width styled screen, a bottom progressive status
 *  list, and a completion banner — mirroring the landing page's flow pattern. */
function flowCard(flow: FlowKey, onRun: () => void, onReset: () => void): { node: HTMLElement; api: CardApi } {
  const m = META[flow];
  const stage = el('div', { class: 'dm-stage' });
  const stepsHost = el('ol', { class: 'dm-steps' });
  const completeHost = el('div', { class: 'dm-complete-host' });
  const liveDot = el('span', { class: `dm-card__live-dot${m.err ? ' dm-card__live-dot--err' : ''}` });

  const stepState: StepState[] = m.steps.map(() => 'pending');
  const proofs: (Proof | undefined)[] = m.steps.map(() => undefined);
  let completion: Completion | null = null;

  const drawSteps = (): void => {
    stepsHost.replaceChildren(
      ...m.steps.map((label, i) => {
        const st = stepState[i];
        const mark =
          st === 'done'
            ? el('span', { class: 'dm-stepmark' }, '✓')
            : st === 'failed'
              ? el('span', { class: 'dm-stepmark' }, '✕')
              : st === 'active'
                ? el('span', { class: 'dm-stepmark' }, el('span', { class: 'dm-spin' }))
                : el('span', { class: 'dm-stepmark' }, String(i + 1));
        const p = proofs[i];
        const body = el(
          'div',
          { class: 'dm-stepbody' },
          el(
            'div',
            { class: 'dm-steplabel' },
            el('span', {}, label),
            p?.addr ? el('code', { class: 'dm-addr' }, p.addr) : false,
          ),
          p?.links && p.links.length
            ? el(
                'div',
                { class: 'dm-steplinks' },
                ...p.links.map((lk) =>
                  el('a', { class: 'dm-proof', href: lk.href, target: '_blank', rel: 'noreferrer' }, `${lk.label} ↗`),
                ),
              )
            : false,
        );
        return el('li', { class: `dm-steprow is-${st}` }, mark, body);
      }),
    );
  };

  const drawComplete = (): void => {
    if (!completion) {
      completeHost.replaceChildren();
      return;
    }
    const c = completion;
    completeHost.replaceChildren(
      el(
        'div',
        { class: `dm-complete${c.failStep != null ? ' dm-complete--safe' : ''}` },
        el('span', { class: 'dm-complete__check' }, '✓'),
        el(
          'div',
          { class: 'dm-complete__text' },
          el('span', { class: 'dm-complete__title' }, c.title),
          c.detail ? el('span', { class: 'dm-complete__detail' }, c.detail) : false,
        ),
        c.next ? el('button', { class: 'pk-btn pk-btn--primary dm-complete__btn', type: 'button', onClick: () => go(c.next!.route) }, c.next.label) : false,
      ),
    );
  };

  const api: CardApi = {
    renderStage: (node) => stage.replaceChildren(node),
    active: (i) => {
      completion = null;
      for (let j = 0; j < stepState.length; j++) {
        if (j < i) {
          if (stepState[j] !== 'failed') stepState[j] = 'done';
        } else if (j === i) {
          stepState[j] = 'active';
        } else if (stepState[j] !== 'done') {
          stepState[j] = 'pending';
        }
      }
      drawSteps();
      drawComplete();
    },
    proof: (i, p) => {
      proofs[i] = p;
      drawSteps();
    },
    fail: (i) => {
      completion = null;
      for (let j = 0; j < stepState.length; j++) {
        if (j < i) {
          if (stepState[j] !== 'failed') stepState[j] = 'done';
        } else if (j === i) {
          stepState[j] = 'failed';
        }
      }
      drawSteps();
      drawComplete();
    },
    finish: (opts) => {
      for (let j = 0; j < stepState.length; j++) {
        stepState[j] = opts.failStep === j ? 'failed' : 'done';
      }
      completion = opts;
      drawSteps();
      drawComplete();
    },
    clear: () => {
      for (let j = 0; j < stepState.length; j++) stepState[j] = 'pending';
      for (let j = 0; j < proofs.length; j++) proofs[j] = undefined;
      completion = null;
      drawSteps();
      drawComplete();
    },
  };

  drawSteps();

  const bar = el(
    'div',
    { class: 'dm-card__bar' },
    el('span', { class: 'dm-card__live' }, liveDot, m.liveLabel),
    el(
      'div',
      { class: 'dm-card__actions' },
      el('button', { class: 'pk-btn pk-btn--ghost dm-btn-sm', type: 'button', onClick: onReset }, 'Reset'),
      el('button', { class: 'pk-btn pk-btn--primary dm-btn-sm', type: 'button', onClick: onRun }, m.runLabel),
    ),
  );

  const node = el(
    'section',
    { class: 'dm-card' },
    bar,
    el(
      'div',
      { class: 'dm-card__body' },
      stage,
      el('div', { class: 'dm-steps-wrap' }, el('span', { class: 'dm-steps-label' }, 'On-chain progress'), stepsHost, completeHost),
    ),
  );
  return { node, api };
}

function flowHeader(flow: FlowKey): HTMLElement {
  const m = META[flow];
  return el(
    'header',
    { class: 'dm-flow__head' },
    el('span', { class: `dm-flow__eyebrow${m.err ? ' dm-flow__eyebrow--err' : ''}` }, m.eyebrow),
    el('h1', { class: 'dm-flow__title' }, m.title),
    el('p', { class: 'dm-flow__lead' }, m.lead),
  );
}
function howSection(flow: FlowKey): HTMLElement {
  const m = META[flow];
  return el(
    'section',
    { class: 'dm-how' },
    el('h2', { class: 'dm-section-label' }, 'How it works'),
    el(
      'ol',
      { class: 'dm-how__grid' },
      ...m.how.map((s, i) =>
        el(
          'li',
          { class: 'dm-how__card' },
          el('span', { class: `dm-how__num${m.err ? ' dm-how__num--err' : ''}` }, `0${String(i + 1)}`),
          el('span', { class: 'dm-how__t' }, s.t),
          el('span', { class: 'dm-how__d' }, s.d),
        ),
      ),
    ),
  );
}
function gate(): HTMLElement {
  return el(
    'div',
    { class: 'dm-gate' },
    el('span', { class: 'dm-gate__label' }, 'needs a wallet'),
    el('h3', { class: 'dm-gate__title' }, 'Create a wallet first'),
    el(
      'p',
      { class: 'dm-gate__desc' },
      'This flow acts on a smart account. Run 01 once — about thirty seconds on testnet — and this page unlocks with your session wallet.',
    ),
    el('button', { class: 'pk-btn pk-btn--primary', type: 'button', style: 'margin-top:6px', onClick: () => go('create') }, 'Go to 01 · Create a wallet'),
  );
}

// ── the five drivers: real testnet flows wired to a CardApi ─────────────────────
function driveCreate(api: CardApi): Driver {
  let state: CreateFlowState = { status: 'idle' };
  const ctx = (): CreateCtx => ({
    copy: DEFAULT_CREATE_COPY,
    onCreate: () => void run(),
    onRetry: () => void run(),
    onContinue: () => go('sign'),
    onHelp: () => window.open(`${DOCS}/quickstart`, '_blank'),
  });
  const draw = (): void => api.renderStage(createView(state, ctx()));
  async function run(): Promise<void> {
    api.clear();
    api.active(0);
    state = { status: 'prompting' };
    draw();
    try {
      const w = await createWalletV1(
        'you',
        {
          deploying: () => {
            state = { status: 'deploying' };
            draw();
            api.active(1);
          },
        },
        (msg) => {
          if (/fund/i.test(msg)) api.active(2);
        },
      );
      state = { status: 'success', credential: { contractId: w.contractId, credentialId: w.credentialId, publicKey: w.publicKey } };
      draw();
      setWallet(w);
      api.proof(1, { links: [{ label: 'Deploy tx', href: `${EXPLORER}/tx/${w.deployTx}` }] });
      api.proof(2, { addr: w.contractId, links: [{ label: 'Account', href: `${EXPLORER}/contract/${w.contractId}` }] });
      api.finish({
        title: 'Wallet created and live on testnet.',
        detail: 'Your passkey is the sole signer on a freshly deployed smart account. No seed phrase exists.',
        next: { route: 'sign', label: 'Continue with 02 · Sign a payment →' },
      });
    } catch (e) {
      state = { status: 'error', code: errCode(e), message: (e as Error).message };
      draw();
      api.fail(1);
    }
  }
  const reset = (): void => {
    state = { status: 'idle' };
    api.clear();
    draw();
  };
  draw();
  return { run: () => void run(), reset };
}

function driveSign(api: CardApi, wrong: boolean): Driver {
  let state: SignFlowState = { status: 'idle' };
  const tx: TxSummaryData = {
    amountValue: '5.0000000 XLM',
    destination: '(session sponsor)',
    action: wrong ? 'transfer · wrong key' : 'transfer',
  };
  const ctx = (): SignCtx => ({
    copy: DEFAULT_SIGN_COPY,
    tx,
    onSign: () => void run(),
    onCancel: () => {
      state = { status: 'idle' };
      draw();
    },
    onRetry: () => void run(),
    onDone: () => go(wrong ? 'backup' : 'reject'),
    onExplorer: (h) => window.open(`${EXPLORER}/tx/${h}`, '_blank'),
  });
  const draw = (): void => api.renderStage(signView(state, ctx()));
  async function run(): Promise<void> {
    if (!wallet) return;
    api.clear();
    api.active(0);
    state = { status: 'prompting' };
    draw();
    try {
      const res = await payFromWalletV1(wallet, wrong, (msg) => {
        if (/sign/i.test(msg)) api.active(1);
        if (/submit|payment|rejected/i.test(msg)) api.active(2);
      });
      state = { status: 'submitting' };
      draw();
      if (res.status === 'SUCCESS') {
        state = { status: 'done', result: res };
        draw();
        api.proof(2, { links: [{ label: 'Payment tx', href: `${EXPLORER}/tx/${res.hash}` }] });
        api.finish({
          title: 'Payment settled — verified on-chain by the contract.',
          detail: 'One biometric prompt authorised a real testnet payment.',
          next: { route: 'reject', label: 'Continue with 03 · Reject a wrong key →' },
        });
      } else if (wrong) {
        state = { status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' };
        draw();
        api.finish({
          failStep: 2,
          title: 'Refused on-chain — exactly as intended.',
          detail: 'The contract checked the credential against its signer set, found no match, and rejected the payment.',
          next: { route: 'backup', label: 'Continue with 04 · Back up a device →' },
        });
      } else {
        state = { status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' };
        draw();
        api.fail(2);
      }
    } catch (e) {
      state = { status: 'error', code: errCode(e), message: (e as Error).message };
      draw();
      api.fail(1);
    }
  }
  const reset = (): void => {
    state = { status: 'idle' };
    api.clear();
    draw();
  };
  draw();
  return { run: () => void run(), reset };
}

function driveBackup(api: CardApi): Driver {
  let state: AddDeviceFlowState = { status: 'idle' };
  const ctx = (): AddDeviceCtx => ({
    copy: DEFAULT_ADDDEVICE_COPY,
    onAdd: () => void run(),
    onRetry: () => void run(),
    onCancel: () => {
      state = { status: 'idle' };
      draw();
    },
    onDone: () => go('recover'),
  });
  const draw = (): void => api.renderStage(addDeviceView(state, ctx()));
  async function run(): Promise<void> {
    if (!wallet) return;
    api.clear();
    api.active(0);
    state = { status: 'prompting' };
    draw();
    try {
      const { result, signer } = await addSecondDeviceV1(
        wallet,
        {
          binding: () => {
            state = { status: 'binding' };
            draw();
            api.active(1);
          },
        },
        (msg) => {
          if (/confirm|waiting/i.test(msg)) api.active(2);
        },
      );
      if (result.status !== 'SUCCESS') throw new Error('add_signer was not confirmed');
      state = { status: 'success', result: { signer } };
      draw();
      api.proof(2, { links: [{ label: 'add_signer tx', href: `${EXPLORER}/tx/${result.hash}` }] });
      api.finish({
        title: 'Second device enrolled — either key can now approve.',
        detail: 'The account approved its own signer set on-chain. A lost phone no longer means a lost wallet.',
        next: { route: 'recover', label: 'Continue with 05 · Recover an account →' },
      });
    } catch (e) {
      state = { status: 'error', code: errCode(e), message: (e as Error).message };
      draw();
      api.fail(1);
    }
  }
  const reset = (): void => {
    state = { status: 'idle' };
    api.clear();
    draw();
  };
  draw();
  return { run: () => void run(), reset };
}

function driveRecover(api: CardApi): Driver {
  let accounts: RecoverResult[] = [];
  let state: RecoverFlowState = { status: 'idle' };
  const ctx = (): RecoverCtx => ({
    copy: DEFAULT_RECOVER_COPY,
    meta: (_a, i) => `Account ${String(i + 1)}`,
    onRecover: () => void run(),
    onRetry: () => void run(),
    onTryDifferent: () => void run(),
    onSelect: (a) => {
      state = { status: 'selected', account: a };
      draw();
      api.proof(2, { addr: a.contractId, links: [{ label: 'Account', href: `${EXPLORER}/contract/${a.contractId}` }] });
      api.finish({
        title: 'Session restored — the passkey is the account.',
        detail: 'All five flows are complete: create, sign, reject, back up, recover — every one live on testnet.',
        next: { route: 'overview', label: 'Back to the overview →' },
      });
    },
    onContinue: () => go('overview'),
    onCreateNew: () => go('create'),
  });
  const draw = (): void => api.renderStage(recoverView(state, accounts, ctx()));
  async function run(): Promise<void> {
    api.clear();
    api.active(0);
    state = { status: 'discovering' };
    draw();
    try {
      accounts = await recoverWalletV1((msg) => {
        if (/resolv|index/i.test(msg)) api.active(1);
        if (/recovered|found/i.test(msg)) api.active(2);
      });
      if (accounts.length) {
        state = { status: 'resolved', accounts };
        draw();
        api.active(2);
      } else {
        state = { status: 'none' };
        draw();
        api.fail(2);
      }
    } catch (e) {
      state = { status: 'error', code: errCode(e), message: (e as Error).message };
      draw();
      api.fail(0);
    }
  }
  const reset = (): void => {
    accounts = [];
    state = { status: 'idle' };
    api.clear();
    draw();
  };
  draw();
  return { run: () => void run(), reset };
}

function flowPage(flow: FlowKey): HTMLElement {
  const m = META[flow];
  const parts: Array<Node | false> = [flowHeader(flow)];
  if (m.banner) {
    const b = el('div', { class: 'pk' });
    b.append(el('div', { class: 'pk-banner pk-banner--warn' }, el('span', { class: 'pk-banner__body' }, m.banner)));
    parts.push(b);
  }
  parts.push(howSection(flow));

  const gated = flow !== 'create';
  if (gated && !wallet) {
    parts.push(gate());
  } else {
    let driver: Driver | null = null;
    const card = flowCard(
      flow,
      () => driver?.run(),
      () => driver?.reset(),
    );
    driver =
      flow === 'create'
        ? driveCreate(card.api)
        : flow === 'sign'
          ? driveSign(card.api, false)
          : flow === 'reject'
            ? driveSign(card.api, true)
            : flow === 'backup'
              ? driveBackup(card.api)
              : driveRecover(card.api);
    parts.push(card.node);
  }
  return el('article', { class: 'dm-flow' }, ...parts.filter(Boolean));
}

// ═══ RENDER + ROUTER ════════════════════════════════════════════════════════════
function renderMain(): void {
  const main = document.getElementById('dm-main');
  if (!main) return;
  main.replaceChildren(route === 'overview' ? overview() : flowPage(route as FlowKey));
}

function renderApp(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren(
    el(
      'div',
      { class: 'dm-root' },
      header(),
      el(
        'div',
        { class: 'dm-shell' },
        el('aside', { class: 'dm-side', id: 'dm-side' }),
        el('main', { class: 'dm-main', id: 'dm-main' }),
      ),
    ),
  );
  buildSidebar();
  renderMain();
}

function readHash(): void {
  const id = location.hash.replace(/^#\/?/, '') || 'overview';
  route = (['overview', ...FLOW_KEYS].includes(id) ? id : 'overview') as Route;
}

readHash();
setTheme('light');
renderApp();
window.addEventListener('hashchange', () => {
  readHash();
  renderMain();
  syncNav();
});
