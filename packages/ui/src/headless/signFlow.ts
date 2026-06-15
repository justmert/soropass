import { assertUserActivation } from '@soropass/core/create';
import { isKitError, type KitErrorCode, type SubmitResult } from '@soropass/core/types';
import { createStore, type ReadableStore } from './store';
import { defaultTranslate, errorKey, type Translate } from './messages';
import type { StatusProps, TriggerProps } from './a11y';

export type SignFlowState =
  | { status: 'idle' }
  | { status: 'prompting' }
  | { status: 'submitting' }
  | { status: 'done'; result: SubmitResult }
  | { status: 'error'; code: KitErrorCode; message: string };

export interface SignFlowConfig {
  /** Sign the operation with the passkey, returning a signed tx XDR. */
  sign: () => Promise<string>;
  /** Submit the signed XDR via a SubmissionAdapter. */
  submit: (signedTxXdr: string) => Promise<SubmitResult>;
  translate?: Translate;
  userActivation?: { isActive: boolean };
}

export interface SignFlow extends ReadableStore<SignFlowState> {
  start(): Promise<void>;
  reset(): void;
  statusKey(): string;
  getStatusProps(): StatusProps;
  getTriggerProps(): TriggerProps;
}

export function createSignFlow(config: SignFlowConfig): SignFlow {
  const t = config.translate ?? defaultTranslate;
  const store = createStore<SignFlowState>({ status: 'idle' });
  const isBusy = (): boolean => {
    const s = store.getState().status;
    return s === 'prompting' || s === 'submitting';
  };
  const statusKey = (): string => {
    const s = store.getState();
    return s.status === 'error' ? errorKey(s.code) : `passkey.sign.${s.status}`;
  };
  const fail = (error: unknown, fallback: KitErrorCode): void => {
    const code: KitErrorCode = isKitError(error) ? error.code : fallback;
    store.set({ status: 'error', code, message: t(errorKey(code)) });
  };

  async function start(): Promise<void> {
    if (isBusy()) return;
    try {
      assertUserActivation(config.userActivation);
    } catch (error) {
      fail(error, 'USER_CANCELLED');
      return;
    }
    store.set({ status: 'prompting' });
    let signedTxXdr: string;
    try {
      signedTxXdr = await config.sign();
    } catch (error) {
      fail(error, 'UNSUPPORTED_AUTHENTICATOR');
      return;
    }
    store.set({ status: 'submitting' });
    try {
      const result = await config.submit(signedTxXdr);
      if (result.status === 'FAILED') {
        store.set({
          status: 'error',
          code: 'CONTRACT_AUTH_FAILED',
          message: t(errorKey('CONTRACT_AUTH_FAILED')),
        });
        return;
      }
      store.set({ status: 'done', result });
    } catch (error) {
      fail(error, 'NETWORK_ERROR');
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
      'aria-label': t('passkey.sign.trigger'),
      onClick: () => void start(),
    }),
  };
}
