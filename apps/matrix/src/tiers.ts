/**
 * S08 (YK-434) — verification tiers. Every matrix cell is labelled with HOW it
 * was verified so none is ambiguous (the S08 gate). See
 * `docs/matrix/automation-coverage.md` for the sourced findings.
 */
import { BROWSER_OS } from './matrixSchema';

export type Tier = 'tier-1-automated' | 'tier-2-manual';

export interface VerificationTier {
  tier: Tier;
  /** How the cell is verified today. */
  method: string;
  /** Whether automation is feasible (sourced), even if not yet wired. */
  automatable: boolean;
  /** Whether the automated harness is wired and running in CI now. */
  wired: boolean;
  note?: string;
}

const MOBILE_OS = new Set(['iOS', 'Android']);

/** Per-engine desktop classification (mobile is handled by {@link tierFor}). */
const DESKTOP_TIERS: Record<string, VerificationTier> = {
  Chrome: {
    tier: 'tier-1-automated',
    method: 'CDP virtual authenticator (Playwright, S07)',
    automatable: true,
    wired: true,
  },
  Edge: {
    tier: 'tier-2-manual',
    method: 'Chromium/Blink — the Chrome CDP virtual-authenticator path applies (Playwright, S07)',
    automatable: true,
    wired: false,
    note: 'Edge shares Chrome’s Blink+CDP engine, so the Tier-1 harness applies — but msedge is best-effort in CI and was not captured in the committed run; treated as not-yet-machine-verified until a run with Edge present lands.',
  },
  Firefox: {
    tier: 'tier-2-manual',
    method: 'real-device; automatable via geckodriver ≥ 0.34 (WebDriver)',
    automatable: true,
    wired: false,
    note: 'Tier-1 path documented (geckodriver/Selenium); not wired this sprint.',
  },
  Safari: {
    tier: 'tier-2-manual',
    method: 'real-device; automatable via safaridriver allow-capability (WebDriver)',
    automatable: true,
    wired: false,
    note: 'Tier-1 path documented (safaridriver, macOS only); not wired this sprint.',
  },
};

const MOBILE_TIER: VerificationTier = {
  tier: 'tier-2-manual',
  method: 'real-device (no desktop virtual-authenticator path)',
  automatable: false,
  wired: false,
};

const UNKNOWN_TIER: VerificationTier = {
  tier: 'tier-2-manual',
  method: 'real-device (unclassified engine)',
  automatable: false,
  wired: false,
};

/** Resolve the verification tier for a (browser, os) matrix cell. Never ambiguous. */
export function tierFor(browser: string, os: string): VerificationTier {
  if (MOBILE_OS.has(os)) return MOBILE_TIER;
  return DESKTOP_TIERS[browser] ?? UNKNOWN_TIER;
}

/** The distinct browser names present in the matrix's BCD browser set. */
export const MATRIX_BROWSERS = Array.from(new Set(Object.values(BROWSER_OS).map((b) => b.browser)));
