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

  it('desktop Chromium/Edge are Tier-1 automated and wired', () => {
    expect(tierFor('Chrome', 'desktop').tier).toBe('tier-1-automated');
    expect(tierFor('Chrome', 'desktop').wired).toBe(true);
    expect(tierFor('Edge', 'Windows').tier).toBe('tier-1-automated');
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
