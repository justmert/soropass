import { base64UrlToBytes } from '../internal/encoding';
import type { AssertionResult, WebAuthnSigner } from '../soroban/sign';
import { browserWebAuthnClient } from './browserClient';
import type { WebAuthnClient } from './types';

export interface BrowserPasskeySignerOptions {
  /** The Relying Party ID (your site's registrable domain). */
  rpId: string;
  /**
   * Restrict the prompt to specific credential ids (base64url) — pass the
   * `credentialId` from `create` / `connect` so the OS offers the right passkey.
   * Omit (or leave empty) for a discoverable prompt over any resident passkey.
   */
  allowCredentials?: string[];
  userVerification?: 'discouraged' | 'preferred' | 'required';
  /** Inject a custom client (tests / non-browser). Defaults to `browserWebAuthnClient()`. */
  webauthn?: WebAuthnClient;
  /**
   * SEC-1 (65-byte) public key of this passkey (from `create` / `connect`).
   * WebAuthn assertions do not return the public key, so pass it here to sign
   * for the v0.2 single-signer account; it is echoed onto the `AssertionResult`.
   * You can instead supply it once via `SorobanSignOptions.publicKey`.
   */
  publicKey?: Uint8Array;
}

/**
 * Adapt `navigator.credentials.get` into the `WebAuthnSigner` that
 * `signTransaction` / `signAuthEntry` expect — so wiring a passkey is one line:
 *
 * ```ts
 * const sign = browserPasskeySigner({ rpId, allowCredentials: [credentialId] });
 * const signedXdr = await signTransaction(txXdr, { networkPassphrase, sign });
 * ```
 *
 * The SDK hands the signer a base64url challenge (the Soroban auth preimage);
 * this decodes it to the raw bytes WebAuthn signs over, runs the assertion, and
 * returns the fields the auth assembler needs. The DER signature is low-S
 * normalized downstream (invariant #2) — nothing here weakens that.
 */
export function browserPasskeySigner(options: BrowserPasskeySignerOptions): WebAuthnSigner {
  const webauthn = options.webauthn ?? browserWebAuthnClient();
  return async (challenge: string): Promise<AssertionResult> => {
    const assertion = await webauthn.get({
      rpId: options.rpId,
      challenge: base64UrlToBytes(challenge),
      allowCredentials: options.allowCredentials ?? [],
      // The v0.2 account requires the User-Verified flag, so default to
      // 'required'; a signature without UV fails on-chain.
      userVerification: options.userVerification ?? 'required',
    });
    return {
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      signature: assertion.signature,
      credentialId: assertion.rawId,
      publicKey: options.publicKey,
    };
  };
}
