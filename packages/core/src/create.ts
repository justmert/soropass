/**
 * `@stellar-passkey/core/create` — registration-side primitives: ES256-only
 * creation options and SEC-1 public-key extraction. The full `createPasskey`
 * ceremony (deploy + connect) lands in S13 (YK-439).
 */
export { buildCreateOptions } from './webauthn/createOptions';
export {
  extractPublicKeyFromAttestationObject,
  extractPublicKeyFromAuthData,
  coseKeyToSec1,
} from './webauthn/publicKey';
export { assertES256, assertUserActivation } from './anchors';
