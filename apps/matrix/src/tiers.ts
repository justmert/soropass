/**
 * Verification tiers. NOTE: the ACTUAL per-cell tier in the published matrix is
 * derived from the cell's real source at merge time (`pipeline.ts` →
 * `tierForSource`): a cell is `tier-1-automated` only when it was machine-
 * verified this run (`ci`/`live`), never by static assumption. This module
 * documents the automation FEASIBILITY per engine (method / automatable /
 * wired) for the architecture narrative — see `docs/matrix/automation-coverage.md`.
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
    method: 'Chromium/Blink — the Chrome CDP virtual-authenticator path applies (Playwright)',
    automatable: true,
    wired: true,
    note: 'Edge shares Chrome’s Blink+CDP engine, so the same virtual-authenticator harness runs it. msedge install is best-effort in CI: when the runner has it, Edge cells are machine-verified (source ci → tier-1); otherwise they fall back to BCD (tier-2). The tier reflects what actually happened on the run, not an assumption.',
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
