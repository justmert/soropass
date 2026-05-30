/**
 * Screen 2 — Sign transaction (5 states). Bound to the S18 `SignFlow`. The
 * transaction summary is **host-supplied** (`tx`) — the component never assumes
 * the details originate inside it.
 */
import type { SignFlow, SignFlowState } from '../headless';
import type { SubmitResult } from '@stellar-passkey/core/types';
import { h, icon } from './dom';
import {
  button,
  card,
  dim,
  errorView,
  hashRow,
  header,
  link,
  resultLayout,
  txSummary,
  waitOverlay,
  workBlock,
  type TxSummaryData,
} from './components';
import { mountScreen, type ScreenHandle } from './mount';

export interface SignCopy {
  idleTitle: string;
  idleSubtitle: string;
  cancelLabel: string;
  signLabel: string;
  promptingTitle: string;
  promptingHint: string;
  submittingTitle: string;
  submittingHint: string;
  doneTitle: string;
  doneMessage: string;
  hashLabel: string;
  doneLabel: string;
  explorerLabel: string;
}

export const DEFAULT_SIGN_COPY: SignCopy = {
  idleTitle: 'Approve transaction',
  idleSubtitle: 'Review the details, then sign with your passkey.',
  cancelLabel: 'Cancel',
  signLabel: 'Sign',
  promptingTitle: 'Waiting for your passkey',
  promptingHint: 'Use Face ID, your fingerprint, or your security key to sign this transaction.',
  submittingTitle: 'Submitting transaction…',
  submittingHint: 'Your signature is captured. We’re sending the transaction to the network.',
  doneTitle: 'Transaction sent',
  doneMessage: 'Your transaction was submitted and confirmed on the network.',
  hashLabel: 'Transaction hash',
  doneLabel: 'Done',
  explorerLabel: 'View on explorer',
};

export interface SignCtx {
  copy: SignCopy;
  tx: TxSummaryData;
  onSign: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDone: (result: SubmitResult) => void;
  onExplorer: (hash: string) => void;
}

/** Pure view: render the card for an explicit Sign state. */
export function signView(state: SignFlowState, ctx: SignCtx): HTMLElement {
  const head = (): HTMLElement =>
    header({ glyph: 'shield', title: ctx.copy.idleTitle, subtitle: ctx.copy.idleSubtitle });

  switch (state.status) {
    case 'idle':
      return card(
        { screen: 'sign', state: 'idle' },
        head(),
        txSummary(ctx.tx),
        h(
          'div',
          { class: 'pk-actions pk-actions--row' },
          button({ variant: 'secondary', label: ctx.copy.cancelLabel, onClick: ctx.onCancel }),
          button({
            variant: 'primary',
            icon: icon('passkey', 18),
            label: ctx.copy.signLabel,
            onClick: ctx.onSign,
          }),
        ),
      );
    case 'prompting':
      return card(
        { screen: 'sign', state: 'prompting', waiting: true },
        dim(head(), txSummary(ctx.tx)),
        waitOverlay({ title: ctx.copy.promptingTitle, hint: ctx.copy.promptingHint }),
      );
    case 'submitting':
      return card(
        { screen: 'sign', state: 'submitting' },
        // Dim level is token-overridable (default 0.4 keeps the summary legible
        // while submitting — distinct from the heavier waiting-state dim).
        h(
          'div',
          { class: 'pk-card__dim', style: 'opacity: var(--pk-work-dim-opacity, 0.4)' },
          txSummary(ctx.tx),
        ),
        workBlock({ title: ctx.copy.submittingTitle, hint: ctx.copy.submittingHint }),
      );
    case 'done': {
      const result = state.result;
      return card(
        { screen: 'sign', state: 'done' },
        resultLayout({
          glyphTone: 'success',
          glyphIcon: 'checkCircle',
          title: ctx.copy.doneTitle,
          message: ctx.copy.doneMessage,
          body: [
            hashRow({
              label: ctx.copy.hashLabel,
              value: result.hash,
              onExplorer: () => ctx.onExplorer(result.hash),
            }),
          ],
          actions: [
            button({
              variant: 'primary',
              label: ctx.copy.doneLabel,
              onClick: () => ctx.onDone(result),
            }),
            link({
              label: ctx.copy.explorerLabel,
              trailingIcon: icon('external', 14),
              onClick: () => ctx.onExplorer(result.hash),
            }),
          ],
        }),
      );
    }
    case 'error':
      return card(
        { screen: 'sign', state: 'error' },
        errorView({ screen: 'sign', code: state.code, onRetry: ctx.onRetry }),
      );
  }
}

export interface SignScreenOptions {
  flow: SignFlow;
  /** Host-supplied transaction summary (amount / destination / action). */
  tx: TxSummaryData;
  copy?: Partial<SignCopy>;
  onCancel?: () => void;
  onDone?: (result: SubmitResult) => void;
  onExplorer?: (hash: string) => void;
}

/** Mount the styled Sign screen, bound to a headless `SignFlow`. */
export function mountSignScreen(root: HTMLElement, opts: SignScreenOptions): ScreenHandle {
  const copy: SignCopy = { ...DEFAULT_SIGN_COPY, ...opts.copy };
  const ctx: SignCtx = {
    copy,
    tx: opts.tx,
    onSign: () => void opts.flow.start(),
    onRetry: () => void opts.flow.start(),
    onCancel: () => {
      opts.flow.reset();
      opts.onCancel?.();
    },
    onDone: (result) => opts.onDone?.(result),
    onExplorer: (hash) => opts.onExplorer?.(hash),
  };
  return mountScreen(root, opts.flow, (state) => signView(state, ctx));
}
