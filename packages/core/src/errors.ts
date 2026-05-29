/**
 * The frozen taxonomy of error codes the SDK can throw. This union is
 * deliberately closed — every failure path maps to exactly one of these.
 */
export const KIT_ERROR_CODES = Object.freeze([
  'USER_CANCELLED',
  'ES256_NOT_SUPPORTED',
  'RP_ID_MISMATCH',
  'ORIGIN_MISMATCH',
  'CHALLENGE_MISMATCH',
  'INVALID_SIGNATURE_DER',
  'INVALID_PUBLIC_KEY',
  'CONTRACT_AUTH_FAILED',
  'NETWORK_ERROR',
  'UNSUPPORTED_AUTHENTICATOR',
] as const);

export type KitErrorCode = (typeof KIT_ERROR_CODES)[number];

/** Structured error carrying a machine-readable {@link KitErrorCode}. */
export class KitError extends Error {
  readonly code: KitErrorCode;
  override readonly name = 'KitError';

  constructor(code: KitErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.code = code;
    // Restore the prototype chain so `instanceof KitError` works after
    // down-level transpilation to CJS.
    Object.setPrototypeOf(this, KitError.prototype);
  }
}

export function isKitError(value: unknown): value is KitError {
  return value instanceof KitError;
}
