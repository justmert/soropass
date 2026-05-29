import { assertUserActivation } from '../anchors';
import type { IndexerAdapter } from '../adapters/types';
import { browserWebAuthnClient } from './browserClient';
import { randomBytes } from './random';
import type { WebAuthnClient } from './types';

export interface RecoverOptions {
  rpId: string;
  indexer: IndexerAdapter;
  webauthn?: WebAuthnClient;
  challenge?: Uint8Array;
  userActivation?: { isActive: boolean };
}

export interface RecoverResult {
  contractId: string;
  credentialId: string;
}

/**
 * `recover` — the lost-localStorage / new-device path. Performs a
 * discoverable-credential `get()` (no allowCredentials), then resolves every
 * smart account controlled by that credential via the IndexerAdapter.
 */
export async function recover(options: RecoverOptions): Promise<RecoverResult[]> {
  assertUserActivation(options.userActivation); // anchor: apple-user-gesture (S04)
  const webauthn = options.webauthn ?? browserWebAuthnClient();
  const assertion = await webauthn.get({
    rpId: options.rpId,
    allowCredentials: [],
    challenge: options.challenge ?? randomBytes(32),
  });
  const accounts = await options.indexer.resolveByCredential(assertion.id);
  return accounts.map((account) => ({
    contractId: account.contractId,
    credentialId: assertion.id,
  }));
}
