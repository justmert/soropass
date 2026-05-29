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

/**
 * `createPasskey` — register an ES256-only passkey, extract its SEC-1 public key
 * (RS256 hard-fails), deploy a smart account via the factory, persist the
 * credential id, and return the account.
 */
export async function createPasskey(options: CreatePasskeyOptions): Promise<PasskeyCredential> {
  assertUserActivation(options.userActivation); // anchor: apple-user-gesture (S04)
  const webauthn = options.webauthn ?? browserWebAuthnClient();
  const storage = options.storage ?? defaultCredentialStorage();

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
  const { contractId } = await options.deployer.deploy({
    publicKey,
    credentialId: credential.id,
  });
  storage.set(options.rpId, credential.id);
  return { contractId, credentialId: credential.id, publicKey };
}
