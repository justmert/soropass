/**
 * Add device / backup passkey (5 states). Enrolls a NEW passkey as an additional
 * signer on an EXISTING account — the "add backup key" flow that completes the
 * lost-device story. Bound to the headless `AddDeviceFlow`; the idle state
 * surfaces the security trade-off (an add-signer path is account-takeover if
 * misused) rather than hiding it.
 */
import type { AddDeviceFlow, AddDeviceFlowState } from '../headless';
import { h, icon, type Child } from './dom';
import {
  addressChip,
  button,
  card,
  dim,
  errorView,
  header,
  resultLayout,
  waitOverlay,
  workBlock,
} from './components';
import { mountScreen, type ScreenHandle } from './mount';

export interface AddDeviceCopy {
  idleTitle: string;
  idleSubtitle: string;
  warning: string;
  cancelLabel: string;
  addLabel: string;
  promptingTitle: string;
  promptingHint: string;
  bindingTitle: string;
  bindingHint: string;
  successTitle: string;
  successMessage: string;
  signerLabel: string;
  doneLabel: string;
}

export const DEFAULT_ADDDEVICE_COPY: AddDeviceCopy = {
  idleTitle: 'Add a backup passkey',
  idleSubtitle:
    'Register this device as an additional signer so you can still get in if you lose your other passkey.',
  warning:
    'A backup passkey can approve transactions on this account. Only add a device you control and trust.',
  cancelLabel: 'Cancel',
  addLabel: 'Add passkey',
  promptingTitle: 'Waiting for your passkey',
  promptingHint: 'Confirm with the device you’re adding as a backup signer.',
  bindingTitle: 'Adding your backup signer…',
  bindingHint: 'Registering this passkey on your account on-chain. This takes a few seconds.',
  successTitle: 'Backup passkey added',
  successMessage: 'This device can now recover and sign for your account.',
  signerLabel: 'New signer',
  doneLabel: 'Done',
};

export interface AddDeviceCtx {
  copy: AddDeviceCopy;
  onAdd: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDone: () => void;
}

/** Pure view: render the card for an explicit Add-device state. */
export function addDeviceView(state: AddDeviceFlowState, ctx: AddDeviceCtx): HTMLElement {
  const idle = (): Child[] => [
    header({ glyph: 'plus', title: ctx.copy.idleTitle, subtitle: ctx.copy.idleSubtitle }),
    h(
      'div',
      { class: 'pk-banner pk-banner--warn' },
      icon('shield', 18),
      h('span', { class: 'pk-banner__body' }, ctx.copy.warning),
    ),
    h(
      'div',
      { class: 'pk-actions pk-actions--row' },
      button({ variant: 'secondary', label: ctx.copy.cancelLabel, onClick: ctx.onCancel }),
      button({
        variant: 'primary',
        icon: icon('passkey', 18),
        label: ctx.copy.addLabel,
        onClick: ctx.onAdd,
      }),
    ),
  ];

  switch (state.status) {
    case 'idle':
      return card({ screen: 'addDevice', state: 'idle' }, ...idle());
    case 'prompting':
      return card(
        { screen: 'addDevice', state: 'prompting', waiting: true },
        dim(...idle()),
        waitOverlay({ title: ctx.copy.promptingTitle, hint: ctx.copy.promptingHint }),
      );
    case 'binding':
      return card(
        { screen: 'addDevice', state: 'binding' },
        workBlock({ title: ctx.copy.bindingTitle, hint: ctx.copy.bindingHint }),
      );
    case 'success':
      return card(
        { screen: 'addDevice', state: 'success' },
        resultLayout({
          glyphTone: 'success',
          glyphIcon: 'checkCircle',
          title: ctx.copy.successTitle,
          message: ctx.copy.successMessage,
          body: [addressChip({ address: state.result.signer, label: ctx.copy.signerLabel })],
          actions: [button({ variant: 'primary', label: ctx.copy.doneLabel, onClick: ctx.onDone })],
        }),
      );
    case 'error':
      return card(
        { screen: 'addDevice', state: 'error' },
        errorView({ screen: 'addDevice', code: state.code, onRetry: ctx.onRetry }),
      );
  }
}

export interface AddDeviceScreenOptions {
  flow: AddDeviceFlow;
  copy?: Partial<AddDeviceCopy>;
  onCancel?: () => void;
  onDone?: () => void;
}

/** Mount the styled Add-device screen, bound to a headless `AddDeviceFlow`. */
export function mountAddDeviceScreen(root: HTMLElement, opts: AddDeviceScreenOptions): ScreenHandle {
  const copy: AddDeviceCopy = { ...DEFAULT_ADDDEVICE_COPY, ...opts.copy };
  const ctx: AddDeviceCtx = {
    copy,
    // The trigger / retry click is itself the user gesture WebAuthn requires.
    onAdd: () => void opts.flow.start(),
    onRetry: () => void opts.flow.start(),
    onCancel: () => opts.onCancel?.(),
    onDone: () => opts.onDone?.(),
  };
  return mountScreen(root, opts.flow, (state) => addDeviceView(state, ctx));
}
