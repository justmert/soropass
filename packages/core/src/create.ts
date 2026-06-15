/**
 * `@soropass/core/create` — the `createPasskey` ceremony plus the
 * registration-side primitives (ES256-only options, SEC-1 pubkey extraction).
 */
export { createPasskey } from './ceremonies/create';
export type { CreatePasskeyOptions } from './ceremonies/create';
export { browserWebAuthnClient, defaultCredentialStorage } from './ceremonies/browserClient';
export { buildCreateOptions } from './webauthn/createOptions';
export {
  extractPublicKeyFromAttestationObject,
  extractPublicKeyFromAuthData,
  coseKeyToSec1,
} from './webauthn/publicKey';
export { assertES256, assertUserActivation } from './anchors';
