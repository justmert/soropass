/**
 * Screen 3 — Recover (6 states). Bound to the S18 `RecoverFlow`. The headless
 * layer deliberately ships the listbox roles + selection but NOT the keyboard
 * pattern; the styled layer adds roving focus + Up/Down/Home/End/Enter/Space
 * (the documented "connector" addition) without duplicating flow logic.
 */
import type { RecoverFlow, RecoverFlowState } from '../headless';
import type { RecoverResult } from '@soropass/core/recover';
import { h, icon, identicon, truncMiddle, type Child } from './dom';
import {
  button,
  card,
  dim,
  errorView,
  header,
  link,
  resultLayout,
  waitOverlay,
} from './components';
import { mountScreen, type ScreenHandle } from './mount';

export interface RecoverCopy {
  idleTitle: string;
  idleSubtitle: string;
  recoverLabel: string;
  discoveringTitle: string;
  discoveringHint: string;
  manyTitle: (count: number) => string;
  manySubtitle: string;
  singleTitle: string;
  singleSubtitle: string;
  continueLabel: string;
  listAriaLabel: string;
  noneTitle: string;
  noneMessage: string;
  createNewLabel: string;
  tryDifferentLabel: string;
}

export const DEFAULT_RECOVER_COPY: RecoverCopy = {
  idleTitle: 'Find your account',
  idleSubtitle: 'Use your passkey to find the accounts it controls — no seed phrase needed.',
  recoverLabel: 'Recover',
  discoveringTitle: 'Looking for your accounts',
  discoveringHint: 'Confirm with your passkey so we can find the accounts it controls.',
  manyTitle: (count) => `${String(count)} accounts found`,
  manySubtitle: 'Choose the account you’d like to use.',
  singleTitle: 'Account found',
  singleSubtitle: 'This passkey controls the account below.',
  continueLabel: 'Continue',
  listAriaLabel: 'Accounts for this passkey',
  noneTitle: 'No accounts found',
  noneMessage:
    'This passkey isn’t linked to any accounts yet. You can create a new wallet, or try a different passkey.',
  createNewLabel: 'Create a new passkey instead',
  tryDifferentLabel: 'Try a different passkey',
};

export interface RecoverCtx {
  copy: RecoverCopy;
  meta: (account: RecoverResult, index: number) => string;
  onRecover: () => void;
  onRetry: () => void;
  onSelect: (account: RecoverResult) => void;
  onContinue: (account: RecoverResult) => void;
  onCreateNew: () => void;
  onTryDifferent: () => void;
}

/**
 * The real listbox: `role="listbox"` with `role="option"` rows, roving tabindex,
 * and the full keyboard pattern. Arrow keys move focus locally (no re-render);
 * Enter / Space / click commit a selection through the headless flow.
 */
function recoverList(
  accounts: RecoverResult[],
  selectedId: string | null,
  ctx: RecoverCtx,
): HTMLElement {
  const options: HTMLElement[] = [];
  const selectedIndex = accounts.findIndex((a) => a.contractId === selectedId);
  let activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const ul = h('ul', {
    class: 'pk-listbox',
    role: 'listbox',
    'aria-label': ctx.copy.listAriaLabel,
  });

  accounts.forEach((account, i) => {
    const isSelected = account.contractId === selectedId;
    const isActive = i === activeIndex;
    const li = h(
      'li',
      {
        role: 'option',
        'aria-selected': isSelected,
        id: `passkey-recover-option-${String(i)}`,
        tabIndex: isActive ? 0 : -1,
        class: `pk-option${isActive ? ' is-active' : ''}`,
        // Focus lands here on entering resolved/selected (see mount focus rules).
        ...(isActive ? { 'data-pk-focus': '' } : {}),
        onClick: () => ctx.onSelect(account),
      },
      identicon(account.contractId),
      h(
        'span',
        { class: 'pk-option__body' },
        h('span', { class: 'pk-option__addr' }, truncMiddle(account.contractId)),
        h('span', { class: 'pk-option__meta' }, ctx.meta(account, i)),
      ),
      h('span', { class: 'pk-option__check' }, icon('check', 20)),
    );
    options.push(li);
    ul.append(li);
  });

  const setActive = (next: number): void => {
    const i = (next + accounts.length) % accounts.length;
    const prev = options[activeIndex];
    if (prev) {
      prev.tabIndex = -1;
      prev.classList.remove('is-active');
    }
    const cur = options[i];
    if (cur) {
      cur.tabIndex = 0;
      cur.classList.add('is-active');
      cur.focus({ preventScroll: true });
    }
    activeIndex = i;
  };

  ul.addEventListener('keydown', (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(accounts.length - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const account = accounts[activeIndex];
        if (account) ctx.onSelect(account);
        break;
      }
      default:
        break;
    }
  });

  return ul;
}

function resolvedCard(
  accounts: RecoverResult[],
  selectedId: string | null,
  ctx: RecoverCtx,
): HTMLElement {
  const many = accounts.length > 1;
  const selected = selectedId ? (accounts.find((a) => a.contractId === selectedId) ?? null) : null;
  return card(
    { screen: 'recover', state: selectedId ? 'selected' : 'resolved' },
    h(
      'div',
      { class: 'pk-head' },
      h(
        'div',
        { class: 'pk-head__text' },
        h(
          'h2',
          { class: 'pk-title' },
          many ? ctx.copy.manyTitle(accounts.length) : ctx.copy.singleTitle,
        ),
        h('p', { class: 'pk-subtitle' }, many ? ctx.copy.manySubtitle : ctx.copy.singleSubtitle),
      ),
    ),
    recoverList(accounts, selectedId, ctx),
    h(
      'div',
      { class: 'pk-actions' },
      button({
        variant: 'primary',
        label: ctx.copy.continueLabel,
        disabled: selected === null,
        onClick: () => {
          if (selected) ctx.onContinue(selected);
        },
      }),
    ),
  );
}

/** Pure view: render the card for an explicit Recover state + the resolved account list. */
export function recoverView(
  state: RecoverFlowState,
  accounts: RecoverResult[],
  ctx: RecoverCtx,
): HTMLElement {
  const idle = (): Child[] => [
    header({ glyph: 'key', title: ctx.copy.idleTitle, subtitle: ctx.copy.idleSubtitle }),
    h(
      'div',
      { class: 'pk-actions' },
      button({
        variant: 'primary',
        icon: icon('key', 18),
        label: ctx.copy.recoverLabel,
        onClick: ctx.onRecover,
      }),
    ),
  ];

  switch (state.status) {
    case 'idle':
      return card({ screen: 'recover', state: 'idle' }, ...idle());
    case 'discovering':
      return card(
        { screen: 'recover', state: 'discovering', waiting: true },
        dim(...idle()),
        waitOverlay({ title: ctx.copy.discoveringTitle, hint: ctx.copy.discoveringHint }),
      );
    case 'resolved':
      return resolvedCard(state.accounts, null, ctx);
    case 'selected':
      return resolvedCard(accounts, state.account.contractId, ctx);
    case 'none':
      return card(
        { screen: 'recover', state: 'none' },
        resultLayout({
          glyphTone: 'muted',
          glyphIcon: 'key',
          title: ctx.copy.noneTitle,
          message: ctx.copy.noneMessage,
          actions: [
            button({
              variant: 'primary',
              icon: icon('plus', 18),
              label: ctx.copy.createNewLabel,
              onClick: ctx.onCreateNew,
            }),
            link({ label: ctx.copy.tryDifferentLabel, onClick: ctx.onTryDifferent }),
          ],
        }),
      );
    case 'error':
      return card(
        { screen: 'recover', state: 'error' },
        errorView({ screen: 'recover', code: state.code, onRetry: ctx.onRetry }),
      );
  }
}

export interface RecoverScreenOptions {
  flow: RecoverFlow;
  copy?: Partial<RecoverCopy>;
  /** Meta line under each account (e.g. "Last used 2 days ago"). */
  accountMeta?: (account: RecoverResult, index: number) => string;
  onContinue?: (account: RecoverResult) => void;
  /** "Create a new passkey instead" — host navigates to the Create screen. */
  onCreateNew?: () => void;
}

/** Mount the styled Recover screen, bound to a headless `RecoverFlow`. */
export function mountRecoverScreen(root: HTMLElement, opts: RecoverScreenOptions): ScreenHandle {
  const copy: RecoverCopy = { ...DEFAULT_RECOVER_COPY, ...opts.copy };
  // The headless `selected` state carries only the chosen account; cache the
  // resolved list so the styled list keeps rendering with one row highlighted.
  let cachedAccounts: RecoverResult[] = [];
  const ctx: RecoverCtx = {
    copy,
    meta: (account, index) => opts.accountMeta?.(account, index) ?? 'Stellar smart account',
    onRecover: () => void opts.flow.start(),
    onRetry: () => void opts.flow.start(),
    onTryDifferent: () => void opts.flow.start(),
    onSelect: (account) => opts.flow.select(account),
    onContinue: (account) => opts.onContinue?.(account),
    onCreateNew: () => opts.onCreateNew?.(),
  };
  return mountScreen(root, opts.flow, (state) => {
    if (state.status === 'resolved') cachedAccounts = state.accounts;
    return recoverView(state, cachedAccounts, ctx);
  });
}
