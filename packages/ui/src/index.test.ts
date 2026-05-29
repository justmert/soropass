import { describe, expect, it } from 'vitest';
import { UI_VERSION } from './index';

describe('@stellar-passkey/ui', () => {
  it('exposes a version string', () => {
    expect(UI_VERSION).toBe('0.0.0');
  });
});
