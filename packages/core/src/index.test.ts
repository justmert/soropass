import { describe, expect, it } from 'vitest';
import { SDK_VERSION } from './index';

describe('@stellar-passkey/core', () => {
  it('exposes a version string', () => {
    expect(SDK_VERSION).toBe('0.0.0');
  });
});
