/**
 * `@soropass/core/sign` — assertion-side primitives: DER→compact,
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

// One-line browser passkey signer for `signTransaction` / `signAuthEntry`.
export { browserPasskeySigner } from './ceremonies/browserSigner';
export type { BrowserPasskeySignerOptions } from './ceremonies/browserSigner';

// Soroban auth assembly (S11): sign a tx or a bare auth entry → SorobanAuthorizationEntry.
export { signAuthEntry, signTransaction } from './soroban/sign';
export type { SorobanSignOptions, SignVerifyOptions, WalletTarget } from './soroban/sign';
export { authEntryChallenge, authEntryChallengeBytes } from './soroban/preimage';
export { applyAssertionToEntry } from './soroban/assemble';
// Smart-wallet ABI target (passkey-kit `Signatures(Map<SignerKey, Signature>)`) — issue #32.
export {
  applyAssertionToSmartWalletEntry,
  buildSignerKeyScVal,
  buildSmartWalletSignatureVariant,
  compareSignerKeyScVal,
} from './soroban/smartWallet';
export { referenceCheckAuth, referenceSmartWalletCheckAuth } from './soroban/checkAuth';
export type { SmartWalletCheckAuthResult } from './soroban/checkAuth';
