import { assertUserActivation } from '@stellar-passkey/core/create';
import { isKitError, type KitErrorCode } from '@stellar-passkey/core/types';
import type { RecoverResult } from '@stellar-passkey/core/recover';
import { createStore, type ReadableStore } from './store';
import { defaultTranslate, errorKey, type Translate } from './messages';
import type { ListProps, OptionProps, StatusProps, TriggerProps } from './a11y';

export type RecoverFlowState =
  | { status: 'idle' }
  | { status: 'discovering' }
  | { status: 'resolved'; accounts: RecoverResult[] }
  | { status: 'selected'; account: RecoverResult }
  | { status: 'none' }
  | { status: 'error'; code: KitErrorCode; message: string };

export interface RecoverFlowConfig {
  /** Discoverable get() + indexer resolution → the accounts a passkey controls. */
  recover: () => Promise<RecoverResult[]>;
  translate?: Translate;
  userActivation?: { isActive: boolean };
}

export interface RecoverFlow extends ReadableStore<RecoverFlowState> {
  start(): Promise<void>;
  select(account: RecoverResult): void;
  reset(): void;
  statusKey(): string;
  getStatusProps(): StatusProps;
  getTriggerProps(): TriggerProps;
  getListProps(): ListProps;
  getOptionProps(account: RecoverResult, index: number): OptionProps;
}

export function createRecoverFlow(config: RecoverFlowConfig): RecoverFlow {
  const t = config.translate ?? defaultTranslate;
  const store = createStore<RecoverFlowState>({ status: 'idle' });
  const isBusy = (): boolean => store.getState().status === 'discovering';
  const statusKey = (): string => {
    const s = store.getState();
    return s.status === 'error' ? errorKey(s.code) : `passkey.recover.${s.status}`;
  };

  async function start(): Promise<void> {
    if (isBusy()) return;
    try {
      assertUserActivation(config.userActivation);
    } catch (error) {
      const code: KitErrorCode = isKitError(error) ? error.code : 'USER_CANCELLED';
      store.set({ status: 'error', code, message: t(errorKey(code)) });
      return;
    }
    store.set({ status: 'discovering' });
    try {
      const accounts = await config.recover();
      store.set(accounts.length > 0 ? { status: 'resolved', accounts } : { status: 'none' });
    } catch (error) {
      const code: KitErrorCode = isKitError(error) ? error.code : 'UNSUPPORTED_AUTHENTICATOR';
      store.set({ status: 'error', code, message: t(errorKey(code)) });
    }
  }

  function select(account: RecoverResult): void {
    if (store.getState().status === 'resolved') store.set({ status: 'selected', account });
  }

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    start,
    select,
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
      'aria-label': t('passkey.recover.trigger'),
      onClick: () => void start(),
    }),
    getListProps: () => ({ role: 'listbox', 'aria-label': t('passkey.recover.resolved') }),
    getOptionProps: (account, index) => {
      const state = store.getState();
      const selected =
        state.status === 'selected' && state.account.contractId === account.contractId;
      return {
        role: 'option',
        'aria-selected': selected,
        id: `passkey-recover-option-${String(index)}`,
        tabIndex: index === 0 ? 0 : -1,
        onClick: () => select(account),
      };
    },
  };
}
