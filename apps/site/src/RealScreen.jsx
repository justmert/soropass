/* ============================================================================
   RealScreen — mounts the REAL @soropass/ui vanilla-DOM components into the
   React docs. This is the whole point of the bespoke site: the previews are the
   actual shipping create/sign/recover screens, driven by a `state` prop, not
   screenshots or iframes. Mock data only — zero network. (Adapted from
   apps/demo/src/embed.ts.)
   ========================================================================== */
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
} from '@soropass/ui/styled';

// ── sample data (mock; zero network) ────────────────────────────────────────
const SAMPLE_CRED = {
  contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP',
  credentialId: 'demo-credential',
  publicKey: new Uint8Array(65),
};
const SAMPLE_HASH = 'a1b9f4c7e2d8053614af9b2c7e0d4f6182a3c5d7e9b0f1234567890abcdef1234';
const SAMPLE_ACCOUNTS = [
  { contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP', credentialId: 'k' },
  { contractId: 'CDEF8GH1J2K3L4M5N6P7Q8R9S0T1U2V3W4X5Y6Z7B8DEF8GH1J2K3L4', credentialId: 'k' },
  { contractId: 'CBQ9Z8Y7X6W5V4U3T2S1R0P9N8M7L6K5J4H3G2F1D0BQ9Z8Y7X6W5V4', credentialId: 'k' },
];
const noop = () => {};

const createCtx = {
  copy: DEFAULT_CREATE_COPY,
  onCreate: noop,
  onRetry: noop,
  onContinue: noop,
  onHelp: noop,
};
const signCtx = {
  copy: DEFAULT_SIGN_COPY,
  tx: {
    amountValue: '250.00 USDC',
    amountFiat: '≈ $250.00',
    destination: 'GDUKMGUGDZQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6X',
    action: 'transfer',
  },
  onSign: noop,
  onCancel: noop,
  onRetry: noop,
  onDone: noop,
  onExplorer: noop,
};
const recoverCtx = {
  copy: DEFAULT_RECOVER_COPY,
  meta: (_account, index) => `Account ${index + 1}`,
  onRecover: noop,
  onRetry: noop,
  onSelect: noop,
  onContinue: noop,
  onCreateNew: noop,
  onTryDifferent: noop,
};

// ── per-screen state → element ───────────────────────────────────────────────
function createEl(state, errorCode) {
  switch (state) {
    case 'prompting':
      return createView({ status: 'prompting' }, createCtx);
    case 'deploying':
    case 'funding':
      return createView({ status: 'deploying' }, createCtx);
    case 'success':
      return createView({ status: 'success', credential: SAMPLE_CRED }, createCtx);
    case 'error':
      return createView({ status: 'error', code: errorCode, message: '' }, createCtx);
    default:
      return createView({ status: 'idle' }, createCtx);
  }
}
function signEl(state, errorCode) {
  switch (state) {
    case 'prompting':
      return signView({ status: 'prompting' }, signCtx);
    case 'submitting':
      return signView({ status: 'submitting' }, signCtx);
    case 'done':
      return signView({ status: 'done', result: { status: 'SUCCESS', hash: SAMPLE_HASH } }, signCtx);
    case 'error':
      return signView({ status: 'error', code: errorCode, message: '' }, signCtx);
    default:
      return signView({ status: 'idle' }, signCtx);
  }
}
function recoverEl(state, errorCode, accounts) {
  const n = Math.max(0, Math.min(accounts, SAMPLE_ACCOUNTS.length));
  const accts = SAMPLE_ACCOUNTS.slice(0, n);
  switch (state) {
    case 'discovering':
      return recoverView({ status: 'discovering' }, [], recoverCtx);
    case 'resolved':
    case 'selected':
      return recoverView({ status: 'resolved', accounts: accts }, accts, recoverCtx);
    case 'none':
      return recoverView({ status: 'resolved', accounts: [] }, [], recoverCtx);
    case 'error':
      return recoverView({ status: 'error', code: errorCode, message: '' }, [], recoverCtx);
    default:
      return recoverView({ status: 'idle' }, [], recoverCtx);
  }
}

const connectCtx = {
  copy: DEFAULT_CONNECT_COPY,
  onCreate: noop,
  onUseExisting: noop,
  onHelp: noop,
};
const addDeviceCtx = {
  copy: DEFAULT_ADDDEVICE_COPY,
  onAdd: noop,
  onCancel: noop,
  onRetry: noop,
  onDone: noop,
};
const SAMPLE_SIGNER = 'P256:A91F2C7D8E0B4569ACED1234FF88A91F2C7D8E0B4569ACED7C4D';

function addDeviceEl(state, errorCode) {
  switch (state) {
    case 'prompting':
      return addDeviceView({ status: 'prompting' }, addDeviceCtx);
    case 'binding':
      return addDeviceView({ status: 'binding' }, addDeviceCtx);
    case 'success':
      return addDeviceView({ status: 'success', result: { signer: SAMPLE_SIGNER } }, addDeviceCtx);
    case 'error':
      return addDeviceView({ status: 'error', code: errorCode, message: '' }, addDeviceCtx);
    default:
      return addDeviceView({ status: 'idle' }, addDeviceCtx);
  }
}

function viewFor(screen, state, errorCode, accounts) {
  if (screen === 'sign') return signEl(state, errorCode);
  if (screen === 'recover') return recoverEl(state, errorCode, accounts);
  if (screen === 'connect') return connectView(connectCtx);
  if (screen === 'adddevice') return addDeviceEl(state, errorCode);
  return createEl(state, errorCode);
}

export default function RealScreen({
  screen = 'create',
  state = 'idle',
  errorCode = 'USER_CANCELLED',
  accounts = 3,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    node.replaceChildren(viewFor(screen, state, errorCode, accounts));
    return () => node.replaceChildren();
  }, [screen, state, errorCode, accounts]);
  return <div ref={ref} className="pk" />;
}
