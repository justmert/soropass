import { p256 } from '@noble/curves/nist';
import { reconstructSignedPayload } from './payload';
import { derToCompact } from './signature';

export interface VerifyAssertionInput {
  /** SEC-1 uncompressed public key (65 bytes, `0x04 ‖ X ‖ Y`). */
  publicKey: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** DER-encoded (≤72 B) or already-compact (64 B) signature. */
  signature: Uint8Array;
}

/**
 * Verify a WebAuthn assertion the way the on-chain `secp256r1_verify` does:
 * reconstruct `SHA256(authData ‖ SHA256(cdj))` and check ECDSA. `lowS: false`
 * mirrors the host function, which does NOT enforce low-S (we normalize
 * separately before submitting — see S04/YK-430).
 */
export function verifyAssertionSignature(input: VerifyAssertionInput): boolean {
  const payload = reconstructSignedPayload(input);
  const compact = input.signature.length === 64 ? input.signature : derToCompact(input.signature);
  return p256.verify(compact, payload, input.publicKey, { lowS: false });
}
