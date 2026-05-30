(function(){
/* Stellar Passkey UI — shared primitives + error copy.
   Pure-token styling (classes from passkey.css). Exposed on window. */
const { useState, useRef, useEffect, useCallback } = React;
const {
  IconPasskey, IconKey, IconShield, IconCopy, IconCheck, IconCheckCircle,
  IconAlert, IconExternal, IconRefresh, IconPlus, IconChevron, IconHelp,
} = window.PKIcons;

/* ---- helpers ----------------------------------------------------------- */
const truncMiddle = (s, lead = 6, tail = 4) =>
  !s || s.length <= lead + tail + 1 ? s : `${s.slice(0, lead)}…${s.slice(-tail)}`;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Deterministic gravatar-style 5x5 symmetric identicon, brand-hued. */
function Identicon({ seed = "", size = 28 }) {
  const h = hashStr(seed);
  const hue = h % 360;
  const fg = `oklch(0.6 0.15 ${hue})`;
  const bg = `oklch(0.94 0.02 ${hue})`;
  const cells = [];
  const cell = size / 5;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const on = (h >> (y * 3 + x)) & 1;
      if (!on) continue;
      const xs = x === 2 ? [2] : [x, 4 - x];
      xs.forEach((cx) =>
        cells.push(<rect key={`${cx}-${y}`} x={cx * cell} y={y * cell} width={cell} height={cell} fill={fg} />)
      );
    }
  }
  return (
    <svg className="pk-identicon" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <rect width={size} height={size} fill={bg} />
      {cells}
    </svg>
  );
}

/* ---- Spinner / Button -------------------------------------------------- */
function Spinner({ className }) {
  return <span className={`pk-spinner ${className || ""}`} role="presentation" aria-hidden="true" />;
}

function Button({ variant = "primary", children, busy, icon, ...rest }) {
  return (
    <button className={`pk-btn pk-btn--${variant}`} {...rest}>
      {busy && <span className="pk-spinner pk-btn__spinner" aria-hidden="true" />}
      {icon && !busy ? icon : null}
      {children}
    </button>
  );
}

/* ---- Truncated address with copy-to-clipboard -------------------------- */
function AddressChip({ address, label = "Account", showIdenticon = true }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    try { navigator.clipboard?.writeText(address); } catch (e) {}
    setCopied(true);
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [address]);
  return (
    <div className="pk-address">
      {showIdenticon && <Identicon seed={address} />}
      <span className="pk-address__text" title={address}>
        <span className="pk-address__label">{label}</span>
        {truncMiddle(address)}
      </span>
      <button
        type="button"
        className={`pk-copy ${copied ? "is-copied" : ""}`}
        onClick={copy}
        aria-label={copied ? "Address copied" : "Copy full address"}
      >
        {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
      </button>
    </div>
  );
}

/* ---- Status line (aria-live). Polite for progress, assertive for error -- */
const StatusLine = React.forwardRef(function StatusLine(
  { tone = "info", icon, children, assertive = false, tabIndex }, ref
) {
  return (
    <p
      ref={ref}
      className={`pk-status pk-status--${tone}`}
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      tabIndex={tabIndex}
    >
      {icon}
      <span>{children}</span>
    </p>
  );
});

/* ---- ONE error layout, copy swapped by code ---------------------------- */
const ERROR_COPY = {
  // CREATE
  "create:cancelled":   { t: "Setup cancelled", m: "You closed the passkey prompt before your wallet was created. You can try again whenever you’re ready.", a: "Try again" },
  "create:unsupported": { t: "Device not supported", m: "This device or passkey can’t be used to create a wallet. Try another device or security key.", a: "Try again" },
  "create:onchain":     { t: "Passkey not supported", m: "This passkey type isn’t supported for on-chain accounts yet. Try a different device or passkey.", a: "Try again" },
  "create:keyread":     { t: "Couldn’t read your passkey", m: "We couldn’t read the key from this passkey. Please try again.", a: "Try again" },
  "create:setup":       { t: "Account setup didn’t finish", m: "Your passkey was created, but we couldn’t finish setting up your account. Please try again.", a: "Try again" },
  "create:network":     { t: "Connection problem", m: "We couldn’t reach the network. Check your connection and try again.", a: "Retry" },
  // SIGN
  "sign:cancelled":     { t: "Signing cancelled", m: "You closed the passkey prompt before the transaction was signed. You can try again.", a: "Try again" },
  "sign:unsupported":   { t: "Device not supported", m: "This device or passkey can’t be used to sign. Try another device or security key.", a: "Try again" },
  "sign:verify":        { t: "Couldn’t verify this request", m: "This transaction may have changed or expired. Review the details and try again.", a: "Try again" },
  "sign:network":       { t: "Connection problem", m: "We couldn’t reach the network. Check your connection and try again.", a: "Retry" },
  "sign:signature":     { t: "Signature problem", m: "The signature couldn’t be completed. Please try signing again.", a: "Try again" },
  // RECOVER
  "recover:cancelled":  { t: "Recovery cancelled", m: "You closed the passkey prompt before we finished. You can try again whenever you’re ready.", a: "Try again" },
  "recover:unsupported":{ t: "Device not supported", m: "This device or passkey can’t be used to recover an account. Try another device or security key.", a: "Try again" },
  "recover:network":    { t: "Connection problem", m: "We couldn’t reach the network. Check your connection and try again.", a: "Retry" },
};

const ErrorState = React.forwardRef(function ErrorState(
  { code = "create:network", onRetry, statusRef }, ref
) {
  const c = ERROR_COPY[code] || ERROR_COPY["create:network"];
  const [, codeKey] = code.split(":");
  return (
    <div className="pk-result">
      <div className="pk-result__head">
        <span className="pk-glyph pk-glyph--error"><IconAlert /></span>
        <div className="pk-result__copy">
          <h2 className="pk-title">{c.t}</h2>
          {/* assertive live region — announced immediately + focused after the error */}
          <p className="pk-message" role="alert" aria-live="assertive" tabIndex={-1} ref={statusRef}>
            {c.m}
          </p>
          <span className="pk-errcode">error code: {codeKey}</span>
        </div>
      </div>
      <div className="pk-actions">
        <Button variant="primary" icon={<IconRefresh size={18} />} onClick={onRetry}>
          {c.a}
        </Button>
      </div>
    </div>
  );
});

window.PK = {
  truncMiddle, hashStr, Identicon, Spinner, Button, AddressChip,
  StatusLine, ErrorState, ERROR_COPY,
};

})();
