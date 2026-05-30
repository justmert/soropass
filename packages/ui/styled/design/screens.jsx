(function(){
const { useState, useRef, useEffect } = React;
/* Stellar Passkey UI — the three screens, every state.
   Each screen is CONTROLLED by a `state` prop so the identical component
   renders statically on the canvas and interactively in the prototype. */
const {
  Identicon, Spinner, Button, AddressChip, StatusLine, ErrorState,
} = window.PK;
const PKI = window.PKIcons;

/* Shared "OS sheet is open" overlay — calm, dimmed, pulsing. No spinner.
   Used by CREATE/prompting and RECOVER/discovering. */
function WaitOverlay({ title, hint, statusRef }) {
  return (
    <>
      <div className="pk-wait">
        <span className="pk-wait__glyph"><PKI.IconPasskey size={34} /></span>
        <div className="pk-wait__text">
          <div className="pk-wait__title">{title}</div>
          {/* polite live region: progress is announced calmly, not assertively */}
          <p className="pk-wait__hint" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
            {hint}
          </p>
        </div>
      </div>
      <div className="pk-ossheet" aria-hidden="true" />
    </>
  );
}

/* "We're working" busy block — visible, branded, NOT dimmed.
   Used by CREATE/deploying and SIGN/submitting. */
function WorkBlock({ glyphTone = "info", title, hint, statusRef }) {
  return (
    <div className="pk-work">
      <span className={`pk-glyph pk-glyph--${glyphTone}`}><Spinner /></span>
      <div className="pk-work__text">
        <div className="pk-work__title">{title}</div>
        <p className="pk-work__hint" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>{hint}</p>
      </div>
      <div className="pk-progress"><div className="pk-progress__bar" /></div>
    </div>
  );
}

/* ============================ SCREEN 1 — CREATE ======================== */
function CreateScreen({ state = "idle", errorCode = "create:network", address = "CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4", onEvent = () => {}, autoFocus = false }) {
  const statusRef = useRef(null);
  useEffect(() => {
    if (!autoFocus) return;
    if (["success", "deploying", "prompting", "error"].includes(state)) statusRef.current?.focus({ preventScroll: true });
  }, [state, autoFocus]);

  const Idle = (
    <>
      <div className="pk-head">
        <span className="pk-glyph"><PKI.IconPasskey /></span>
        <div className="pk-head__text">
          <h2 className="pk-title">Create your wallet</h2>
          <p className="pk-subtitle">A passkey — your Face ID, fingerprint, or security key — replaces your seed phrase. Nothing to write down.</p>
        </div>
      </div>
      <div className="pk-actions">
        <Button variant="primary" icon={<PKI.IconPasskey size={18} />} onClick={() => onEvent("create")}>
          Create passkey
        </Button>
        <button className="pk-link" onClick={() => onEvent("help")}>
          <PKI.IconHelp size={14} /> What’s a passkey?
        </button>
      </div>
    </>
  );

  if (state === "idle")
    return <Card>{Idle}</Card>;

  if (state === "prompting")
    return (
      <Card waiting>
        <div className="pk-card__dim">{Idle}</div>
        <WaitOverlay statusRef={statusRef}
          title="Waiting for your passkey"
          hint="Use Face ID, your fingerprint, or your security key to continue." />
      </Card>
    );

  if (state === "deploying")
    return (
      <Card>
        <WorkBlock glyphTone="info" statusRef={statusRef}
          title="Setting up your account…"
          hint="We’re deploying your smart account on-chain. This usually takes a few seconds." />
      </Card>
    );

  if (state === "success")
    return (
      <Card>
        <div className="pk-result">
          <div className="pk-result__head">
            <span className="pk-glyph pk-glyph--success"><PKI.IconCheckCircle /></span>
            <div className="pk-result__copy">
              <h2 className="pk-title">Wallet ready</h2>
              <p className="pk-message" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
                Your account is set up and ready to use.
              </p>
            </div>
          </div>
          <AddressChip address={address} label="Your account" />
          <div className="pk-actions">
            <Button variant="primary" onClick={() => onEvent("done")}>Continue</Button>
          </div>
        </div>
      </Card>
    );

  return (
    <Card>
      <ErrorState code={errorCode} statusRef={statusRef} onRetry={() => onEvent("retry")} />
    </Card>
  );
}

/* ============================ SCREEN 2 — SIGN ========================== */
const SAMPLE_TX = {
  amountValue: "250.00 USDC",
  amountFiat: "≈ $250.00",
  destination: "GDUKMGUGDZQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6X",
  action: "transfer",
};

function TxSummary({ tx }) {
  return (
    <div className="pk-summary">
      <div className="pk-summary__amount">
        <span className="pk-summary__amount-value">{tx.amountValue}</span>
        {tx.amountFiat && <span className="pk-summary__amount-fiat">{tx.amountFiat}</span>}
      </div>
      <div className="pk-summary__rows">
        <div className="pk-row">
          <span className="pk-row__key">To</span>
          <span className="pk-row__val pk-row__val--mono" title={tx.destination}>
            {window.PK.truncMiddle(tx.destination, 6, 6)}
          </span>
        </div>
        <div className="pk-row">
          <span className="pk-row__key">Action</span>
          <span className="pk-tag">{tx.action}</span>
        </div>
      </div>
    </div>
  );
}

function SignScreen({ state = "idle", errorCode = "sign:network", tx = SAMPLE_TX, txHash = "a1b9f4c7e2d8053614af9b2c7e0d4f6182a3c5d7e9b0f1234567890abcdef1234", onEvent = () => {}, autoFocus = false }) {
  const statusRef = useRef(null);
  useEffect(() => {
    if (!autoFocus) return;
    if (["done", "submitting", "prompting", "error"].includes(state)) statusRef.current?.focus({ preventScroll: true });
  }, [state, autoFocus]);

  const Header = (
    <div className="pk-head">
      <span className="pk-glyph"><PKI.IconShield /></span>
      <div className="pk-head__text">
        <h2 className="pk-title">Approve transaction</h2>
        <p className="pk-subtitle">Review the details, then sign with your passkey.</p>
      </div>
    </div>
  );

  if (state === "idle")
    return (
      <Card>
        {Header}
        <TxSummary tx={tx} />
        <div className="pk-actions pk-actions--row">
          <Button variant="secondary" onClick={() => onEvent("cancel")}>Cancel</Button>
          <Button variant="primary" icon={<PKI.IconPasskey size={18} />} onClick={() => onEvent("sign")}>Sign</Button>
        </div>
      </Card>
    );

  if (state === "prompting")
    return (
      <Card waiting>
        <div className="pk-card__dim">
          {Header}
          <TxSummary tx={tx} />
        </div>
        <WaitOverlay statusRef={statusRef}
          title="Waiting for your passkey"
          hint="Use Face ID, your fingerprint, or your security key to sign this transaction." />
      </Card>
    );

  if (state === "submitting")
    return (
      <Card>
        <div className="pk-card__dim" style={{ opacity: 0.4 }}>
          <TxSummary tx={tx} />
        </div>
        <WorkBlock glyphTone="info" statusRef={statusRef}
          title="Submitting transaction…"
          hint="Your signature is captured. We’re sending the transaction to the network." />
      </Card>
    );

  if (state === "done")
    return (
      <Card>
        <div className="pk-result">
          <div className="pk-result__head">
            <span className="pk-glyph pk-glyph--success"><PKI.IconCheckCircle /></span>
            <div className="pk-result__copy">
              <h2 className="pk-title">Transaction sent</h2>
              <p className="pk-message" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
                Your transaction was submitted and confirmed on the network.
              </p>
            </div>
          </div>
          <div className="pk-address">
            <span className="pk-address__text" title={txHash}>
              <span className="pk-address__label">Transaction hash</span>
              {window.PK.truncMiddle(txHash, 8, 6)}
            </span>
            <a className="pk-copy" href="#" onClick={(e) => { e.preventDefault(); onEvent("explorer"); }}
               aria-label="View on explorer"><PKI.IconExternal size={17} /></a>
          </div>
          <div className="pk-actions">
            <Button variant="primary" onClick={() => onEvent("done")}>Done</Button>
            <a className="pk-link" href="#" onClick={(e) => { e.preventDefault(); onEvent("explorer"); }}>
              View on explorer <PKI.IconExternal size={14} />
            </a>
          </div>
        </div>
      </Card>
    );

  return (
    <Card>
      <ErrorState code={errorCode} statusRef={statusRef} onRetry={() => onEvent("retry")} />
    </Card>
  );
}

/* ============================ SCREEN 3 — RECOVER ====================== */
const SAMPLE_ACCOUNTS = [
  { address: "CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4", meta: "Last used 2 days ago" },
  { address: "CDEF8GH1J2K3L4M5N6P7Q8R9S0T1U2V3W4X5Y6Z7B8", meta: "Last used 3 weeks ago" },
  { address: "CBQ9Z8Y7X6W5V4U3T2S1R0P9N8M7L6K5J4H3G2F1D0", meta: "Created Apr 2026" },
];

/* Proper listbox: roving focus, Up/Down/Home/End + Enter/Space. */
function RecoverList({ accounts, selected, onSelect, autoFocus }) {
  const [active, setActive] = useState(selected ?? 0);
  const refs = useRef([]);
  useEffect(() => {
    if (autoFocus) { refs.current[active]?.focus({ preventScroll: true }); }
  }, []); // focus first (or selected) on mount only
  const move = (next) => {
    const i = (next + accounts.length) % accounts.length;
    setActive(i);
    refs.current[i]?.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(active + 1); break;
      case "ArrowUp":   e.preventDefault(); move(active - 1); break;
      case "Home":      e.preventDefault(); move(0); break;
      case "End":       e.preventDefault(); move(accounts.length - 1); break;
      case "Enter":
      case " ":         e.preventDefault(); onSelect(active); break;
      default: break;
    }
  };
  return (
    <ul className="pk-listbox" role="listbox" aria-label="Accounts for this passkey" onKeyDown={onKey}>
      {accounts.map((a, i) => (
        <li
          key={a.address}
          ref={(el) => (refs.current[i] = el)}
          role="option"
          aria-selected={selected === i}
          tabIndex={i === active ? 0 : -1}
          className={`pk-option ${i === active ? "is-active" : ""}`}
          onClick={() => { setActive(i); onSelect(i); }}
          onFocus={() => setActive(i)}
        >
          <Identicon seed={a.address} />
          <span className="pk-option__body">
            <span className="pk-option__addr">{window.PK.truncMiddle(a.address)}</span>
            <span className="pk-option__meta">{a.meta}</span>
          </span>
          <span className="pk-option__check"><PKI.IconCheck size={20} /></span>
        </li>
      ))}
    </ul>
  );
}

function RecoverScreen({ state = "idle", errorCode = "recover:network", accounts = SAMPLE_ACCOUNTS, selectedIndex = 0, onEvent = () => {}, autoFocus = false }) {
  const statusRef = useRef(null);
  useEffect(() => {
    if (!autoFocus) return;
    if (["discovering", "none", "error"].includes(state)) statusRef.current?.focus({ preventScroll: true });
  }, [state, autoFocus]);

  const Idle = (
    <>
      <div className="pk-head">
        <span className="pk-glyph"><PKI.IconKey /></span>
        <div className="pk-head__text">
          <h2 className="pk-title">Find your account</h2>
          <p className="pk-subtitle">Use your passkey to find the accounts it controls — no seed phrase needed.</p>
        </div>
      </div>
      <div className="pk-actions">
        <Button variant="primary" icon={<PKI.IconKey size={18} />} onClick={() => onEvent("recover")}>Recover</Button>
      </div>
    </>
  );

  if (state === "idle") return <Card>{Idle}</Card>;

  if (state === "discovering")
    return (
      <Card waiting>
        <div className="pk-card__dim">{Idle}</div>
        <WaitOverlay statusRef={statusRef}
          title="Looking for your accounts"
          hint="Confirm with your passkey so we can find the accounts it controls." />
      </Card>
    );

  if (state === "resolved" || state === "selected") {
    const sel = state === "selected" ? selectedIndex : null;
    const many = accounts.length > 1;
    return (
      <Card>
        <div className="pk-head">
          <div className="pk-head__text">
            <h2 className="pk-title">{many ? `${accounts.length} accounts found` : "Account found"}</h2>
            <p className="pk-subtitle">{many ? "Choose the account you’d like to use." : "This passkey controls the account below."}</p>
          </div>
        </div>
        <RecoverList accounts={accounts} selected={sel} autoFocus={autoFocus}
          onSelect={(i) => onEvent("select", i)} />
        <div className="pk-actions">
          <Button variant="primary" disabled={sel === null} aria-disabled={sel === null}
            onClick={() => onEvent("continue", sel)}>
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  if (state === "none")
    return (
      <Card>
        <div className="pk-result">
          <div className="pk-result__head">
            <span className="pk-glyph pk-glyph--muted"><PKI.IconKey /></span>
            <div className="pk-result__copy">
              <h2 className="pk-title">No accounts found</h2>
              <p className="pk-message" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
                This passkey isn’t linked to any accounts yet. You can create a new wallet, or try a different passkey.
              </p>
            </div>
          </div>
          <div className="pk-actions">
            <Button variant="primary" icon={<PKI.IconPlus size={18} />} onClick={() => onEvent("create")}>
              Create a new passkey instead
            </Button>
            <button className="pk-link" onClick={() => onEvent("retry")}>Try a different passkey</button>
          </div>
        </div>
      </Card>
    );

  return (
    <Card>
      <ErrorState code={errorCode} statusRef={statusRef} onRetry={() => onEvent("retry")} />
    </Card>
  );
}

/* Card shell */
function Card({ waiting, children, dir }) {
  return (
    <div className={`pk-card ${waiting ? "is-waiting" : ""}`} dir={dir}>
      {children}
    </div>
  );
}

window.PKScreens = { CreateScreen, SignScreen, RecoverScreen, SAMPLE_TX, SAMPLE_ACCOUNTS, Card };

})();
