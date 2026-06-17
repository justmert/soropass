/**
 * Embeddable single-screen renderer for the docs site.
 *
 * Mintlify can't import the SDK (no npm in its sandbox), so the docs pages
 * `<iframe>` THIS entry to show the REAL styled components. One page renders
 * every preview surface — driven by URL params and a `postMessage` control
 * bridge — in mock mode with ZERO network. Because the styled layer is
 * vanilla-DOM, no React adapter is needed for live previews.
 *
 *   /embed.html?screen=create&state=success&theme=dark
 *   /embed.html?screen=sign&state=idle&brand=oklch(0.7 0.13 190)&radius=sharp&rtl=1
 *   /embed.html?screen=recover&state=resolved&accounts=3&motion=reduced
 *   /embed.html?screen=gallery&theme=dark           (all 16 states)
 *   /embed.html?screen=create&autocycle=1           (hero: idle→prompting→deploying→success)
 *
 * parent → iframe:  postMessage({ type:'pk-set', screen, state, theme, brand, radius, rtl, motion, errorCode, accounts })
 * iframe → parent:  postMessage({ type:'pk-ready' })  and  postMessage({ type:'pk-height', height })
 */
import '@soropass/ui/styled.css';

import type { KitErrorCode, PasskeyCredential } from '@soropass/core/types';
import type { RecoverResult } from '@soropass/core/recover';
import {
  createView,
  signView,
  recoverView,
  connectView,
  addDeviceView,
  DEFAULT_CREATE_COPY,
  DEFAULT_SIGN_COPY,
  DEFAULT_RECOVER_COPY,
  DEFAULT_CONNECT_COPY,
  DEFAULT_ADDDEVICE_COPY,
  icon,
  identicon,
  truncMiddle,
  type CreateCtx,
  type SignCtx,
  type RecoverCtx,
  type ConnectCtx,
  type AddDeviceCtx,
  type IconName,
} from '@soropass/ui/styled';

// ── sample data (mock; zero network) ────────────────────────────────────────
const SAMPLE_CRED: PasskeyCredential = {
  contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP',
  credentialId: 'demo-credential',
  publicKey: new Uint8Array(65),
};
const SAMPLE_HASH = 'a1b9f4c7e2d8053614af9b2c7e0d4f6182a3c5d7e9b0f1234567890abcdef1234';
const SAMPLE_ACCOUNTS: RecoverResult[] = [
  { contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP', credentialId: 'k' },
  { contractId: 'CDEF8GH1J2K3L4M5N6P7Q8R9S0T1U2V3W4X5Y6Z7B8DEF8GH1J2K3L4', credentialId: 'k' },
  { contractId: 'CBQ9Z8Y7X6W5V4U3T2S1R0P9N8M7L6K5J4H3G2F1D0BQ9Z8Y7X6W5V4', credentialId: 'k' },
];
const noop = (): void => {};

const createCtx: CreateCtx = {
  copy: DEFAULT_CREATE_COPY,
  onCreate: noop,
  onRetry: noop,
  onContinue: noop,
  onHelp: noop,
};
const signCtx: SignCtx = {
  copy: DEFAULT_SIGN_COPY,
  tx: {
    amountValue: '250.00 USDC',
    amountFiat: '≈ $250.00',
    destination: 'GDUKMGUGDZQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6X',
    action: 'transfer',
  },
  onSign: noop,
  onCancel: noop,
  onRetry: noop,
  onDone: noop,
  onExplorer: noop,
};
const recoverCtx: RecoverCtx = {
  copy: DEFAULT_RECOVER_COPY,
  meta: (_account, index) => `Account ${String(index + 1)}`,
  onRecover: noop,
  onRetry: noop,
  onSelect: noop,
  onContinue: noop,
  onCreateNew: noop,
  onTryDifferent: noop,
};
const connectCtx: ConnectCtx = {
  copy: DEFAULT_CONNECT_COPY,
  onCreate: noop,
  onUseExisting: noop,
  onHelp: noop,
};
const addDeviceCtx: AddDeviceCtx = {
  copy: DEFAULT_ADDDEVICE_COPY,
  onAdd: noop,
  onCancel: noop,
  onRetry: noop,
  onDone: noop,
};

// ── living compatibility matrix (latest dated snapshot) ──────────────────────
interface MatrixCell {
  feature: string;
  featureLabel: string;
  browser: string;
  os: string;
  status: string;
  source: string;
  tier: string;
  since?: string;
  lastVerified?: string;
}
interface MatrixSnapshot {
  builtAt: string;
  cells: MatrixCell[];
}
// Bundled at build time from the matrix package; pick the newest by filename.
const MATRIX_SNAPSHOTS = import.meta.glob('../../matrix/data/matrix.*.json', {
  eager: true,
}) as Record<string, { default: MatrixSnapshot }>;

// ── params ──────────────────────────────────────────────────────────────────
interface Params {
  screen: string;
  state: string;
  theme: string; // light | dark | teal
  brand: string | null;
  radius: string | null; // 'sharp'
  rtl: boolean;
  motion: string | null; // 'reduced'
  errorCode: KitErrorCode;
  accounts: number;
  autocycle: boolean;
}

function readParams(): Params {
  const q = new URLSearchParams(location.search);
  return {
    screen: q.get('screen') ?? 'create',
    state: q.get('state') ?? 'idle',
    theme: q.get('theme') ?? 'light',
    brand: q.get('brand'),
    radius: q.get('radius'),
    rtl: q.get('rtl') === '1' || q.get('rtl') === 'true',
    motion: q.get('motion'),
    errorCode: (q.get('errorCode') as KitErrorCode | null) ?? 'USER_CANCELLED',
    accounts: Number.parseInt(q.get('accounts') ?? '3', 10),
    autocycle: q.get('autocycle') === '1',
  };
}

// ── per-screen state → element ───────────────────────────────────────────────
function createEl(state: string, p: Params): HTMLElement {
  switch (state) {
    case 'prompting':
      return createView({ status: 'prompting' }, createCtx);
    case 'deploying':
      return createView({ status: 'deploying' }, createCtx);
    case 'success':
      return createView({ status: 'success', credential: SAMPLE_CRED }, createCtx);
    case 'error':
      return createView({ status: 'error', code: p.errorCode, message: '' }, createCtx);
    default:
      return createView({ status: 'idle' }, createCtx);
  }
}
function signEl(state: string, p: Params): HTMLElement {
  switch (state) {
    case 'prompting':
      return signView({ status: 'prompting' }, signCtx);
    case 'submitting':
      return signView({ status: 'submitting' }, signCtx);
    case 'done':
      return signView({ status: 'done', result: { status: 'SUCCESS', hash: SAMPLE_HASH } }, signCtx);
    case 'error':
      return signView({ status: 'error', code: p.errorCode, message: '' }, signCtx);
    default:
      return signView({ status: 'idle' }, signCtx);
  }
}
function recoverEl(state: string, p: Params): HTMLElement {
  const n = Math.max(0, Math.min(p.accounts, SAMPLE_ACCOUNTS.length));
  const accts = SAMPLE_ACCOUNTS.slice(0, n);
  switch (state) {
    case 'discovering':
      return recoverView({ status: 'discovering' }, [], recoverCtx);
    case 'resolved':
      return recoverView({ status: 'resolved', accounts: accts }, accts, recoverCtx);
    case 'error':
      return recoverView({ status: 'error', code: p.errorCode, message: '' }, [], recoverCtx);
    default:
      return recoverView({ status: 'idle' }, [], recoverCtx);
  }
}

function addDeviceEl(state: string, p: Params): HTMLElement {
  switch (state) {
    case 'prompting':
      return addDeviceView({ status: 'prompting' }, addDeviceCtx);
    case 'binding':
      return addDeviceView({ status: 'binding' }, addDeviceCtx);
    case 'success':
      return addDeviceView({ status: 'success', result: { signer: SAMPLE_CRED.credentialId } }, addDeviceCtx);
    case 'error':
      return addDeviceView({ status: 'error', code: p.errorCode, message: '' }, addDeviceCtx);
    default:
      return addDeviceView({ status: 'idle' }, addDeviceCtx);
  }
}

// ── primitives showcase ──────────────────────────────────────────────────────
// The building blocks the screens compose from, rendered standalone (primitives
// page). Reconstructed from the same `pk-*` classes the real components use, so
// every value still resolves through the shipped design tokens.
const ICON_NAMES: IconName[] = [
  'passkey', 'key', 'shield', 'copy', 'check', 'checkCircle', 'alert',
  'external', 'refresh', 'plus', 'chevron', 'help', 'arrowLeft',
];

function el(tag: string, className: string | null, ...kids: Array<Node | string>): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const k of kids) node.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return node;
}

function primButton(variant: string, label: string, opts: { glyph?: SVGElement; busy?: boolean } = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `pk-btn pk-btn--${variant}`;
  b.type = 'button';
  if (opts.busy) {
    b.setAttribute('aria-busy', 'true');
    b.append(el('span', 'pk-spinner pk-btn__spinner'));
  } else if (opts.glyph) {
    b.append(opts.glyph);
  }
  b.append(document.createTextNode(label));
  return b;
}

function primChip(address: string, label: string): HTMLElement {
  const text = el('span', 'pk-address__text', el('span', 'pk-address__label', label), truncMiddle(address));
  text.title = address;
  const copyBtn = document.createElement('button');
  copyBtn.className = 'pk-copy';
  copyBtn.type = 'button';
  copyBtn.setAttribute('aria-label', 'Copy full address');
  copyBtn.append(icon('copy', 17));
  copyBtn.addEventListener('click', () => {
    try {
      void navigator.clipboard?.writeText(address);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    copyBtn.classList.add('is-copied');
    copyBtn.replaceChildren(icon('check', 17));
    setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.replaceChildren(icon('copy', 17));
    }, 1500);
  });
  return el('div', 'pk-address', identicon(address), text, copyBtn);
}

function primStatus(role: 'status' | 'alert', tone: 'info' | 'error', text: string): HTMLElement {
  const glyph = el('span', `pk-glyph pk-glyph--${tone}`, icon(tone === 'error' ? 'alert' : 'checkCircle', 20));
  const msg = el('p', 'pk-message', text);
  msg.setAttribute('role', role);
  msg.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
  return el('div', 'pk-prims__status', glyph, msg);
}

function primRow(label: string, demo: HTMLElement): HTMLElement {
  return el('div', 'pk-prims__row', el('div', 'pk-prims__label', label), demo);
}

function primitivesEl(): HTMLElement {
  const buttons = el(
    'div', 'pk-prims__demo',
    primButton('primary', 'Create passkey', { glyph: icon('passkey', 18) }),
    primButton('secondary', 'Cancel'),
    primButton('ghost', 'Skip'),
    primButton('primary', 'Working…', { busy: true }),
  );

  const idents = el('div', 'pk-prims__demo');
  for (const seed of [SAMPLE_CRED.contractId, SAMPLE_ACCOUNTS[1]!.contractId, SAMPLE_ACCOUNTS[2]!.contractId, 'alice', 'bob']) {
    idents.append(identicon(seed, 40));
  }

  const iconGrid = el('div', 'pk-prims__icons');
  for (const name of ICON_NAMES) {
    iconGrid.append(el('div', 'pk-prims__icon', icon(name, 22), el('span', null, name)));
  }

  return el(
    'div', 'pk-prims',
    primRow('Button · primary / secondary / ghost / busy', buttons),
    primRow('Spinner', el('div', 'pk-prims__demo', el('span', 'pk-spinner'))),
    primRow('AddressChip', primChip(SAMPLE_CRED.contractId, 'Smart account')),
    primRow('Identicon · deterministic from seed', idents),
    primRow('StatusLine · polite (role=status)', primStatus('status', 'info', 'Setting up your account…')),
    primRow('StatusLine · error (role=alert)', primStatus('alert', 'error', 'Couldn’t reach the network.')),
    primRow('Icon set · 1.75px line, currentColor, 24px grid', iconGrid),
  );
}

function matrixEl(): HTMLElement {
  const keys = Object.keys(MATRIX_SNAPSHOTS).sort();
  const snap = keys.length ? MATRIX_SNAPSHOTS[keys[keys.length - 1]!]!.default : undefined;
  if (!snap) return el('div', 'pk-matrix', 'Matrix data unavailable.');
  const cells = snap.cells;

  const colName = (c: MatrixCell): string => `${c.browser} / ${c.os}`;
  const preferred = [
    'Chrome / desktop', 'Safari / macOS', 'Firefox / desktop', 'Edge / Windows',
    'Chrome / Android', 'Safari / iOS', 'Firefox / Android', 'Samsung Internet / Android',
  ];
  const present = [...new Set(cells.map(colName))];
  const cols = [...preferred.filter((c) => present.includes(c)), ...present.filter((c) => !preferred.includes(c))];

  const rowKeys: string[] = [];
  const labels: Record<string, string> = {};
  for (const c of cells) {
    if (!(c.feature in labels)) {
      labels[c.feature] = c.featureLabel;
      rowKeys.push(c.feature);
    }
  }
  const HIGHLIGHT = new Set(['es256_alg', 'hybrid_transport']);
  const find = (feat: string, col: string): MatrixCell | undefined =>
    cells.find((c) => c.feature === feat && colName(c) === col);
  const glyph = (status?: string): [string, string] =>
    status === 'supported' ? ['✓', 'pk-matrix__ok'] : status === 'unsupported' ? ['✕', 'pk-matrix__no'] : ['?', 'pk-matrix__unk'];

  const headRow = el('tr', null, el('th', null, 'Feature'));
  for (const c of cols) {
    const [b, os] = c.split(' / ');
    headRow.append(el('th', null, el('div', 'pk-matrix__b', b ?? c), el('div', 'pk-matrix__os', os ?? '')));
  }
  const body = document.createElement('tbody');
  for (const feat of rowKeys) {
    const tr = document.createElement('tr');
    if (HIGHLIGHT.has(feat)) tr.className = 'pk-matrix__row--key';
    tr.append(el('td', null, labels[feat] ?? feat));
    for (const col of cols) {
      const cell = find(feat, col);
      const [g, cls] = glyph(cell?.status);
      const span = el('span', `pk-matrix__cell ${cls}`, g);
      if (cell) {
        span.title = `${cell.status} · ${cell.source}${cell.since ? ` · since ${cell.since}` : ''} · ${cell.tier}`;
      }
      tr.append(el('td', null, span));
    }
    body.append(tr);
  }
  const table = el('table', 'pk-matrix__table', el('thead', null, headRow), body);
  const meta = el(
    'div', 'pk-matrix__meta',
    `${String(cells.length)} cells · as of ${snap.builtAt} · ✓ supported · ✕ not supported · ? unknown · hover a cell for its source`,
  );
  return el('div', 'pk-matrix', table, meta);
}

// All 16 documented states, for the states gallery.
function galleryEl(): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'pk-embed-gallery';
  const tiles: Array<[string, HTMLElement]> = [
    ['create · idle', createView({ status: 'idle' }, createCtx)],
    ['create · prompting', createView({ status: 'prompting' }, createCtx)],
    ['create · deploying', createView({ status: 'deploying' }, createCtx)],
    ['create · success', createView({ status: 'success', credential: SAMPLE_CRED }, createCtx)],
    ['create · error', createView({ status: 'error', code: 'USER_CANCELLED', message: '' }, createCtx)],
    ['sign · idle', signView({ status: 'idle' }, signCtx)],
    ['sign · prompting', signView({ status: 'prompting' }, signCtx)],
    ['sign · submitting', signView({ status: 'submitting' }, signCtx)],
    ['sign · done', signView({ status: 'done', result: { status: 'SUCCESS', hash: SAMPLE_HASH } }, signCtx)],
    ['sign · error', signView({ status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' }, signCtx)],
    ['recover · idle', recoverView({ status: 'idle' }, [], recoverCtx)],
    ['recover · discovering', recoverView({ status: 'discovering' }, [], recoverCtx)],
    [
      'recover · resolved',
      recoverView({ status: 'resolved', accounts: SAMPLE_ACCOUNTS }, SAMPLE_ACCOUNTS, recoverCtx),
    ],
    ['recover · error', recoverView({ status: 'error', code: 'NETWORK_ERROR', message: '' }, [], recoverCtx)],
  ];
  for (const [label, el] of tiles) {
    const tile = document.createElement('div');
    tile.className = 'pk-embed-tile';
    const cap = document.createElement('div');
    cap.className = 'pk-embed-tile__label';
    cap.textContent = label;
    tile.append(cap, el);
    grid.append(tile);
  }
  return grid;
}

function elFor(p: Params): HTMLElement {
  switch (p.screen) {
    case 'sign':
      return signEl(p.state, p);
    case 'recover':
      return recoverEl(p.state, p);
    case 'connect':
      return connectView(connectCtx);
    case 'adddevice':
      return addDeviceEl(p.state, p);
    case 'primitives':
      return primitivesEl();
    case 'matrix':
      return matrixEl();
    case 'gallery':
      return galleryEl();
    case 'bad-input':
      // "feed it a bad input → typed error renders as clean UI"
      return createEl('error', p);
    default:
      return createEl(p.state, p);
  }
}

// ── theme + token control (matches the proven tweaks-bar overrides) ──────────
const TEAL = {
  brand: 'oklch(0.7 0.13 190)',
  hover: 'oklch(0.64 0.13 190)',
  active: 'oklch(0.58 0.13 190)',
};

function applyTheme(scope: HTMLElement, p: Params): void {
  if (p.theme === 'dark') scope.setAttribute('data-theme', 'dark');
  else scope.removeAttribute('data-theme');

  const brand = p.brand ?? (p.theme === 'teal' ? TEAL.brand : null);
  if (brand) {
    scope.style.setProperty('--pk-color-brand', brand);
    scope.style.setProperty('--pk-color-brand-hover', p.brand ?? TEAL.hover);
    scope.style.setProperty('--pk-color-brand-active', p.brand ?? TEAL.active);
  } else {
    scope.style.removeProperty('--pk-color-brand');
    scope.style.removeProperty('--pk-color-brand-hover');
    scope.style.removeProperty('--pk-color-brand-active');
  }

  if (p.radius === 'sharp') {
    scope.style.setProperty('--pk-radius-lg', '2px');
    scope.style.setProperty('--pk-radius-md', '2px');
  } else {
    scope.style.removeProperty('--pk-radius-lg');
    scope.style.removeProperty('--pk-radius-md');
  }

  if (p.rtl) scope.setAttribute('dir', 'rtl');
  else scope.removeAttribute('dir');

  if (p.motion === 'reduced') scope.setAttribute('data-reduced-motion', 'true');
  else scope.removeAttribute('data-reduced-motion');
}

// ── render loop + control bridge ─────────────────────────────────────────────
const scope = document.getElementById('app') as HTMLElement;
let current = readParams();

function postHeight(): void {
  const height = Math.ceil(document.body.getBoundingClientRect().height);
  parent.postMessage({ type: 'pk-height', height }, '*');
}

function render(): void {
  applyTheme(scope, current);
  scope.replaceChildren(elFor(current));
  requestAnimationFrame(postHeight);
}

window.addEventListener('message', (e: MessageEvent) => {
  const data = e.data as (Partial<Params> & { type?: string }) | null;
  if (data && data.type === 'pk-set') {
    current = { ...current, ...data };
    render();
  }
});
window.addEventListener('resize', postHeight);

render();
parent.postMessage({ type: 'pk-ready' }, '*');
// Keep the iframe sized tightly to the card as content/fonts settle.
new ResizeObserver(() => postHeight()).observe(document.body);

// Hero auto-cycle: walk the happy path so the landing shows a looping demo with
// no interaction (and no React).
const CYCLES: Record<string, string[]> = {
  create: ['idle', 'prompting', 'deploying', 'success'],
  sign: ['idle', 'prompting', 'submitting', 'done'],
  recover: ['idle', 'discovering', 'resolved'],
};
if (current.autocycle && CYCLES[current.screen]) {
  let i = 0;
  setInterval(() => {
    const seq = CYCLES[current.screen];
    if (!seq) return;
    i = (i + 1) % seq.length;
    current = { ...current, state: seq[i] ?? 'idle' };
    render();
  }, 1800);
}
