/**
 * Connect — the entry chooser (P0). One `idle` surface that forks "create a new
 * passkey wallet" vs "use an existing passkey". Holds no flow state: it renders
 * two choices and routes out (create → Create screen; use existing → the kit's
 * own modal). Tiny glue, built from the shared token set.
 */
import { h, icon, type IconName } from './dom';
import type { ScreenHandle } from './mount';

export interface ConnectCopy {
  title: string;
  subtitle: string;
  createTitle: string;
  createSubtitle: string;
  existingTitle: string;
  existingSubtitle: string;
  helpLabel: string;
}

export const DEFAULT_CONNECT_COPY: ConnectCopy = {
  title: 'Connect your wallet',
  subtitle: 'Sign in with a passkey — your Face ID, fingerprint, or security key. No seed phrase.',
  createTitle: 'Create a new passkey wallet',
  createSubtitle: 'Make a brand-new smart account.',
  existingTitle: 'Use an existing passkey',
  existingSubtitle: 'Find an account this passkey already controls.',
  helpLabel: 'What’s a passkey?',
};

export interface ConnectCtx {
  copy: ConnectCopy;
  onCreate: () => void;
  onUseExisting: () => void;
  onHelp: () => void;
}

function choiceRow(opts: {
  glyph: IconName;
  brand?: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}): HTMLButtonElement {
  return h(
    'button',
    { class: 'pk-choice', type: 'button', onClick: opts.onClick },
    h('span', { class: `pk-choice__icon${opts.brand ? ' pk-choice__icon--brand' : ''}` }, icon(opts.glyph, 22)),
    h(
      'span',
      { class: 'pk-choice__body' },
      h('span', { class: 'pk-choice__title' }, opts.title),
      h('span', { class: 'pk-choice__sub' }, opts.subtitle),
    ),
    h('span', { class: 'pk-choice__chev' }, icon('chevron', 18)),
  );
}

/** Pure view: the connect chooser card. */
export function connectView(ctx: ConnectCtx): HTMLElement {
  return h(
    'div',
    { class: 'pk-card', 'data-pk-screen': 'connect', 'data-pk-state': 'idle' },
    h(
      'div',
      { class: 'pk-head pk-head--center' },
      h('span', { class: 'pk-glyph' }, icon('passkey')),
      h(
        'div',
        { class: 'pk-head__text' },
        h('h2', { class: 'pk-title' }, ctx.copy.title),
        h('p', { class: 'pk-subtitle' }, ctx.copy.subtitle),
      ),
    ),
    h(
      'div',
      { class: 'pk-choices' },
      choiceRow({
        glyph: 'passkey',
        brand: true,
        title: ctx.copy.createTitle,
        subtitle: ctx.copy.createSubtitle,
        onClick: ctx.onCreate,
      }),
      choiceRow({
        glyph: 'key',
        title: ctx.copy.existingTitle,
        subtitle: ctx.copy.existingSubtitle,
        onClick: ctx.onUseExisting,
      }),
    ),
    h('button', { class: 'pk-link', type: 'button', onClick: ctx.onHelp }, icon('help', 14), ctx.copy.helpLabel),
  );
}

export interface ConnectScreenOptions {
  copy?: Partial<ConnectCopy>;
  /** Open the Create flow (mount the Create screen). */
  onCreate?: () => void;
  /** Hand off to the kit's own modal (getAddress → discoverable credential). */
  onUseExisting?: () => void;
  onHelp?: () => void;
}

/** Mount the styled Connect chooser. Stateless — both choices route out. */
export function mountConnectScreen(root: HTMLElement, opts: ConnectScreenOptions = {}): ScreenHandle {
  const copy: ConnectCopy = { ...DEFAULT_CONNECT_COPY, ...opts.copy };
  const ctx: ConnectCtx = {
    copy,
    onCreate: () => opts.onCreate?.(),
    onUseExisting: () => opts.onUseExisting?.(),
    onHelp: () => opts.onHelp?.(),
  };
  root.replaceChildren(connectView(ctx));
  return { unmount: () => root.replaceChildren() };
}
