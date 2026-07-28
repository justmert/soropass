/**
 * Demo 2 UI — the full v1 smart-wallet run wired to the REAL styled screens, live
 * on testnet: Create deploys a passkey-kit v1 smart-wallet + funds it; Sign runs a
 * passkey-authorized payment (correct key → SUCCESS, wrong key → on-chain reject);
 * Add device enrolls a second passkey signer on-chain (multi-device recovery).
 */
import './polyfills';
import '@soropass/ui/styled.css';
import { createAddDeviceFlow, createCreatePasskeyFlow } from '@soropass/ui/headless';
import type { SignFlowState } from '@soropass/ui/headless';
import {
  mountAddDeviceScreen,
  mountCreateScreen,
  signView,
  DEFAULT_SIGN_COPY,
  type SignCtx,
} from '@soropass/ui/styled';
import {
  createWalletV1,
  payFromWalletV1,
  addSecondDeviceV1,
  EXPLORER,
  rpId,
  type V1Wallet,
} from './v1Demo';

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

let wallet: V1Wallet | null = null;
let lastWrong = false;

el('rpid').textContent = rpId;

// ── Step 1 — real passkey → deploy + fund a v1 smart-wallet ─────────────────
const createFlow = createCreatePasskeyFlow({
  userActivation: globalThis.navigator.userActivation,
  create: async (input, report) => {
    const w = await createWalletV1(input.userName ?? 'alice', report, log);
    wallet = w;
    el('acct').textContent = w.contractId;
    const links = el('acctlinks');
    links.replaceChildren();
    explorerLink(links, `contract/${w.contractId}`, 'wallet ↗');
    if (w.deployTx) explorerLink(links, `tx/${w.deployTx}`, 'deploy tx ↗');
    el('signpanel').removeAttribute('data-disabled');
    el('recoverpanel').removeAttribute('data-disabled');
    renderSign({ status: 'idle' });
    return { contractId: w.contractId, credentialId: w.credentialId, publicKey: w.publicKey };
  },
});
mountCreateScreen(el('create'), { flow: createFlow, input: { userName: 'alice' } });

// ── Step 2 — passkey-signed payment (correct + wrong key) ──────────────────
function signCtx(): SignCtx {
  return {
    copy: DEFAULT_SIGN_COPY,
    tx: { amountValue: '5 XLM', destination: '(sponsor account)', action: 'payment' },
    onSign: () => void doPay(false),
    onCancel: () => renderSign({ status: 'idle' }),
    onRetry: () => void doPay(lastWrong),
    onDone: () => renderSign({ status: 'idle' }),
    onExplorer: () => {},
  };
}
function renderSign(state: SignFlowState): void {
  el('sign').replaceChildren(signView(state, signCtx()));
}

async function doPay(wrong: boolean): Promise<void> {
  if (!wallet) return;
  lastWrong = wrong;
  try {
    renderSign({ status: 'prompting' });
    const res = await payFromWalletV1(wallet, wrong, log);
    renderSign({ status: 'submitting' });
    if (res.hash) {
      explorerLink(
        el('resultlinks'),
        `tx/${res.hash}`,
        `${res.status === 'SUCCESS' ? '✓' : '✕'} ${res.status} tx ↗`,
      );
    }
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

el('wrongkey').addEventListener('click', () => void doPay(true));
renderSign({ status: 'idle' });

// ── Step 3 — add a second device on-chain (multi-device recovery) ──────────
const addDeviceFlow = createAddDeviceFlow({
  userActivation: globalThis.navigator.userActivation,
  addDevice: async (report) => {
    if (!wallet) throw new Error('create a wallet first');
    try {
      const { result, signer } = await addSecondDeviceV1(wallet, report, log);
      if (result.status !== 'SUCCESS') throw new Error('add_signer was not confirmed');
      explorerLink(el('recoverlinks'), `tx/${result.hash}`, '✓ add-signer tx ↗');
      return { signer };
    } catch (e) {
      // DEBUG: surface the exact failure (KitError code + the original DOMException
      // name preserved in its message + any cause name) so we can classify it.
      const err = e as { code?: string; name?: string; message?: string; cause?: unknown };
      const causeName =
        err.cause && typeof err.cause === 'object' && 'name' in err.cause
          ? (err.cause as { name?: string }).name
          : undefined;
      log(
        `⚠ add-device FAILED — code=${err.code ?? '(none)'} · ${err.name ?? ''} ${err.message ?? String(e)}` +
          (causeName ? ` · cause=${causeName}` : ''),
      );
      throw e;
    }
  },
});
mountAddDeviceScreen(el('adddevice'), { flow: addDeviceFlow });
