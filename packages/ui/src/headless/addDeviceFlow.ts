import { assertUserActivation } from '@soropass/core/create';
import { isKitError, type KitErrorCode } from '@soropass/core/types';
import { createStore, type ReadableStore } from './store';
import { defaultTranslate, errorKey, type Translate } from './messages';
import type { StatusProps, TriggerProps } from './a11y';

/** The signer enrolled on success — shown in the result. */
export interface AddedSigner {
  /** The new signer's public key / credential id (host-formatted for display). */
  signer: string;
}

export type AddDeviceFlowState =
  | { status: 'idle' }
  | { status: 'prompting' }
  | { status: 'binding' }
  | { status: 'success'; result: AddedSigner }
  | { status: 'error'; code: KitErrorCode; message: string };

export interface AddDeviceFlowConfig {
  /**
   * Runs the add-signer ceremony: create the backup passkey, then bind it on the
   * existing account on-chain. Call `report.binding()` when the on-chain
   * add-signer phase begins (so the card advances from `prompting` to `binding`).
   */
  addDevice: (report: { binding: () => void }) => Promise<AddedSigner>;
  translate?: Translate;
  /** Pass `navigator.userActivation` to enforce the Safari gesture rule (S04). */
  userActivation?: { isActive: boolean };
}

export interface AddDeviceFlow extends ReadableStore<AddDeviceFlowState> {
  /** MUST be invoked from a user gesture (click/tap). */
  start(): Promise<void>;
  reset(): void;
  statusKey(): string;
  getStatusProps(): StatusProps;
  getTriggerProps(): TriggerProps;
}

export function createAddDeviceFlow(config: AddDeviceFlowConfig): AddDeviceFlow {
  const t = config.translate ?? defaultTranslate;
  const store = createStore<AddDeviceFlowState>({ status: 'idle' });
  const isBusy = (): boolean => {
    const s = store.getState().status;
    return s === 'prompting' || s === 'binding';
  };
  const statusKey = (): string => {
    const s = store.getState();
    return s.status === 'error' ? errorKey(s.code) : `passkey.addDevice.${s.status}`;
  };
  const fail = (error: unknown, fallback: KitErrorCode): void => {
    const code: KitErrorCode = isKitError(error) ? error.code : fallback;
    store.set({ status: 'error', code, message: t(errorKey(code)) });
  };

  async function start(): Promise<void> {
    if (isBusy()) return;
    try {
      assertUserActivation(config.userActivation); // anchor: apple-user-gesture (S04)
    } catch (error) {
      fail(error, 'USER_CANCELLED');
      return;
    }
    store.set({ status: 'prompting' });
    try {
      const result = await config.addDevice({
        binding: () => store.set({ status: 'binding' }),
      });
      store.set({ status: 'success', result });
    } catch (error) {
      fail(error, 'UNSUPPORTED_AUTHENTICATOR');
    }
  }

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    start,
    reset: () => store.set({ status: 'idle' }),
    statusKey,
    getStatusProps: () => ({
      role: 'status',
      'aria-live': store.getState().status === 'error' ? 'assertive' : 'polite',
      'aria-atomic': true,
      tabIndex: -1,
      children: t(statusKey()),
    }),
    getTriggerProps: () => ({
      type: 'button',
      disabled: isBusy(),
      'aria-busy': isBusy(),
      'aria-label': t('passkey.addDevice.trigger'),
      onClick: () => void start(),
    }),
  };
}
