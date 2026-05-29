import { assertUserActivation } from '@stellar-passkey/core/create';
import { isKitError, type KitErrorCode, type PasskeyCredential } from '@stellar-passkey/core/types';
import { createStore, type ReadableStore } from './store';
import { defaultTranslate, errorKey, type Translate } from './messages';
import type { StatusProps, TriggerProps } from './a11y';

export type CreateFlowState =
  | { status: 'idle' }
  | { status: 'prompting' }
  | { status: 'deploying' }
  | { status: 'success'; credential: PasskeyCredential }
  | { status: 'error'; code: KitErrorCode; message: string };

export interface CreateFlowConfig {
  /** Runs the create ceremony; call `report.deploying()` when the deploy phase begins. */
  create: (
    input: { userName?: string },
    report: { deploying: () => void },
  ) => Promise<PasskeyCredential>;
  translate?: Translate;
  /** Pass `navigator.userActivation` to enforce the Safari gesture rule (S04). */
  userActivation?: { isActive: boolean };
}

export interface CreateFlow extends ReadableStore<CreateFlowState> {
  /** MUST be invoked from a user gesture (click/tap). */
  start(input?: { userName?: string }): Promise<void>;
  reset(): void;
  statusKey(): string;
  getStatusProps(): StatusProps;
  getTriggerProps(): TriggerProps;
}

export function createCreatePasskeyFlow(config: CreateFlowConfig): CreateFlow {
  const t = config.translate ?? defaultTranslate;
  const store = createStore<CreateFlowState>({ status: 'idle' });
  const isBusy = (): boolean => {
    const s = store.getState().status;
    return s === 'prompting' || s === 'deploying';
  };
  const statusKey = (): string => {
    const s = store.getState();
    return s.status === 'error' ? errorKey(s.code) : `passkey.create.${s.status}`;
  };
  const fail = (error: unknown, fallback: KitErrorCode): void => {
    const code: KitErrorCode = isKitError(error) ? error.code : fallback;
    store.set({ status: 'error', code, message: t(errorKey(code)) });
  };

  async function start(input: { userName?: string } = {}): Promise<void> {
    if (isBusy()) return;
    try {
      assertUserActivation(config.userActivation); // anchor: apple-user-gesture (S04)
    } catch (error) {
      fail(error, 'USER_CANCELLED');
      return;
    }
    store.set({ status: 'prompting' });
    try {
      const credential = await config.create(input, {
        deploying: () => store.set({ status: 'deploying' }),
      });
      store.set({ status: 'success', credential });
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
      'aria-label': t('passkey.create.trigger'),
      onClick: () => void start(),
    }),
  };
}
