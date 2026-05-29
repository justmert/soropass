import { sha256 } from '../internal/sha256';
import { concatBytes } from '../internal/bytes';

/**
 * Reconstruct the 32-byte payload the authenticator signed and that Soroban's
 * `__check_auth` re-derives on-chain:
 *
 *   SHA256( authenticatorData ‖ SHA256(clientDataJSON) )
 */
export function reconstructSignedPayload(input: {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
}): Uint8Array {
  const clientDataHash = sha256(input.clientDataJSON);
  return sha256(concatBytes(input.authenticatorData, clientDataHash));
}
