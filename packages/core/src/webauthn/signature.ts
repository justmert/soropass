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
