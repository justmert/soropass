import { useState } from 'react';
import { prepareProtected, signPrepared, submitSigned, EXPLORER } from '../onchain.ts';

const trunc = (s, n = 6, t = 6) =>
  !s || s.length <= n + t + 1 ? s : `${s.slice(0, n)}…${s.slice(-t)}`;

/**
 * Flow 2 — Approve a dApp action. A connected app asks the passkey wallet to
 * approve an on-chain action. We invoke the account's `require_auth`-gated
 * `protected()` method, which forces the contract's `__check_auth → secp256r1_verify`
 * to run on-chain: a real passkey is accepted, a wrong key is rejected by the chain.
 */
export default function Flow2DappAction({ wallet }) {
  const [busy, setBusy] = useState(false);
  const [wrongBusy, setWrongBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, hash }
  const [error, setError] = useState(null);

  if (!wallet) {
    return (
      <div className="flow__single flow__locked">
        <p className="flow__lockedtitle">Create a wallet first</p>
        <p className="flow__note">
          Flow 2 uses the smart account from Flow 1. Create a wallet above, then come back to
          approve an action with the same passkey.
        </p>
        <button
          className="lp-btn lp-btn--ghost"
          onClick={() =>
            document.getElementById('uc1')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        >
          Go to Flow 1 ↑
        </button>
      </div>
    );
  }

  async function approve(wrong) {
    setError(null);
    setResult(null);
    if (wrong) setWrongBusy(true);
    else setBusy(true);
    try {
      // Build fresh on every click so the source sequence + Soroban auth nonce
      // are always current (a stale envelope gets rejected on-chain).
      const env = await prepareProtected(wallet);
      const xdr = await signPrepared(env, wallet, wrong);
      const res = await submitSigned(xdr);
      setResult({ ok: res.status === 'SUCCESS', hash: res.hash });
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
      setWrongBusy(false);
    }
  }

  return (
    <div className="flow__single dapp">
      {/* mock dApp request */}
      <div className="dapp__req">
        <div className="dapp__app">
          <span className="dapp__appicon">◈</span>
          <div className="dapp__appmeta">
            <p className="dapp__appname">ExampleSwap</p>
            <p className="dapp__appurl">app.exampleswap.xyz</p>
          </div>
          <span className="dapp__conn">
            <span /> connected
          </span>
        </div>
        <p className="dapp__ask">
          This app is asking your passkey wallet to approve an on-chain action.
        </p>
        <div className="dapp__action">
          <span className="dapp__actionlabel">Action</span>
          <code>
            protected() · <span className="dapp__addr">{trunc(wallet.contractId, 6, 6)}</span>
          </code>
        </div>
      </div>

      <button
        className="lp-btn lp-btn--primary dapp__btn"
        disabled={busy || wrongBusy}
        onClick={() => void approve(false)}
      >
        {busy ? 'Waiting for your passkey…' : 'Approve with passkey'}
      </button>

      {error && (
        <p className="sig__error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className={`dapp__result ${result.ok ? 'is-ok' : 'is-bad'}`}>
          <span className="dapp__resulticon">{result.ok ? '✓' : '✕'}</span>
          <div className="dapp__resultbody">
            <p className="dapp__resulttitle">
              {result.ok ? 'Approved on-chain' : 'Rejected on-chain'}
            </p>
            <p className="dapp__resultsub">
              {result.ok
                ? 'Your smart account verified the passkey signature with secp256r1.'
                : 'The signature failed the contract’s secp256r1_verify check.'}
            </p>
            <a
              className="recover__doneaddr"
              href={`${EXPLORER}/tx/${result.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{trunc(result.hash, 8, 8)}</code> view on Stellar Expert ↗
            </a>
          </div>
        </div>
      )}

      <button
        className="demo__wrong"
        disabled={busy || wrongBusy}
        onClick={() => void approve(true)}
      >
        {wrongBusy ? 'Submitting…' : 'Approve with the WRONG key → rejected on-chain'}
      </button>

      <p className="flow__note">
        Verified on-chain by your account contract (<code>__check_auth → secp256r1_verify</code>).
        The chain accepts only your passkey and rejects any other key.
      </p>
    </div>
  );
}
