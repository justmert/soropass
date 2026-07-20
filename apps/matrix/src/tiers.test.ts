import { describe, expect, it } from 'vitest';
import { BROWSER_OS } from './matrixSchema';
import { tierFor } from './tiers';

const TIERS = new Set(['tier-1-automated', 'tier-2-manual']);

describe('verification tiers (S08)', () => {
  it('GATE: every (browser, os) in the matrix resolves to a defined, valid tier', () => {
    for (const { browser, os } of Object.values(BROWSER_OS)) {
      const t = tierFor(browser, os);
      expect(TIERS.has(t.tier)).toBe(true);
      expect(t.method.length).toBeGreaterThan(0);
    }
  });

  it('Chromium desktop and Edge share the same wired CDP virtual-authenticator harness', () => {
    expect(tierFor('Chrome', 'desktop').automatable).toBe(true);
    expect(tierFor('Chrome', 'desktop').wired).toBe(true);
    // Edge is Chromium/Blink and runs on the same harness; whether a given run
    // machine-verifies it depends on msedge being present on the runner. The
    // actual per-cell tier is source-derived at merge (pipeline.tierForSource),
    // not asserted here.
    expect(tierFor('Edge', 'Windows').automatable).toBe(true);
    expect(tierFor('Edge', 'Windows').wired).toBe(true);
  });

  it('Firefox/Safari desktop are Tier-2 now but flagged automatable', () => {
    expect(tierFor('Firefox', 'desktop').tier).toBe('tier-2-manual');
    expect(tierFor('Firefox', 'desktop').automatable).toBe(true);
    expect(tierFor('Safari', 'macOS').automatable).toBe(true);
    expect(tierFor('Safari', 'macOS').wired).toBe(false);
  });

  it('mobile cells are Tier-2 real-device regardless of engine', () => {
    expect(tierFor('Chrome', 'Android').tier).toBe('tier-2-manual');
    expect(tierFor('Safari', 'iOS').tier).toBe('tier-2-manual');
    expect(tierFor('Safari', 'iOS').automatable).toBe(false);
  });
});
