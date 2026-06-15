/**
 * Browser polyfills for @stellar/stellar-sdk (which expects Node `Buffer` /
 * `process`). Imported FIRST in the on-chain entry so the globals exist before
 * stellar-sdk evaluates. `global` is handled by Vite `define`.
 */
import { Buffer } from 'buffer';

const g = globalThis as unknown as Record<string, unknown>;
if (!g.Buffer) g.Buffer = Buffer;
if (!g.process) {
  g.process = {
    env: {},
    browser: true,
    version: '',
    nextTick: (cb: () => void) => setTimeout(cb, 0),
  };
}
