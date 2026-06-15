/* Soropass UI — icon set. Thin line (1.75), currentColor, 24px grid.
   ES module: pages `import * as PKI from '../icons'`. */
const I = ({ children, size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size || 24}
    height={size || 24}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

/* Passkey — fingerprint, the core glyph */
export const IconPasskey = (p) => (
  <I {...p}>
    <path d="M12 10a2 2 0 0 1 2 2c0 2.5-.4 5-1.2 7" />
    <path d="M8.5 6.6A6 6 0 0 1 18 12c0 1.2-.1 2.4-.3 3.5" />
    <path d="M6 12a6 6 0 0 1 .8-3" />
    <path d="M6.2 16.5c.4-1.3.6-2.8.6-4.5a5 5 0 0 1 .3-1.7" />
    <path d="M9 19c.7-1.4 1-3.3 1-5.5a2 2 0 0 1 .2-1" />
    <path d="M15.4 17.8c.2-.9.3-1.9.4-2.8" />
  </I>
);

/* Key — alt for recover */
export const IconKey = (p) => (
  <I {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12.2 19 4" />
    <path d="M16 7l2.5 2.5" />
    <path d="M14 9l2.5 2.5" />
  </I>
);

/* Shield-check — secure account */
export const IconShield = (p) => (
  <I {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
    <path d="M9 11.5l2 2 4-4" />
  </I>
);

export const IconCopy = (p) => (
  <I {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </I>
);

export const IconCheck = (p) => (
  <I {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </I>
);

export const IconCheckCircle = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.2l2.6 2.6L16 9.5" />
  </I>
);

/* Alert — error layout */
export const IconAlert = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5" />
    <path d="M12 16.2v.1" />
  </I>
);

export const IconExternal = (p) => (
  <I {...p}>
    <path d="M14 5h5v5" />
    <path d="M19 5l-8 8" />
    <path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5" />
  </I>
);

export const IconRefresh = (p) => (
  <I {...p}>
    <path d="M19 8a7 7 0 0 0-12-2L5 8" />
    <path d="M5 4v4h4" />
    <path d="M5 16a7 7 0 0 0 12 2l2-2" />
    <path d="M19 20v-4h-4" />
  </I>
);

export const IconPlus = (p) => (
  <I {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </I>
);

export const IconChevron = (p) => (
  <I {...p}>
    <path d="M9 6l6 6-6 6" />
  </I>
);

/* Sliders — info link "What's a passkey?" */
export const IconHelp = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1.9-1.1 1.8" />
    <path d="M12 16.5v.1" />
  </I>
);

export const IconArrowLeft = (p) => (
  <I {...p}>
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </I>
);
