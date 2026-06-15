/**
 * Shared styled building blocks. Pure DOM, pure design classes (every value
 * resolves to a token in `tokens.css`). No flow logic lives here — screens wire
 * these to the headless state machines.
 */
import { h, icon, identicon, truncMiddle, type Child, type IconName } from './dom';
import { errorCopyFor, errorKeyFor, type Screen } from './errors';
import type { KitErrorCode } from '@soropass/core/types';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonOptions {
  variant: ButtonVariant;
  label: string;
  icon?: SVGElement;
  busy?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}

export function button(opts: ButtonOptions): HTMLButtonElement {
  const children: Child[] = [];
  if (opts.busy) {
    children.push(h('span', { class: 'pk-spinner pk-btn__spinner', 'aria-hidden': 'true' }));
  } else if (opts.icon) {
    children.push(opts.icon);
  }
  children.push(opts.label);
  const props: Record<string, unknown> = {
    class: `pk-btn pk-btn--${opts.variant}`,
    type: 'button',
    onClick: opts.onClick,
  };
  if (opts.disabled) {
    props['disabled'] = true;
    props['aria-disabled'] = true;
  }
  if (opts.busy) props['aria-busy'] = true;
  if (opts.ariaLabel) props['aria-label'] = opts.ariaLabel;
  return h('button', props, ...children);
}

export interface LinkOptions {
  label: string;
  icon?: SVGElement;
  trailingIcon?: SVGElement;
  onClick: () => void;
}

/** Text link styled as `.pk-link` (a real button under the hood for a11y). */
export function link(opts: LinkOptions): HTMLButtonElement {
  return h(
    'button',
    { class: 'pk-link', type: 'button', onClick: opts.onClick },
    opts.icon ?? false,
    opts.label,
    opts.trailingIcon ?? false,
  );
}

/** Header: glyph badge + title + subtitle. */
export function header(opts: { glyph: IconName; title: string; subtitle: string }): HTMLElement {
  return h(
    'div',
    { class: 'pk-head' },
    h('span', { class: 'pk-glyph' }, icon(opts.glyph)),
    h(
      'div',
      { class: 'pk-head__text' },
      h('h2', { class: 'pk-title' }, opts.title),
      h('p', { class: 'pk-subtitle' }, opts.subtitle),
    ),
  );
}

/** Identicon + label + middle-truncated mono address + copy-to-clipboard. */
export function addressChip(opts: {
  address: string;
  label: string;
  showIdenticon?: boolean;
}): HTMLElement {
  const copyBtn = h('button', {
    class: 'pk-copy',
    type: 'button',
    'aria-label': 'Copy full address',
  });
  copyBtn.append(icon('copy', 17));
  let timer: ReturnType<typeof setTimeout> | undefined;
  copyBtn.addEventListener('click', () => {
    try {
      void navigator.clipboard?.writeText(opts.address);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    copyBtn.classList.add('is-copied');
    copyBtn.setAttribute('aria-label', 'Address copied');
    copyBtn.replaceChildren(icon('check', 17));
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.setAttribute('aria-label', 'Copy full address');
      copyBtn.replaceChildren(icon('copy', 17));
    }, 1600);
  });
  return h(
    'div',
    { class: 'pk-address' },
    opts.showIdenticon === false ? false : identicon(opts.address),
    h(
      'span',
      { class: 'pk-address__text', title: opts.address },
      h('span', { class: 'pk-address__label' }, opts.label),
      truncMiddle(opts.address),
    ),
    copyBtn,
  );
}

/** Read-only hash/value row with a "view on explorer" external link. */
export function hashRow(opts: {
  label: string;
  value: string;
  onExplorer: () => void;
}): HTMLElement {
  const link_ = h('a', {
    class: 'pk-copy',
    href: '#',
    'aria-label': 'View on explorer',
    onClick: (e: Event) => {
      e.preventDefault();
      opts.onExplorer();
    },
  });
  link_.append(icon('external', 17));
  return h(
    'div',
    { class: 'pk-address' },
    h(
      'span',
      { class: 'pk-address__text', title: opts.value },
      h('span', { class: 'pk-address__label' }, opts.label),
      truncMiddle(opts.value, 8, 6),
    ),
    link_,
  );
}

/**
 * The calm, opaque "OS sheet is open" panel (prompting / discovering). Dimmed
 * card content sits behind it; a pulsing passkey glyph, NO spinner. Returns a
 * fragment of the overlay + the bottom "OS sheet" hint bar.
 */
export function waitOverlay(opts: { title: string; hint: string }): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(
    h(
      'div',
      { class: 'pk-wait' },
      h('span', { class: 'pk-wait__glyph' }, icon('passkey', 34)),
      h(
        'div',
        { class: 'pk-wait__text' },
        h('div', { class: 'pk-wait__title' }, opts.title),
        h(
          'p',
          {
            class: 'pk-wait__hint',
            role: 'status',
            'aria-live': 'polite',
            tabIndex: -1,
            'data-pk-focus': '',
          },
          opts.hint,
        ),
      ),
    ),
    h('div', { class: 'pk-ossheet', 'aria-hidden': 'true' }),
  );
  return frag;
}

/** The visible, branded "we're working" block (deploying / submitting): spinner + progress. */
export function workBlock(opts: { title: string; hint: string }): HTMLElement {
  return h(
    'div',
    { class: 'pk-work' },
    h(
      'span',
      { class: 'pk-glyph pk-glyph--info' },
      h('span', { class: 'pk-spinner', role: 'presentation', 'aria-hidden': 'true' }),
    ),
    h(
      'div',
      { class: 'pk-work__text' },
      h('div', { class: 'pk-work__title' }, opts.title),
      h(
        'p',
        {
          class: 'pk-work__hint',
          role: 'status',
          'aria-live': 'polite',
          tabIndex: -1,
          'data-pk-focus': '',
        },
        opts.hint,
      ),
    ),
    h('div', { class: 'pk-progress' }, h('div', { class: 'pk-progress__bar' })),
  );
}

export type GlyphTone = 'success' | 'error' | 'info' | 'muted';

/** The single centered result column (success / done / none). */
export function resultLayout(opts: {
  glyphTone: GlyphTone;
  glyphIcon: IconName;
  title: string;
  message: string;
  body?: Child[];
  actions?: Child[];
}): HTMLElement {
  const head = h(
    'div',
    { class: 'pk-result__head' },
    h('span', { class: `pk-glyph pk-glyph--${opts.glyphTone}` }, icon(opts.glyphIcon)),
    h(
      'div',
      { class: 'pk-result__copy' },
      h('h2', { class: 'pk-title' }, opts.title),
      h(
        'p',
        {
          class: 'pk-message',
          role: 'status',
          'aria-live': 'polite',
          tabIndex: -1,
          'data-pk-focus': '',
        },
        opts.message,
      ),
    ),
  );
  return h(
    'div',
    { class: 'pk-result' },
    head,
    ...(opts.body ?? []),
    opts.actions ? h('div', { class: 'pk-actions' }, ...opts.actions) : false,
  );
}

/**
 * The ONE error layout — copy swaps by `(screen, KitErrorCode)` via the
 * connector. Message is an assertive live region (`role="alert"`) that receives
 * focus. Always shows message + a "Try again" / "Retry" action.
 */
export function errorView(opts: {
  screen: Screen;
  code: KitErrorCode;
  onRetry: () => void;
}): HTMLElement {
  const copy = errorCopyFor(opts.screen, opts.code);
  const designKey = errorKeyFor(opts.screen, opts.code);
  const suffix = designKey.split(':')[1] ?? designKey;
  const head = h(
    'div',
    { class: 'pk-result__head' },
    h('span', { class: 'pk-glyph pk-glyph--error' }, icon('alert')),
    h(
      'div',
      { class: 'pk-result__copy' },
      h('h2', { class: 'pk-title' }, copy.title),
      h(
        'p',
        {
          class: 'pk-message',
          role: 'alert',
          'aria-live': 'assertive',
          tabIndex: -1,
          'data-pk-focus': '',
        },
        copy.message,
      ),
      h('span', { class: 'pk-errcode' }, `error code: ${suffix}`),
    ),
  );
  return h(
    'div',
    { class: 'pk-result', 'data-error-key': designKey, 'data-kit-code': opts.code },
    head,
    h(
      'div',
      { class: 'pk-actions' },
      button({
        variant: 'primary',
        icon: icon('refresh', 18),
        label: copy.action,
        onClick: opts.onRetry,
      }),
    ),
  );
}

export interface TxSummaryData {
  /** Large amount line, e.g. "250.00 USDC". App-supplied. */
  amountValue: string;
  amountFiat?: string;
  destination: string;
  /** Function / action name, shown as a tag. */
  action: string;
}

/** Host-supplied transaction summary: amount (large) + To / Action rows. */
export function txSummary(tx: TxSummaryData): HTMLElement {
  const amount = h(
    'div',
    { class: 'pk-summary__amount' },
    h('span', { class: 'pk-summary__amount-value' }, tx.amountValue),
    tx.amountFiat ? h('span', { class: 'pk-summary__amount-fiat' }, tx.amountFiat) : false,
  );
  const rows = h(
    'div',
    { class: 'pk-summary__rows' },
    h(
      'div',
      { class: 'pk-row' },
      h('span', { class: 'pk-row__key' }, 'To'),
      h(
        'span',
        { class: 'pk-row__val pk-row__val--mono', title: tx.destination },
        truncMiddle(tx.destination, 6, 6),
      ),
    ),
    h(
      'div',
      { class: 'pk-row' },
      h('span', { class: 'pk-row__key' }, 'Action'),
      h('span', { class: 'pk-tag' }, tx.action),
    ),
  );
  return h('div', { class: 'pk-summary' }, amount, rows);
}

/** The card shell. `data-pk-*` attributes are stable test/automation hooks. */
export function card(
  opts: { screen: Screen; state: string; waiting?: boolean; dir?: string },
  ...children: Child[]
): HTMLElement {
  const props: Record<string, unknown> = {
    class: `pk-card${opts.waiting ? ' is-waiting' : ''}`,
    'data-pk-screen': opts.screen,
    'data-pk-state': opts.state,
  };
  if (opts.dir) props['dir'] = opts.dir;
  return h('div', props, ...children);
}

/** Wrap idle content that should dim behind the wait overlay. */
export function dim(...children: Child[]): HTMLElement {
  return h('div', { class: 'pk-card__dim' }, ...children);
}
