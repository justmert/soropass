/**
 * `@stellar-passkey/core/types` — the shared type surface + error taxonomy.
 */
export { KitError, isKitError, KIT_ERROR_CODES } from './errors';
export type { KitErrorCode } from './errors';
export { BATTLE_TESTED_ANCHORS } from './anchors';
export type { BattleTestedAnchor } from './anchors';

export type { ClientData } from './webauthn/clientData';
export type { ParsedAuthenticatorData, AuthenticatorDataFlags } from './webauthn/authData';
export type {
  BuildCreateOptionsInput,
  PublicKeyCredentialCreationOptionsJSON,
  PubKeyCredParam,
  ResidentKeyRequirement,
  UserVerificationRequirement,
} from './webauthn/createOptions';
export type { VerifyAssertionInput } from './webauthn/verify';
export type { AssertionResult, WebAuthnSigner, SorobanSignOptions } from './soroban/sign';
export type { AssembledSignature } from './soroban/assemble';
export type { CheckAuthResult } from './soroban/checkAuth';
export type {
  SubmissionAdapter,
  IndexerAdapter,
  SubmitResult,
  ResolvedAccount,
} from './adapters/types';

/** A passkey-backed Stellar smart account (populated by the S13 ceremonies). */
export interface PasskeyCredential {
  /** Soroban contract (C…) address of the smart account. */
  contractId: string;
  /** base64url credential id returned by the authenticator. */
  credentialId: string;
  /** SEC-1 uncompressed public key (65 bytes). */
  publicKey: Uint8Array;
}
