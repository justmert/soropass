/**
 * `@stellar-passkey/core/sign` — assertion-side primitives: DER→compact,
 * payload reconstruction, clientDataJSON/authData parsing and verification.
 * Soroban auth-entry assembly lands in S11 (YK-437).
 */
export { derToCompact, normalizeLowS, isLowS, derToCompactLowS } from './webauthn/signature';
export { reconstructSignedPayload } from './webauthn/payload';
export {
  parseClientDataJSON,
  verifyClientDataJSON,
  encodeChallenge,
  decodeChallenge,
} from './webauthn/clientData';
export { parseAuthenticatorData, verifyRpIdHash } from './webauthn/authData';
export { verifyAssertionSignature } from './webauthn/verify';
