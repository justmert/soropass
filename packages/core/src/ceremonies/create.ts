import { assertUserActivation } from '../anchors';
import { buildCreateOptions } from '../webauthn/createOptions';
import { extractPublicKeyFromAttestationObject } from '../webauthn/publicKey';
import type { PasskeyCredential } from '../types';
import { browserWebAuthnClient, defaultCredentialStorage } from './browserClient';
import { randomBytes } from './random';
import type { AccountDeployer, CredentialStorage, WebAuthnClient } from './types';

export interface CreatePasskeyOptions {
  rpId: string;
  rpName: string;
  userName: string;
  /** Deploys the smart account for the new passkey (contract-specific; see AccountDeployer). */
  deployer: AccountDeployer;
  webauthn?: WebAuthnClient;
  storage?: CredentialStorage;
  userId?: Uint8Array;
  challenge?: Uint8Array;
  residentKey?: 'discouraged' | 'preferred' | 'required';
  userVerification?: 'discouraged' | 'preferred' | 'required';
  /** Pass navigator.userActivation to enforce the Safari gesture requirement (S04). */
  userActivation?: { isActive: boolean };
}

/** Options for {@link registerPasskey} — a create WITHOUT deploy (see below). */
export type RegisterPasskeyOptions = Omit<CreatePasskeyOptions, 'deployer' | 'storage'>;

/** A freshly-registered passkey credential (no account deployed yet). */
export interface RegisteredPasskey {
  /** base64url credential id returned by the authenticator. */
  credentialId: string;
  /** SEC-1 uncompressed public key (65 bytes). */
  publicKey: Uint8Array;
}

/**
 * `registerPasskey` — register an ES256-only passkey and extract its SEC-1 public
 * key (RS256 hard-fails), but do NOT deploy an account or persist anything. This
 * is the "new device" primitive for multi-device recovery: a fresh device
 * produces a `{credentialId, publicKey}` signer spec that an existing device then
 * authorizes on-chain via `addSigner`. (`createPasskey` is this plus a deploy.)
 */
export async function registerPasskey(options: RegisterPasskeyOptions): Promise<RegisteredPasskey> {
  assertUserActivation(options.userActivation); // anchor: apple-user-gesture (S04)
  const webauthn = options.webauthn ?? browserWebAuthnClient();

  const creationOptions = buildCreateOptions({
    rpId: options.rpId,
    rpName: options.rpName,
    userName: options.userName,
    userId: options.userId,
    challenge: options.challenge ?? randomBytes(32),
    residentKey: options.residentKey,
    userVerification: options.userVerification,
  });

  const credential = await webauthn.create(creationOptions);
  // ES256-only enforcement happens here: a non-ES256 credential throws ES256_NOT_SUPPORTED.
  const publicKey = extractPublicKeyFromAttestationObject(credential.attestationObject);
  return { credentialId: credential.id, publicKey };
}

/**
 * `createPasskey` — register an ES256-only passkey (see {@link registerPasskey}),
 * deploy a smart account for it via the factory, persist the credential id, and
 * return the account.
 */
export async function createPasskey(options: CreatePasskeyOptions): Promise<PasskeyCredential> {
  const storage = options.storage ?? defaultCredentialStorage();
  const { credentialId, publicKey } = await registerPasskey(options);
  const { contractId } = await options.deployer.deploy({ publicKey, credentialId });
  storage.set(options.rpId, credentialId);
  return { contractId, credentialId, publicKey };
}
