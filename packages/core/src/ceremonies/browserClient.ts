import { KitError } from '../errors';
import { base64UrlToBytes } from '../internal/encoding';
import type { PublicKeyCredentialCreationOptionsJSON } from '../webauthn/createOptions';
import { randomBytes } from './random';
import type {
  CredentialStorage,
  WebAuthnClient,
  WebAuthnCreateResult,
  WebAuthnGetOptions,
  WebAuthnGetResult,
} from './types';

/**
 * Map a `navigator.credentials` rejection to a `KitError`. Dismissing the OS
 * passkey sheet rejects with a `NotAllowedError` (a DOMException) — surface that
 * as `USER_CANCELLED` so the UI shows the true "you cancelled" copy instead of
 * the generic unsupported-authenticator fallback (S20 / S04 polish).
 */
function asKitError(error: unknown): KitError {
  if (error instanceof KitError) return error;
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? (error as { name?: unknown }).name
      : undefined;
  if (name === 'NotAllowedError') {
    return new KitError('USER_CANCELLED', 'The passkey prompt was dismissed.');
  }
  const message = error instanceof Error ? error.message : 'WebAuthn request failed';
  return new KitError('UNSUPPORTED_AUTHENTICATOR', message);
}

/** The browser `WebAuthnClient` backed by `navigator.credentials`. */
export function browserWebAuthnClient(): WebAuthnClient {
  const credentials = (globalThis as { navigator?: Navigator }).navigator?.credentials;
  if (!credentials) {
    throw new KitError('UNSUPPORTED_AUTHENTICATOR', 'navigator.credentials is unavailable');
  }
  return {
    async create(options: PublicKeyCredentialCreationOptionsJSON): Promise<WebAuthnCreateResult> {
      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge: base64UrlToBytes(options.challenge),
        rp: options.rp,
        user: {
          id: base64UrlToBytes(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation,
        timeout: options.timeout,
      };
      let credential: PublicKeyCredential | null;
      try {
        credential = (await credentials.create({ publicKey })) as PublicKeyCredential | null;
      } catch (error) {
        throw asKitError(error);
      }
      if (!credential) throw new KitError('USER_CANCELLED', 'credential creation returned null');
      const response = credential.response as AuthenticatorAttestationResponse;
      return {
        id: credential.id,
        rawId: new Uint8Array(credential.rawId),
        attestationObject: new Uint8Array(response.attestationObject),
      };
    },
    async get(options: WebAuthnGetOptions): Promise<WebAuthnGetResult> {
      const publicKey: PublicKeyCredentialRequestOptions = {
        rpId: options.rpId,
        challenge: options.challenge ? new Uint8Array(options.challenge) : randomBytes(32),
        allowCredentials: (options.allowCredentials ?? []).map((id) => ({
          type: 'public-key',
          id: base64UrlToBytes(id),
        })),
        userVerification: options.userVerification,
      };
      const request: CredentialRequestOptions = { publicKey };
      if (options.mediation) request.mediation = options.mediation;
      let credential: PublicKeyCredential | null;
      try {
        credential = (await credentials.get(request)) as PublicKeyCredential | null;
      } catch (error) {
        throw asKitError(error);
      }
      if (!credential) throw new KitError('USER_CANCELLED', 'assertion returned null');
      const response = credential.response as AuthenticatorAssertionResponse;
      return {
        id: credential.id,
        rawId: new Uint8Array(credential.rawId),
        authenticatorData: new Uint8Array(response.authenticatorData),
        clientDataJSON: new Uint8Array(response.clientDataJSON),
        signature: new Uint8Array(response.signature),
      };
    },
  };
}

/** localStorage-backed credential store, with an in-memory fallback (Node/SSR). */
export function defaultCredentialStorage(): CredentialStorage {
  const key = (rpId: string): string => `stellar-passkey:${rpId}`;
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  if (ls) {
    return {
      get: (rpId) => ls.getItem(key(rpId)),
      set: (rpId, credentialId) => {
        ls.setItem(key(rpId), credentialId);
      },
    };
  }
  const memory = new Map<string, string>();
  return {
    get: (rpId) => memory.get(rpId) ?? null,
    set: (rpId, credentialId) => {
      memory.set(rpId, credentialId);
    },
  };
}
