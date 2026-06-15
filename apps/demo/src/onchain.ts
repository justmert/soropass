/**
 * Demo 2 UI — wires the REAL styled Create + Sign screens to a live testnet
 * round-trip. Create deploys a smart account via the factory; Sign runs the
 * passkey-authorized `protected()` call on-chain (correct key → SUCCESS), and a
 * second button signs with the wrong key (→ on-chain FAILED).
 */
import './polyfills';
import '@soropass/ui/styled.css';
import { createCreatePasskeyFlow } from '@soropass/ui/headless';
import type { SignFlowState } from '@soropass/ui/headless';
import { mountCreateScreen, signView, DEFAULT_SIGN_COPY, type SignCtx } from '@soropass/ui/styled';
import {
  createWalletOnchain,
  buildSignedProtected,
  submitTx,
  EXPLORER,
  rpId,
  type OnchainWallet,
} from './onchainDemo';

const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

function log(msg: string): void {
  const line = document.createElement('div');
  line.className = 'oc-log__line';
  line.textContent = '› ' + msg;
  el('log').prepend(line);
}
function explorerLink(parent: HTMLElement, path: string, label: string): void {
  const a = document.createElement('a');
  a.href = `${EXPLORER}/${path}`;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = label;
  a.className = 'oc-xlink';
  parent.append(a);
}

let wallet: OnchainWallet | null = null;
let lastWrong = false;

el('rpid').textContent = rpId;

// ── Create: real passkey → factory-deployed testnet account ────────────────
const createFlow = createCreatePasskeyFlow({
  userActivation: globalThis.navigator.userActivation,
  create: async (input, report) => {
    const w = await createWalletOnchain(input.userName ?? 'alice', report, log);
    wallet = w;
    el('acct').textContent = w.contractId;
    const links = el('acctlinks');
    links.replaceChildren();
    explorerLink(links, `contract/${w.contractId}`, 'account ↗');
    if (w.deployTx) explorerLink(links, `tx/${w.deployTx}`, 'deploy tx ↗');
    el('signpanel').removeAttribute('data-disabled');
    renderSign({ status: 'idle' });
    return { contractId: w.contractId, credentialId: w.credentialId, publicKey: w.publicKey };
  },
});
mountCreateScreen(el('create'), { flow: createFlow, input: { userName: 'alice' } });

// ── Sign: real passkey-authorized protected() call (correct + wrong key) ───
function signCtx(): SignCtx {
  return {
    copy: DEFAULT_SIGN_COPY,
    tx: { amountValue: 'protected()', destination: wallet?.contractId ?? '', action: 'invoke' },
    onSign: () => void doSign(false),
    onCancel: () => renderSign({ status: 'idle' }),
    onRetry: () => void doSign(lastWrong),
    onDone: () => renderSign({ status: 'idle' }),
    onExplorer: () => {},
  };
}
function renderSign(state: SignFlowState): void {
  el('sign').replaceChildren(signView(state, signCtx()));
}

async function doSign(wrong: boolean): Promise<void> {
  if (!wallet) return;
  lastWrong = wrong;
  try {
    renderSign({ status: 'prompting' });
    const xdr = await buildSignedProtected(wallet, wrong, log);
    renderSign({ status: 'submitting' });
    const res = await submitTx(xdr, log);
    explorerLink(el('resultlinks'), `tx/${res.hash}`, `${res.status === 'SUCCESS' ? '✓' : '✕'} ${res.status} tx ↗`);
    if (res.status === 'SUCCESS') {
      renderSign({ status: 'done', result: { status: 'SUCCESS', hash: res.hash } });
    } else {
      renderSign({ status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' });
    }
  } catch (e) {
    log('error: ' + String(e));
    renderSign({ status: 'error', code: 'NETWORK_ERROR', message: String(e) });
  }
}

el('wrongkey').addEventListener('click', () => void doSign(true));
renderSign({ status: 'idle' });
