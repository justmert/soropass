/**
 * Screen 1 — Create passkey (5 states). Bound to the S18 `CreateFlow`; no flow
 * logic is duplicated here. All copy is overridable for i18n.
 */
import type { CreateFlow, CreateFlowState } from '../headless';
import type { PasskeyCredential } from '@soropass/core/types';
import { h, icon, type Child } from './dom';
import {
  addressChip,
  button,
  card,
  dim,
  errorView,
  header,
  link,
  resultLayout,
  waitOverlay,
  workBlock,
} from './components';
import { mountScreen, type ScreenHandle } from './mount';

export interface CreateCopy {
  idleTitle: string;
  idleSubtitle: string;
  createLabel: string;
  helpLabel: string;
  promptingTitle: string;
  promptingHint: string;
  deployingTitle: string;
  deployingHint: string;
  successTitle: string;
  successMessage: string;
  addressLabel: string;
  continueLabel: string;
}

export const DEFAULT_CREATE_COPY: CreateCopy = {
  idleTitle: 'Create your wallet',
  idleSubtitle:
    'A passkey — your Face ID, fingerprint, or security key — replaces your seed phrase. Nothing to write down.',
  createLabel: 'Create passkey',
  helpLabel: 'What’s a passkey?',
  promptingTitle: 'Waiting for your passkey',
  promptingHint: 'Use Face ID, your fingerprint, or your security key to continue.',
  deployingTitle: 'Setting up your account…',
  deployingHint: 'We’re deploying your smart account on-chain. This usually takes a few seconds.',
  successTitle: 'Wallet ready',
  successMessage: 'Your account is set up and ready to use.',
  addressLabel: 'Your account',
  continueLabel: 'Continue',
};

export interface CreateCtx {
  copy: CreateCopy;
  onCreate: () => void;
  onRetry: () => void;
  onContinue: (credential: PasskeyCredential) => void;
  onHelp: () => void;
}

/** Pure view: render the card for an explicit Create state. */
export function createView(state: CreateFlowState, ctx: CreateCtx): HTMLElement {
  const idle = (): Child[] => [
    header({ glyph: 'passkey', title: ctx.copy.idleTitle, subtitle: ctx.copy.idleSubtitle }),
    h(
      'div',
      { class: 'pk-actions' },
      button({
        variant: 'primary',
        icon: icon('passkey', 18),
        label: ctx.copy.createLabel,
        onClick: ctx.onCreate,
      }),
      link({ icon: icon('help', 14), label: ctx.copy.helpLabel, onClick: ctx.onHelp }),
    ),
  ];

  switch (state.status) {
    case 'idle':
      return card({ screen: 'create', state: 'idle' }, ...idle());
    case 'prompting':
      return card(
        { screen: 'create', state: 'prompting', waiting: true },
        dim(...idle()),
        waitOverlay({ title: ctx.copy.promptingTitle, hint: ctx.copy.promptingHint }),
      );
    case 'deploying':
      return card(
        { screen: 'create', state: 'deploying' },
        workBlock({ title: ctx.copy.deployingTitle, hint: ctx.copy.deployingHint }),
      );
    case 'success': {
      const credential = state.credential;
      return card(
        { screen: 'create', state: 'success' },
        resultLayout({
          glyphTone: 'success',
          glyphIcon: 'checkCircle',
          title: ctx.copy.successTitle,
          message: ctx.copy.successMessage,
          body: [addressChip({ address: credential.contractId, label: ctx.copy.addressLabel })],
          actions: [
            button({
              variant: 'primary',
              label: ctx.copy.continueLabel,
              onClick: () => ctx.onContinue(credential),
            }),
          ],
        }),
      );
    }
    case 'error':
      return card(
        { screen: 'create', state: 'error' },
        errorView({ screen: 'create', code: state.code, onRetry: ctx.onRetry }),
      );
  }
}

export interface CreateScreenOptions {
  flow: CreateFlow;
  copy?: Partial<CreateCopy>;
  /** Args forwarded to `flow.start()` (e.g. a `userName`). */
  input?: { userName?: string };
  onContinue?: (credential: PasskeyCredential) => void;
  onHelp?: () => void;
}

/** Mount the styled Create screen, bound to a headless `CreateFlow`. */
export function mountCreateScreen(root: HTMLElement, opts: CreateScreenOptions): ScreenHandle {
  const copy: CreateCopy = { ...DEFAULT_CREATE_COPY, ...opts.copy };
  const input = opts.input ?? {};
  const ctx: CreateCtx = {
    copy,
    // The trigger / retry click is itself the user gesture WebAuthn requires.
    onCreate: () => void opts.flow.start(input),
    onRetry: () => void opts.flow.start(input),
    onContinue: (credential) => opts.onContinue?.(credential),
    onHelp: () => opts.onHelp?.(),
  };
  return mountScreen(root, opts.flow, (state) => createView(state, ctx));
}
