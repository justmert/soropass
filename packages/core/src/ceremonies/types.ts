/** Normalized WebAuthn results + the pluggable dependencies the ceremonies use. */

export interface WebAuthnCreateResult {
  /** base64url credential id. */
  id: string;
  rawId: Uint8Array;
  attestationObject: Uint8Array;
}

export interface WebAuthnGetResult {
  id: string;
  rawId: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** DER signature as returned by the authenticator. */
  signature: Uint8Array;
}

export interface WebAuthnGetOptions {
  rpId: string;
  challenge?: Uint8Array;
  /** base64url credential ids; empty/omitted ⇒ discoverable (recover path). */
  allowCredentials?: string[];
  mediation?: 'silent' | 'optional' | 'conditional' | 'required';
  userVerification?: 'discouraged' | 'preferred' | 'required';
}

import type { PublicKeyCredentialCreationOptionsJSON } from '../webauthn/createOptions';

/** Abstraction over `navigator.credentials` so ceremonies are testable + isomorphic. */
export interface WebAuthnClient {
  create(options: PublicKeyCredentialCreationOptionsJSON): Promise<WebAuthnCreateResult>;
  get(options: WebAuthnGetOptions): Promise<WebAuthnGetResult>;
}

/** Per-rpId credential-id persistence (localStorage by default). */
export interface CredentialStorage {
  get(rpId: string): string | null;
  set(rpId: string, credentialId: string): void;
}

/**
 * Deploys a smart account for a freshly-created passkey via the factory (through
 * a SubmissionAdapter) and returns its C-address. Injected because the factory
 * wiring is contract-specific (kalepail webauthn-wallet / OZ) — provided by the
 * kit module (S17) / demo (S21); we don't reinvent the contract layer here.
 */
export interface AccountDeployer {
  deploy(input: { publicKey: Uint8Array; credentialId: string }): Promise<{
    contractId: string;
    txHash?: string;
  }>;
}
