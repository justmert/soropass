/**
 * `@stellar-passkey/core/connect` — the `connect` ceremony (credentialId →
 * smart-account C-address). Implemented in S13 (YK-439) once the indexer
 * adapter (S12) and Soroban auth assembly (S11) land. The types here pin the
 * planned public shape.
 */
import type { PasskeyCredential } from './types';

export interface ConnectOptions {
  rpId: string;
  /** base64url credential id; if omitted, a discoverable-credential get is used. */
  credentialId?: string;
}

export type ConnectResult = PasskeyCredential;

export function connect(_options: ConnectOptions): Promise<ConnectResult> {
  throw new Error('connect() is implemented in S13 (YK-439).');
}
