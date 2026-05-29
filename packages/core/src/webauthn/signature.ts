import { p256 } from '@noble/curves/nist';
import { KitError } from '../errors';

/** Maximum DER length of a P-256 ECDSA signature: SEQ + two 33-byte INTEGERs. */
const MAX_DER_LENGTH = 72;

/**
 * Convert an ASN.1 DER ECDSA signature to the 64-byte raw `R‖S` form Soroban's
 * `secp256r1_verify` expects, using noble's audited DER parser (R and S are
 * left-padded to 32 bytes big-endian). Rejects malformed or over-long input.
 *
 * Note: this does NOT enforce low-S — that normalization is added in S04
 * (YK-430). The output here mirrors the signature exactly as parsed.
 */
export function derToCompact(der: Uint8Array): Uint8Array {
  if (der.length > MAX_DER_LENGTH) {
    throw new KitError(
      'INVALID_SIGNATURE_DER',
      `DER signature is ${der.length} bytes, exceeds max ${MAX_DER_LENGTH}`,
    );
  }
  try {
    return p256.Signature.fromDER(der).toCompactRawBytes();
  } catch (cause) {
    throw new KitError('INVALID_SIGNATURE_DER', 'failed to parse DER signature', { cause });
  }
}

function assertCompactLength(compactSignature: Uint8Array): void {
  if (compactSignature.length !== 64) {
    throw new KitError(
      'INVALID_SIGNATURE_DER',
      `compact signature must be 64 bytes, got ${compactSignature.length}`,
    );
  }
}

/** True if a 64-byte compact signature is in canonical low-S form (S ≤ n/2). */
export function isLowS(compactSignature: Uint8Array): boolean {
  assertCompactLength(compactSignature);
  return !p256.Signature.fromCompact(compactSignature).hasHighS();
}

/**
 * Normalize a 64-byte compact signature to canonical low-S: if S > n/2, replace
 * S with n − S (anchor LOW_S_NORMALIZATION, invariant #2). ~50% of Apple Touch
 * ID / Face ID assertions are high-S and Soroban's `secp256r1_verify` does not
 * enforce low-S, so the SDK MUST emit low-S before a signature reaches a
 * contract. Idempotent: low-S input is returned unchanged.
 */
export function normalizeLowS(compactSignature: Uint8Array): Uint8Array {
  assertCompactLength(compactSignature);
  return p256.Signature.fromCompact(compactSignature).normalizeS().toCompactRawBytes();
}

/** DER → 64-byte canonical low-S compact — the conversion the signing ceremony uses. */
export function derToCompactLowS(der: Uint8Array): Uint8Array {
  return normalizeLowS(derToCompact(der));
}
