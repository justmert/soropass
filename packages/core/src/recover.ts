/**
 * `@stellar-passkey/core/recover` — the `recover` ceremony (add a new passkey
 * signer to an existing smart account). Implemented in S13 (YK-439).
 */
export interface RecoverOptions {
  rpId: string;
  contractId: string;
}

export interface RecoverResult {
  contractId: string;
  /** base64url credential id of the newly added signer. */
  credentialId: string;
  publicKey: Uint8Array;
}

export function recover(_options: RecoverOptions): Promise<RecoverResult> {
  throw new Error('recover() is implemented in S13 (YK-439).');
}
