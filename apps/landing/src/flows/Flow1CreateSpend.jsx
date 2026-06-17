import { useEffect, useReducer, useRef, useState } from 'react';
import { createCreatePasskeyFlow } from '@soropass/ui/headless';
import { mountCreateScreen, signView, DEFAULT_SIGN_COPY } from '@soropass/ui/styled';
import {
  createWalletOnchain,
  prepareTransfer,
  signPrepared,
  submitTransfer,
  EXPLORER,
  TRANSFER_XLM,
} from '../onchain.ts';

const trunc = (s, n = 6, t = 6) =>
  !s || s.length <= n + t + 1 ? s : `${s.slice(0, n)}…${s.slice(-t)}`;

function ProofBtn({ href, children }) {
  return (
    <a className="demo__proof" href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  );
}

const STAGES = [
  { key: 'passkey', label: 'Passkey created with Face ID, fingerprint, or a security key' },
  { key: 'deployed', label: 'Smart account deployed on testnet' },
  { key: 'funded', label: 'Funded with 100 XLM' },
  { key: 'transferred', label: `Passkey authorizes ${TRANSFER_XLM} XLM transfer` },
];

/**
 * Flow 1 — Create & spend. The real create + sign styled screens wired to a live
 * testnet round-trip (create → factory deploy → fund → passkey-authorized
 * transfer), plus the wrong-key → rejected-on-chain proof. Lifts the created
 * wallet up via `onWallet` so Flows 2 & 3 can reuse the same passkey.
 */
export default function Flow1CreateSpend({ onWallet }) {
  const createRef = useRef(null);
  const signRef = useRef(null);
  const walletRef = useRef(null);
  const wrongRef = useRef(false);

  const [wallet, setWallet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ev, pushEvent] = useReducer((s, e) => ({ ...s, [e.kind]: e }), {});

  // Create → deploy → fund
  useEffect(() => {
    const node = createRef.current;
    if (!node) return undefined;
    const flow = createCreatePasskeyFlow({
      userActivation: globalThis.navigator.userActivation,
      create: async (input, report) => {
        const w = await createWalletOnchain(input.userName ?? 'alice', report, pushEvent);
        walletRef.current = w;
        setWallet(w);
        onWallet?.(w);
        return { contractId: w.contractId, credentialId: w.credentialId, publicKey: w.publicKey };
      },
    });
    const off = flow.subscribe(() => {
      const st = flow.getState().status;
      setBusy(st === 'prompting' || st === 'deploying');
    });
    const handle = mountCreateScreen(node, {
      flow,
      input: { userName: 'alice' },
      copy: {
        idleSubtitle:
          'A passkey (your Face ID, fingerprint, or security key) replaces your seed phrase. Nothing to write down.',
      },
      onHelp: () => globalThis.open('https://passkeys.dev/', '_blank', 'noopener,noreferrer'),
    });
    return () => {
      off();
      handle.unmount();
    };
  }, [onWallet]);

  // Sign: real passkey-authorized transfer (correct + wrong key)
  function signCtx() {
    return {
      copy: { ...DEFAULT_SIGN_COPY, idleTitle: 'Send a transaction' },
      tx: {
        amountValue: `${TRANSFER_XLM} XLM`,
        destination: ev.dest?.account ?? '',
        action: 'transfer',
      },
      onSign: () => void doTransfer(false),
      onCancel: () => renderSign({ status: 'idle' }),
      onRetry: () => void doTransfer(wrongRef.current),
      onDone: () => renderSign({ status: 'idle' }),
      onExplorer: (hash) => {
        if (hash) globalThis.open(`${EXPLORER}/tx/${hash}`, '_blank', 'noopener,noreferrer');
      },
    };
  }
  function renderSign(state) {
    if (signRef.current) signRef.current.replaceChildren(signView(state, signCtx()));
  }
  async function doTransfer(wrong) {
    const w = walletRef.current;
    if (!w) return;
    wrongRef.current = wrong;
    setBusy(true);
    try {
      renderSign({ status: 'prompting' });
      // Build fresh on every click so the source sequence + Soroban auth nonce are
      // always current. (A stale pre-built envelope was why a second action got
      // rejected on-chain after the first one succeeded.)
      const env = await prepareTransfer(w);
      const xdr = await signPrepared(env, w, wrong);
      renderSign({ status: 'submitting' });
      const res = await submitTransfer(xdr, pushEvent);
      if (res.status === 'SUCCESS')
        renderSign({ status: 'done', result: { status: 'SUCCESS', hash: res.hash } });
      else renderSign({ status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' });
    } catch (e) {
      renderSign({ status: 'error', code: 'NETWORK_ERROR', message: String(e) });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (wallet) renderSign({ status: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, ev.dest]);

  const firstUndone = STAGES.findIndex((s) => !ev[s.key]);

  return (
    <div className="demo">
      <div className="demo__cols">
        <div className="demo__step">
          <div className="demo__steptag">Step 1</div>
          <h3 className="demo__steptitle">Create a wallet</h3>
          <div className="demo__screen pk" ref={createRef} />
        </div>
        <div className={`demo__step ${wallet ? '' : 'is-locked'}`}>
          <div className="demo__steptag">Step 2</div>
          <h3 className="demo__steptitle">Send {TRANSFER_XLM} XLM with your passkey</h3>
          <div className="demo__screen pk" ref={signRef} />
          {wallet && (
            <button className="demo__wrong" onClick={() => void doTransfer(true)}>
              Sign with the WRONG key → rejected on-chain
            </button>
          )}
          {!wallet && <p className="demo__hint--center">Create a wallet first.</p>}
        </div>
      </div>

      <ol className="demo__steps">
        {STAGES.map((s, i) => {
          const e = ev[s.key];
          const done = !!e;
          const active = busy && i === firstUndone;
          const failed = s.key === 'transferred' && e?.status === 'FAILED';
          return (
            <li
              className={`demo__steprow ${done ? 'is-done' : active ? 'is-active' : 'is-pending'} ${failed ? 'is-failed' : ''}`}
              key={s.key}
            >
              <span className="demo__stepmark">
                {done ? failed ? '✕' : '✓' : active ? <span className="demo__spin" /> : i + 1}
              </span>
              <span className="demo__steplabel">
                {s.label}
                {failed && ': rejected by secp256r1_verify'}
                {s.key === 'deployed' && e && (
                  <code className="demo__addr">{trunc(e.account, 6, 6)}</code>
                )}
              </span>
              <span className="demo__steplinks">
                {s.key === 'deployed' && e && (
                  <>
                    <ProofBtn href={`${EXPLORER}/contract/${e.account}`}>account</ProofBtn>
                    {e.tx && <ProofBtn href={`${EXPLORER}/tx/${e.tx}`}>deploy tx</ProofBtn>}
                  </>
                )}
                {s.key === 'funded' && e && (
                  <ProofBtn href={`${EXPLORER}/tx/${e.tx}`}>fund tx</ProofBtn>
                )}
                {s.key === 'transferred' && e && (
                  <>
                    <ProofBtn href={`${EXPLORER}/tx/${e.tx}`}>transfer tx</ProofBtn>
                    {ev.dest && (
                      <ProofBtn href={`${EXPLORER}/account/${ev.dest.account}`}>
                        destination
                      </ProofBtn>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
