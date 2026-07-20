import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from './random';
import { isKitError } from '../errors';

describe('randomBytes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns crypto-random, non-zero, non-repeating bytes of the requested length', () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(a).toHaveLength(32);
    expect(a.every((x) => x === 0)).toBe(false);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('THROWS instead of silently returning all-zero bytes when no secure RNG exists', () => {
    vi.stubGlobal('crypto', undefined);
    try {
      randomBytes(32);
      throw new Error('expected randomBytes to throw');
    } catch (e) {
      expect(isKitError(e)).toBe(true);
      expect((e as { code: string }).code).toBe('UNSUPPORTED_AUTHENTICATOR');
    }
  });
});
