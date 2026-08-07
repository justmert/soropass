/**
 * `@soropass/ui-react` — thin React wrappers around the vanilla-DOM SoroPass
 * styled screens. Each component renders ONE state of a flow (the presentational
 * `*View` functions), so a design agent can compose passkey wallet screens with
 * real, on-brand SoroPass parts. Style via tokens (`@soropass/ui/styled.css`);
 * the components never change.
 */
import { useEffect, useRef } from 'react';
import {
  createView,
  signView,
  recoverView,
  connectView,
  addDeviceView,
  DEFAULT_CREATE_COPY,
  DEFAULT_SIGN_COPY,
  DEFAULT_RECOVER_COPY,
  DEFAULT_CONNECT_COPY,
  DEFAULT_ADDDEVICE_COPY,
  type TxSummaryData,
} from '@soropass/ui/styled';
import type {
  CreateFlowState,
  SignFlowState,
  RecoverFlowState,
  AddDeviceFlowState,
} from '@soropass/ui/headless';
import type { RecoverResult } from '@soropass/core/recover';

const noop = (): void => {};

/** Render a vanilla-DOM SoroPass view into a React-managed node. */
function Screen({ render, className }: { render: () => HTMLElement; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (root) root.replaceChildren(render());
  });
  return <div ref={ref} className={className ? `pk ${className}` : 'pk'} />;
}

const SAMPLE_TX: TxSummaryData = {
  amountValue: '250.00 USDC',
  amountFiat: '≈ $250.00',
  destination: 'GDUKMGUGDZQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6X',
  action: 'transfer',
};
const SAMPLE_ACCOUNTS: RecoverResult[] = [
  { contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP', credentialId: 'k' },
  { contractId: 'CDEF8GH1J2K3L4M5N6P7Q8R9S0T1U2V3W4X5Y6Z7B8DEF8GH1J2K3L4', credentialId: 'k' },
];

/** Props for {@link CreatePasskeyScreen}. */
export interface CreatePasskeyScreenProps {
  /** Which flow state to render. Defaults to `{ status: 'idle' }`. */
  state?: CreateFlowState;
  className?: string;
}

/**
 * Create-passkey wallet screen. Renders one state of the create flow:
 * `idle` → `prompting` → `deploying` → `success` | `error`.
 * @category Passkey
 */
export function CreatePasskeyScreen({
  state = { status: 'idle' },
  className,
}: CreatePasskeyScreenProps) {
  return (
    <Screen
      className={className}
      render={() =>
        createView(state, {
          copy: DEFAULT_CREATE_COPY,
          onCreate: noop,
          onRetry: noop,
          onContinue: noop,
          onHelp: noop,
        })
      }
    />
  );
}

/** Props for {@link SignTransactionScreen}. */
export interface SignTransactionScreenProps {
  /** Which flow state to render. Defaults to `{ status: 'idle' }`. */
  state?: SignFlowState;
  /** The transaction summary shown in the card. */
  tx?: TxSummaryData;
  className?: string;
}

/**
 * Sign-transaction screen. Shows a transaction summary and one state of the
 * sign flow: `idle` → `prompting` → `submitting` → `done` | `error`.
 * @category Passkey
 */
export function SignTransactionScreen({
  state = { status: 'idle' },
  tx = SAMPLE_TX,
  className,
}: SignTransactionScreenProps) {
  return (
    <Screen
      className={className}
      render={() =>
        signView(state, {
          copy: DEFAULT_SIGN_COPY,
          tx,
          onSign: noop,
          onCancel: noop,
          onRetry: noop,
          onDone: noop,
          onExplorer: noop,
        })
      }
    />
  );
}

/** Props for {@link RecoverAccountScreen}. */
export interface RecoverAccountScreenProps {
  /** Which flow state to render. Defaults to `{ status: 'idle' }`. */
  state?: RecoverFlowState;
  /** Accounts shown in the `resolved` state. */
  accounts?: RecoverResult[];
  className?: string;
}

/**
 * Recover-account screen. Resolves the wallets a passkey controls:
 * `idle` → `discovering` → `resolved` (account list) | `none` | `error`.
 * @category Passkey
 */
export function RecoverAccountScreen({
  state = { status: 'idle' },
  accounts = SAMPLE_ACCOUNTS,
  className,
}: RecoverAccountScreenProps) {
  const list = state.status === 'resolved' ? state.accounts : accounts;
  return (
    <Screen
      className={className}
      render={() =>
        recoverView(state, list, {
          copy: DEFAULT_RECOVER_COPY,
          meta: (_a, i) => `Account ${String(i + 1)}`,
          onRecover: noop,
          onRetry: noop,
          onSelect: noop,
          onContinue: noop,
          onCreateNew: noop,
          onTryDifferent: noop,
        })
      }
    />
  );
}

/** Props for {@link ConnectScreen}. */
export interface ConnectScreenProps {
  className?: string;
}

/**
 * Connect chooser — the entry surface that forks "create a new passkey wallet"
 * vs "use an existing passkey". Stateless.
 * @category Passkey
 */
export function ConnectScreen({ className }: ConnectScreenProps = {}) {
  return (
    <Screen
      className={className}
      render={() =>
        connectView({
          copy: DEFAULT_CONNECT_COPY,
          onCreate: noop,
          onUseExisting: noop,
          onHelp: noop,
        })
      }
    />
  );
}

/** Props for {@link AddDeviceScreen}. */
export interface AddDeviceScreenProps {
  /** Which flow state to render. Defaults to `{ status: 'idle' }`. */
  state?: AddDeviceFlowState;
  className?: string;
}

/**
 * Add-device (backup passkey) screen — enroll a second passkey signer:
 * `idle` → `prompting` → `binding` → `success` | `error`.
 * @category Passkey
 */
export function AddDeviceScreen({ state = { status: 'idle' }, className }: AddDeviceScreenProps) {
  return (
    <Screen
      className={className}
      render={() =>
        addDeviceView(state, {
          copy: DEFAULT_ADDDEVICE_COPY,
          onAdd: noop,
          onCancel: noop,
          onRetry: noop,
          onDone: noop,
        })
      }
    />
  );
}
