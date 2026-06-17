import { useState } from 'react';
import { signIn, signMessage } from '../onchain.ts';

const trunc = (s, n = 6, t = 6) =>
  !s || s.length <= n + t + 1 ? s : `${s.slice(0, n)}…${s.slice(-t)}`;
const truncMid = (s, n = 10, t = 10) =>
  !s || s.length <= n + t + 1 ? s : `${s.slice(0, n)}…${s.slice(-t)}`;

/**
 * Flow 3 — Sign in & sign a message. Two real passkey assertions: one to sign in
 * (prove you hold the credential), one to sign an arbitrary message. The message
 * signature is verified LOCALLY with the exact secp256r1 check Soroban's
 * `secp256r1_verify` runs — against your key (✓) and a foreign key (✗). No chain.
 */
export default function Flow3SignMessage({ wallet }) {
  const [signedIn, setSignedIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [msg, setMsg] = useState(
    'I authorize sign-in to soropass.dev at ' + new Date().toISOString().slice(0, 10),
  );
  const [signing, setSigning] = useState(false);
  const [proof, setProof] = useState(null);
  const [error, setError] = useState(null);

  if (!wallet) {
    return (
      <div className="flow__single flow__locked">
        <p className="flow__lockedtitle">Create a wallet first</p>
        <p className="flow__note">
          Flow 3 reuses the passkey from Flow 1 to sign in and sign messages. Create a wallet above,
          then come back.
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

  async function doSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signIn(wallet);
      setSignedIn(true);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSigningIn(false);
    }
  }

  async function doSign() {
    setError(null);
    setSigning(true);
    setProof(null);
    try {
      const p = await signMessage(wallet, msg);
      setProof(p);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="flow__single sigcard">
      {/* sign in */}
      <div className="sig__row">
        <div className="sig__rowhead">
          <span className={`sig__dot ${signedIn ? 'is-on' : ''}`}>{signedIn ? '✓' : '1'}</span>
          <div>
            <p className="sig__rowtitle">Sign in with your passkey</p>
            <p className="sig__rowsub">
              {signedIn ? (
                <>
                  Signed in as <code>{trunc(wallet.contractId, 6, 6)}</code>
                </>
              ) : (
                'A real assertion proves you hold this credential.'
              )}
            </p>
          </div>
        </div>
        {!signedIn && (
          <button
            className="lp-btn lp-btn--primary"
            disabled={signingIn}
            onClick={() => void doSignIn()}
          >
            {signingIn ? 'Waiting for passkey…' : 'Sign in'}
          </button>
        )}
      </div>

      {/* sign a message */}
      <div className={`sig__row ${signedIn ? '' : 'is-locked'}`}>
        <div className="sig__rowhead">
          <span className="sig__dot">2</span>
          <div>
            <p className="sig__rowtitle">Sign a message</p>
            <p className="sig__rowsub">
              Your passkey signs it; we verify the secp256r1 signature in the browser.
            </p>
          </div>
        </div>
        <textarea
          className="sig__msg"
          rows={2}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          disabled={!signedIn || signing}
        />
        <button
          className="lp-btn lp-btn--primary sig__signbtn"
          disabled={!signedIn || signing || !msg.trim()}
          onClick={() => void doSign()}
        >
          {signing ? 'Waiting for passkey…' : 'Sign message with passkey'}
        </button>
      </div>

      {error && (
        <p className="sig__error" role="alert">
          {error}
        </p>
      )}

      {proof && (
        <div className="sig__proof">
          <div className={`sig__verdict ${proof.validForOwner ? 'is-ok' : 'is-bad'}`}>
            <span className="sig__verdicticon">{proof.validForOwner ? '✓' : '✕'}</span>
            <div>
              <p className="sig__verdicttitle">
                {proof.validForOwner ? 'Signature valid' : 'Verification failed'}
              </p>
              <p className="sig__verdictsub">
                Verified against your account’s secp256r1 public key.
              </p>
            </div>
          </div>
          <div className={`sig__verdict ${proof.validForOtherKey ? 'is-bad' : 'is-ok'}`}>
            <span className="sig__verdicticon">{proof.validForOtherKey ? '✕' : '✓'}</span>
            <div>
              <p className="sig__verdicttitle">
                {proof.validForOtherKey
                  ? 'Unexpected: passed for another key'
                  : 'Rejected for any other key'}
              </p>
              <p className="sig__verdictsub">
                The same signature checked against a different key, bound to your passkey.
              </p>
            </div>
          </div>
          <dl className="sig__facts">
            <div>
              <dt>Message</dt>
              <dd>{proof.message}</dd>
            </div>
            <div>
              <dt>Challenge (SHA-256, b64url)</dt>
              <dd>
                <code>{truncMid(proof.challengeB64, 14, 14)}</code>
              </dd>
            </div>
            <div>
              <dt>Signature (low-S, compact)</dt>
              <dd>
                <code>{truncMid(proof.signatureHex, 16, 16)}</code>
              </dd>
            </div>
          </dl>
        </div>
      )}

      <p className="flow__note">
        Pure secp256r1 over <code>SHA-256(authData ‖ SHA-256(clientDataJSON))</code>. The same check
        the on-chain host function runs, here proven entirely client-side.
      </p>
    </div>
  );
}
