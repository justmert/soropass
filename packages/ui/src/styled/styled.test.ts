// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { KitError, KIT_ERROR_CODES, type KitErrorCode } from '@soropass/core/types';
import type { RecoverResult } from '@soropass/core/recover';
import { createCreatePasskeyFlow, createSignFlow, createRecoverFlow } from '../headless';
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
  ERROR_COPY,
  errorCopyFor,
  errorKeyFor,
  type CreateCtx,
  type SignCtx,
  type RecoverCtx,
} from './index';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const noop = (): void => {};

const CRED = {
  contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP',
  credentialId: 'cred-1',
  publicKey: new Uint8Array(65),
};
const ACCOUNTS: RecoverResult[] = [
  { contractId: 'C1AAA2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9X', credentialId: 'k' },
  { contractId: 'C2BBB8GH1J2K3L4M5N6P7Q8R9S0T1U2V3W4X5Y6Z7B8DEF8GH1J2K3', credentialId: 'k' },
  { contractId: 'C3CCC8Y7X6W5V4U3T2S1R0P9N8M7L6K5J4H3G2F1D0BQ9Z8Y7X6W5V', credentialId: 'k' },
];

const createCtx = (over: Partial<CreateCtx> = {}): CreateCtx => ({
  copy: DEFAULT_CREATE_COPY,
  onCreate: noop,
  onRetry: noop,
  onContinue: noop,
  onHelp: noop,
  ...over,
});
const signCtx = (over: Partial<SignCtx> = {}): SignCtx => ({
  copy: DEFAULT_SIGN_COPY,
  tx: { amountValue: '250.00 USDC', destination: 'GABC', action: 'transfer' },
  onSign: noop,
  onCancel: noop,
  onRetry: noop,
  onDone: noop,
  onExplorer: noop,
  ...over,
});
const recoverCtx = (over: Partial<RecoverCtx> = {}): RecoverCtx => ({
  copy: DEFAULT_RECOVER_COPY,
  meta: () => 'meta',
  onRecover: noop,
  onRetry: noop,
  onSelect: noop,
  onContinue: noop,
  onCreateNew: noop,
  onTryDifferent: noop,
  ...over,
});

function mountRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('static views — structure + data attributes (16 states)', () => {
  it('renders every Create state with stable data-pk-state', () => {
    const states = [
      createView({ status: 'idle' }, createCtx()),
      createView({ status: 'prompting' }, createCtx()),
      createView({ status: 'deploying' }, createCtx()),
      createView({ status: 'success', credential: CRED }, createCtx()),
      createView({ status: 'error', code: 'USER_CANCELLED', message: '' }, createCtx()),
    ];
    expect(states.map((c) => c.getAttribute('data-pk-state'))).toEqual([
      'idle',
      'prompting',
      'deploying',
      'success',
      'error',
    ]);
    expect(states.every((c) => c.getAttribute('data-pk-screen') === 'create')).toBe(true);
    // success shows the truncated C-address + a copy button
    const success = states[3];
    if (!success) throw new Error('missing success card');
    expect(success.querySelector('.pk-address__text')?.textContent).toContain('…');
    expect(success.querySelector('.pk-copy')).not.toBeNull();
  });

  it('renders every Sign state; idle shows the host-supplied tx summary', () => {
    const idle = signView({ status: 'idle' }, signCtx());
    expect(idle.querySelector('.pk-summary__amount-value')?.textContent).toBe('250.00 USDC');
    expect(idle.querySelectorAll('.pk-actions--row .pk-btn').length).toBe(2);
    const longHash = 'a1b9f4c7e2d8053614af9b2c7e0d4f6182a3c5d7e9b0f1234567890abcdef1234';
    const done = signView(
      { status: 'done', result: { status: 'SUCCESS', hash: longHash } },
      signCtx(),
    );
    expect(done.getAttribute('data-pk-state')).toBe('done');
    expect(done.querySelector('.pk-address__text')?.textContent).toContain('…');
    expect(done.querySelector('.pk-address__text')?.getAttribute('title')).toBe(longHash);
  });

  it('renders every Recover state; resolved shows a listbox of accounts', () => {
    const resolved = recoverView(
      { status: 'resolved', accounts: ACCOUNTS },
      ACCOUNTS,
      recoverCtx(),
    );
    expect(resolved.querySelector('[role="listbox"]')).not.toBeNull();
    expect(resolved.querySelectorAll('[role="option"]').length).toBe(3);
    const none = recoverView({ status: 'none' }, [], recoverCtx());
    expect(none.getAttribute('data-pk-state')).toBe('none');
    expect(none.textContent).toContain('No accounts found');
  });
});

describe('a11y — busy looks, live regions, focus targets', () => {
  it('prompting/discovering are "OS sheet open": scrim + pulsing glyph, NO spinner', () => {
    for (const card of [
      createView({ status: 'prompting' }, createCtx()),
      recoverView({ status: 'discovering' }, [], recoverCtx()),
    ]) {
      expect(card.classList.contains('is-waiting')).toBe(true);
      expect(card.querySelector('.pk-wait')).not.toBeNull();
      expect(card.querySelector('.pk-ossheet')).not.toBeNull();
      expect(card.querySelector('.pk-spinner')).toBeNull(); // no spinner fighting the OS dialog
      const hint = card.querySelector('.pk-wait__hint');
      expect(hint?.getAttribute('aria-live')).toBe('polite');
      expect(hint?.getAttribute('data-pk-focus')).toBe('');
    }
  });

  it('deploying/submitting are "we\'re working": spinner + progress, polite', () => {
    for (const card of [
      createView({ status: 'deploying' }, createCtx()),
      signView({ status: 'submitting' }, signCtx()),
    ]) {
      expect(card.querySelector('.pk-spinner')).not.toBeNull();
      expect(card.querySelector('.pk-progress')).not.toBeNull();
      expect(card.querySelector('.pk-work__hint')?.getAttribute('aria-live')).toBe('polite');
    }
  });

  it('error is one assertive alert layout that receives focus', () => {
    const card = signView({ status: 'error', code: 'NETWORK_ERROR', message: '' }, signCtx());
    const msg = card.querySelector('.pk-message');
    expect(msg?.getAttribute('role')).toBe('alert');
    expect(msg?.getAttribute('aria-live')).toBe('assertive');
    expect(msg?.getAttribute('tabindex')).toBe('-1');
    expect(msg?.getAttribute('data-pk-focus')).toBe('');
    expect(card.querySelector('.pk-errcode')?.textContent).toContain('error code:');
  });

  it('success/done/none focus the status message (polite)', () => {
    for (const card of [
      createView({ status: 'success', credential: CRED }, createCtx()),
      signView({ status: 'done', result: { status: 'SUCCESS', hash: 'h' } }, signCtx()),
      recoverView({ status: 'none' }, [], recoverCtx()),
    ]) {
      const msg = card.querySelector('.pk-message');
      expect(msg?.getAttribute('aria-live')).toBe('polite');
      expect(msg?.getAttribute('data-pk-focus')).toBe('');
    }
  });
});

describe('error connector — every KitErrorCode maps to valid design copy', () => {
  it('maps all 10 codes on all 3 screens to an existing ERROR_COPY entry', () => {
    for (const screen of ['create', 'sign', 'recover'] as const) {
      for (const code of KIT_ERROR_CODES) {
        const key = errorKeyFor(screen, code as KitErrorCode);
        expect(key.startsWith(`${screen}:`)).toBe(true);
        expect(ERROR_COPY[key]).toBeDefined();
        expect(errorCopyFor(screen, code as KitErrorCode).title.length).toBeGreaterThan(0);
      }
    }
  });

  it('renders the resolved copy + code suffix + data hooks in the error view', () => {
    const card = createView(
      { status: 'error', code: 'ES256_NOT_SUPPORTED', message: '' },
      createCtx(),
    );
    const result = card.querySelector('.pk-result');
    expect(result?.getAttribute('data-error-key')).toBe('create:onchain');
    expect(result?.getAttribute('data-kit-code')).toBe('ES256_NOT_SUPPORTED');
    expect(card.querySelector('.pk-title')?.textContent).toBe(ERROR_COPY['create:onchain'].title);
    expect(card.querySelector('.pk-errcode')?.textContent).toBe('error code: onchain');
  });
});

describe('consistency — styled a11y matches the headless prop-getters', () => {
  it('error live-region politeness matches getStatusProps across flows', async () => {
    const cFlow = createCreatePasskeyFlow({
      create: () => Promise.reject(new KitError('USER_CANCELLED', 'x')),
    });
    await cFlow.start();
    expect(cFlow.getStatusProps()['aria-live']).toBe('assertive');
    const cCard = createView(cFlow.getState(), createCtx());
    expect(cCard.querySelector('.pk-message')?.getAttribute('aria-live')).toBe('assertive');
  });

  it('recover option ids match getOptionProps ids', () => {
    const flow = createRecoverFlow({ recover: () => Promise.resolve(ACCOUNTS) });
    const card = recoverView({ status: 'resolved', accounts: ACCOUNTS }, ACCOUNTS, recoverCtx());
    const ids = [...card.querySelectorAll('[role="option"]')].map((o) => o.id);
    const account0 = ACCOUNTS[0];
    if (!account0) throw new Error('fixture');
    // The id scheme is the headless contract; the aria-label is design copy
    // (overridable), so they legitimately differ from the headless default.
    expect(ids[0]).toBe(flow.getOptionProps(account0, 0).id);
    expect(ids).toEqual([
      'passkey-recover-option-0',
      'passkey-recover-option-1',
      'passkey-recover-option-2',
    ]);
    expect(card.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe(
      DEFAULT_RECOVER_COPY.listAriaLabel,
    );
  });
});

describe('mounted Create flow — full journey + retry', () => {
  it('idle → prompting → deploying → success renders the address chip; copy works', async () => {
    const root = mountRoot();
    const flow = createCreatePasskeyFlow({
      create: (_input, report) => {
        report.deploying();
        return Promise.resolve(CRED);
      },
    });
    mountCreateScreen(root, { flow });
    expect(root.querySelector('[data-pk-state="idle"]')).not.toBeNull();
    await flow.start();
    await flush();
    expect(root.querySelector('[data-pk-state="success"]')).not.toBeNull();
    const copyBtn = root.querySelector<HTMLButtonElement>('.pk-copy');
    copyBtn?.click();
    expect(copyBtn?.classList.contains('is-copied')).toBe(true);
    expect(copyBtn?.getAttribute('aria-label')).toBe('Address copied');
  });

  it('error → retry re-runs start() (no extra gesture needed)', async () => {
    const root = mountRoot();
    let attempts = 0;
    const flow = createCreatePasskeyFlow({
      create: (_input, report) => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new KitError('NETWORK_ERROR', 'down'));
        report.deploying();
        return Promise.resolve(CRED);
      },
    });
    mountCreateScreen(root, { flow });
    await flow.start();
    await flush();
    const errCard = root.querySelector('[data-pk-state="error"]');
    expect(errCard?.querySelector('.pk-result')?.getAttribute('data-kit-code')).toBe(
      'NETWORK_ERROR',
    );
    root.querySelector<HTMLButtonElement>('.pk-result .pk-btn--primary')?.click();
    await flush();
    expect(root.querySelector('[data-pk-state="success"]')).not.toBeNull();
    expect(attempts).toBe(2);
  });
});

describe('mounted Recover flow — listbox keyboard pattern (S20 gate)', () => {
  async function mountResolved(): Promise<HTMLElement> {
    const root = mountRoot();
    const flow = createRecoverFlow({ recover: () => Promise.resolve(ACCOUNTS) });
    mountRecoverScreen(root, { flow });
    await flow.start();
    await flush();
    return root;
  }

  function options(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>('[role="option"]')];
  }
  function key(root: HTMLElement, k: string): void {
    root
      .querySelector('[role="listbox"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }

  it('roving tabindex: only the active option is tabbable, and arrows move it (wrapping)', async () => {
    const root = await mountResolved();
    const opts = options(root);
    expect(opts.length).toBe(3);
    expect(opts.map((o) => o.tabIndex)).toEqual([0, -1, -1]);

    key(root, 'ArrowDown');
    expect(options(root).map((o) => o.tabIndex)).toEqual([-1, 0, -1]);
    expect(options(root)[1]?.classList.contains('is-active')).toBe(true);

    key(root, 'ArrowUp');
    key(root, 'ArrowUp'); // wraps from index 0 → last
    expect(options(root).map((o) => o.tabIndex)).toEqual([-1, -1, 0]);

    key(root, 'Home');
    expect(options(root).map((o) => o.tabIndex)).toEqual([0, -1, -1]);
    key(root, 'End');
    expect(options(root).map((o) => o.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('Enter selects the active option → selected state, Continue enabled', async () => {
    const root = await mountResolved();
    expect(root.querySelector<HTMLButtonElement>('.pk-actions .pk-btn--primary')?.disabled).toBe(
      true,
    );
    key(root, 'ArrowDown'); // active = option 1
    key(root, 'Enter');
    await flush();
    const selectedCard = root.querySelector('[data-pk-state="selected"]');
    expect(selectedCard).not.toBeNull();
    expect(selectedCard?.querySelector('[aria-selected="true"]')?.id).toBe(
      'passkey-recover-option-1',
    );
    expect(root.querySelector<HTMLButtonElement>('.pk-actions .pk-btn--primary')?.disabled).toBe(
      false,
    );
  });

  it('Space also selects the active option', async () => {
    const root = await mountResolved();
    key(root, ' ');
    await flush();
    expect(root.querySelector('[data-pk-state="selected"]')).not.toBeNull();
  });

  it('lets the user change their selection while in selected (no roving/aria desync)', async () => {
    const root = await mountResolved();
    key(root, 'Enter'); // select option 0
    await flush();
    expect(root.querySelector('[aria-selected="true"]')?.id).toBe('passkey-recover-option-0');
    // still in selected: rove to the last option and re-select
    key(root, 'End');
    key(root, 'Enter');
    await flush();
    expect(root.querySelector('[data-pk-state="selected"]')).not.toBeNull();
    expect(root.querySelectorAll('[aria-selected="true"]').length).toBe(1);
    expect(root.querySelector('[aria-selected="true"]')?.id).toBe('passkey-recover-option-2');
    expect(root.querySelector<HTMLButtonElement>('.pk-actions .pk-btn--primary')?.disabled).toBe(
      false,
    );
  });
});

describe('token gate — no raw inline visual values leak into components', () => {
  it('every inline style across all 16 states is a --pk token override (no raw literals)', () => {
    const a0 = ACCOUNTS[0];
    if (!a0) throw new Error('fixture');
    const cards: HTMLElement[] = [
      createView({ status: 'idle' }, createCtx()),
      createView({ status: 'prompting' }, createCtx()),
      createView({ status: 'deploying' }, createCtx()),
      createView({ status: 'success', credential: CRED }, createCtx()),
      createView({ status: 'error', code: 'USER_CANCELLED', message: '' }, createCtx()),
      signView({ status: 'idle' }, signCtx()),
      signView({ status: 'prompting' }, signCtx()),
      signView({ status: 'submitting' }, signCtx()),
      signView({ status: 'done', result: { status: 'SUCCESS', hash: 'h' } }, signCtx()),
      signView({ status: 'error', code: 'NETWORK_ERROR', message: '' }, signCtx()),
      recoverView({ status: 'idle' }, [], recoverCtx()),
      recoverView({ status: 'discovering' }, [], recoverCtx()),
      recoverView({ status: 'resolved', accounts: ACCOUNTS }, ACCOUNTS, recoverCtx()),
      recoverView({ status: 'selected', account: a0 }, ACCOUNTS, recoverCtx()),
      recoverView({ status: 'none' }, [], recoverCtx()),
      recoverView({ status: 'error', code: 'NETWORK_ERROR', message: '' }, [], recoverCtx()),
    ];
    let inlineStyles = 0;
    for (const card of cards) {
      for (const el of card.querySelectorAll<HTMLElement>('[style]')) {
        inlineStyles += 1;
        // any inline style must be a token override, never a raw literal
        expect(el.getAttribute('style')).toContain('var(--pk-');
      }
    }
    // the only inline style in the whole layer is the (token-driven) submit dim
    expect(inlineStyles).toBe(1);
  });
});

describe('mounted Recover — none + error connector', () => {
  it('resolves to the none empty-state when no accounts are found', async () => {
    const root = mountRoot();
    const flow = createRecoverFlow({ recover: () => Promise.resolve([]) });
    mountRecoverScreen(root, { flow });
    await flow.start();
    await flush();
    expect(root.querySelector('[data-pk-state="none"]')).not.toBeNull();
  });

  it('surfaces recover:network for a NETWORK_ERROR rejection', async () => {
    const root = mountRoot();
    const flow = createRecoverFlow({
      recover: () => Promise.reject(new KitError('NETWORK_ERROR', 'down')),
    });
    mountRecoverScreen(root, { flow });
    await flow.start();
    await flush();
    expect(root.querySelector('.pk-result')?.getAttribute('data-error-key')).toBe(
      'recover:network',
    );
  });
});

describe('mounted Sign flow — submit FAILED maps to the verify error', () => {
  it('idle → prompting → submitting → done shows the tx hash', async () => {
    const root = mountRoot();
    const flow = createSignFlow({
      sign: () => Promise.resolve('XDR'),
      submit: () => Promise.resolve({ status: 'SUCCESS', hash: 'feed' }),
    });
    mountSignScreen(root, { flow, tx: { amountValue: '1 XLM', destination: 'G', action: 'pay' } });
    await flow.start();
    await flush();
    expect(root.querySelector('[data-pk-state="done"]')).not.toBeNull();
    expect(root.querySelector('.pk-address__text')?.getAttribute('title')).toBe('feed');
  });

  it('FAILED submission → CONTRACT_AUTH_FAILED → sign:verify copy', async () => {
    const root = mountRoot();
    const flow = createSignFlow({
      sign: () => Promise.resolve('XDR'),
      submit: () => Promise.resolve({ status: 'FAILED', hash: 'h' }),
    });
    mountSignScreen(root, { flow, tx: { amountValue: '1 XLM', destination: 'G', action: 'pay' } });
    await flow.start();
    await flush();
    const result = root.querySelector('.pk-result');
    expect(result?.getAttribute('data-kit-code')).toBe('CONTRACT_AUTH_FAILED');
    expect(result?.getAttribute('data-error-key')).toBe('sign:verify');
  });
});
