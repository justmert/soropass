/**
 * Reference demo for the S20 styled layer. Renders:
 *   1. A static gallery of ALL 16 states (Create 5 · Sign 5 · Recover 6) — used
 *      for visual review + before/after token-swap screenshots.
 *   2. Three LIVE cards driving the real headless flows (mock or virtual-
 *      authenticator backed — see demoKit).
 *   3. A tweaks bar that overrides tokens on a single scope element, proving the
 *      whole set re-themes with zero component code change (the S20 gate).
 *
 * Everything visual comes from `@stellar-passkey/ui/styled.css` (tokens + parts).
 */
import '@stellar-passkey/ui/styled.css';
import './demo.css';

import type { PasskeyCredential } from '@stellar-passkey/core/types';
import type { RecoverResult } from '@stellar-passkey/core/recover';
import {
  createView,
  signView,
  recoverView,
  mountCreateScreen,
  mountSignScreen,
  mountRecoverScreen,
  DEFAULT_CREATE_COPY,
  DEFAULT_SIGN_COPY,
  DEFAULT_RECOVER_COPY,
  type CreateCtx,
  type SignCtx,
  type RecoverCtx,
} from '@stellar-passkey/ui/styled';
import { createDemo, type Demo } from './demoKit';

declare global {
  interface Window {
    __demo: {
      flows: Pick<Demo, 'createFlow' | 'signFlow' | 'recoverFlow'>;
      control: Demo['control'];
      reset: () => void;
      scope: HTMLElement;
    };
  }
}

// ---- sample data for the static gallery ------------------------------------
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

function galleryTiles(): Array<[string, HTMLElement]> {
  const firstAccount = SAMPLE_ACCOUNTS[0] ?? { contractId: 'C', credentialId: 'k' };
  return [
    ['create · idle', createView({ status: 'idle' }, createCtx)],
    ['create · prompting', createView({ status: 'prompting' }, createCtx)],
    ['create · deploying', createView({ status: 'deploying' }, createCtx)],
    ['create · success', createView({ status: 'success', credential: SAMPLE_CRED }, createCtx)],
    [
      'create · error(USER_CANCELLED)',
      createView({ status: 'error', code: 'USER_CANCELLED', message: '' }, createCtx),
    ],
    ['sign · idle', signView({ status: 'idle' }, signCtx)],
    ['sign · prompting', signView({ status: 'prompting' }, signCtx)],
    ['sign · submitting', signView({ status: 'submitting' }, signCtx)],
    [
      'sign · done',
      signView({ status: 'done', result: { status: 'SUCCESS', hash: SAMPLE_HASH } }, signCtx),
    ],
    [
      'sign · error(CONTRACT_AUTH_FAILED)',
      signView({ status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' }, signCtx),
    ],
    ['recover · idle', recoverView({ status: 'idle' }, [], recoverCtx)],
    ['recover · discovering', recoverView({ status: 'discovering' }, [], recoverCtx)],
    [
      'recover · resolved',
      recoverView({ status: 'resolved', accounts: SAMPLE_ACCOUNTS }, SAMPLE_ACCOUNTS, recoverCtx),
    ],
    [
      'recover · selected',
      recoverView({ status: 'selected', account: firstAccount }, SAMPLE_ACCOUNTS, recoverCtx),
    ],
    ['recover · none', recoverView({ status: 'none' }, [], recoverCtx)],
    [
      'recover · error(NETWORK_ERROR)',
      recoverView({ status: 'error', code: 'NETWORK_ERROR', message: '' }, [], recoverCtx),
    ],
  ];
}

// ---- tweaks bar (token overrides on the scope = the re-theme gate) ---------
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...kids: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) node.setAttribute(k, v);
  node.append(...kids);
  return node;
}

function buildTweaks(scope: HTMLElement): HTMLElement {
  const toggle = (
    label: string,
    testid: string,
    on: () => void,
    off: () => void,
  ): HTMLButtonElement => {
    const btn = el(
      'button',
      { class: 'demo-btn', 'data-testid': testid, 'aria-pressed': 'false' },
      label,
    );
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(next));
      if (next) on();
      else off();
    });
    return btn;
  };

  const group = (label: string, ...kids: Node[]): HTMLElement =>
    el('div', { class: 'demo-group' }, el('span', { class: 'demo-group__label' }, label), ...kids);

  const themeBtn = toggle(
    'Dark',
    'tweak-dark',
    () => scope.setAttribute('data-theme', 'dark'),
    () => scope.removeAttribute('data-theme'),
  );
  const brandBtn = toggle(
    'Teal brand',
    'tweak-brand',
    () => {
      scope.style.setProperty('--pk-color-brand', 'oklch(0.7 0.13 190)');
      scope.style.setProperty('--pk-color-brand-hover', 'oklch(0.64 0.13 190)');
      scope.style.setProperty('--pk-color-brand-active', 'oklch(0.58 0.13 190)');
    },
    () => {
      scope.style.removeProperty('--pk-color-brand');
      scope.style.removeProperty('--pk-color-brand-hover');
      scope.style.removeProperty('--pk-color-brand-active');
    },
  );
  const radiusBtn = toggle(
    'Sharp',
    'tweak-radius',
    () => {
      scope.style.setProperty('--pk-radius-lg', '2px');
      scope.style.setProperty('--pk-radius-md', '2px');
    },
    () => {
      scope.style.removeProperty('--pk-radius-lg');
      scope.style.removeProperty('--pk-radius-md');
    },
  );
  const rtlBtn = toggle(
    'RTL',
    'tweak-rtl',
    () => scope.setAttribute('dir', 'rtl'),
    () => scope.removeAttribute('dir'),
  );
  const motionBtn = toggle(
    'Reduce motion',
    'tweak-motion',
    () => scope.setAttribute('data-reduced-motion', 'true'),
    () => scope.removeAttribute('data-reduced-motion'),
  );

  return el(
    'header',
    { class: 'demo-bar' },
    el(
      'div',
      { class: 'demo-bar__title' },
      'Stellar Passkey UI — styled reference (S20)',
      el('small', {}, 'token-driven · re-theme by override, never by editing components'),
    ),
    group('Theme', themeBtn, brandBtn, radiusBtn),
    group('A11y', rtlBtn, motionBtn),
  );
}

function section(title: string, body: HTMLElement): HTMLElement {
  return el(
    'section',
    { class: 'demo-section' },
    el('h2', { class: 'demo-section__title' }, title),
    body,
  );
}

function main(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');

  const scope = el('div', { class: 'pk demo-scope' });

  // 1. tweaks bar
  scope.append(buildTweaks(scope));

  // 2. static gallery — all 16 states
  const grid = el('div', { class: 'demo-grid' });
  for (const [caption, cardEl] of galleryTiles()) {
    grid.append(
      el('div', { class: 'demo-tile' }, el('div', { class: 'demo-tile__cap' }, caption), cardEl),
    );
  }
  scope.append(section('All 16 states (static gallery)', grid));

  // 3. interactive cards driving the real headless flows
  const demo = createDemo();
  const live = el('div', { class: 'demo-live' });
  const createMount = el('div', { 'data-testid': 'live-create' });
  const signMount = el('div', { 'data-testid': 'live-sign' });
  const recoverMount = el('div', { 'data-testid': 'live-recover' });
  live.append(createMount, signMount, recoverMount);
  scope.append(section(`Live — drives the headless flows (mode: ${demo.mode})`, live));

  mountCreateScreen(createMount, {
    flow: demo.createFlow,
    onContinue: noop,
    onHelp: () => globalThis.alert('A passkey is a Face ID / Touch ID / security-key credential.'),
  });
  mountSignScreen(signMount, {
    flow: demo.signFlow,
    tx: demo.tx,
    onExplorer: (hash) =>
      globalThis.open(`https://stellar.expert/explorer/testnet/tx/${hash}`, '_blank'),
  });
  mountRecoverScreen(recoverMount, {
    flow: demo.recoverFlow,
    accountMeta: (_account, index) => `Recovered account ${String(index + 1)}`,
    onCreateNew: () => demo.createFlow.reset(),
  });

  app.append(scope);

  window.__demo = {
    flows: { createFlow: demo.createFlow, signFlow: demo.signFlow, recoverFlow: demo.recoverFlow },
    control: demo.control,
    reset: () => {
      demo.createFlow.reset();
      demo.signFlow.reset();
      demo.recoverFlow.reset();
    },
    scope,
  };
}

main();
