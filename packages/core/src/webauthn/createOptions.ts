import { bytesToBase64Url } from '../internal/encoding';
import { utf8ToBytes } from '../internal/encoding';

export type ResidentKeyRequirement = 'discouraged' | 'preferred' | 'required';
export type UserVerificationRequirement = 'discouraged' | 'preferred' | 'required';

export interface BuildCreateOptionsInput {
  rpId: string;
  rpName: string;
  userName: string;
  /** Stable, opaque user handle. Defaults to UTF-8 bytes of `userName`. */
  userId?: Uint8Array;
  userDisplayName?: string;
  /** Raw challenge bytes (base64url-encoded into the options). */
  challenge: Uint8Array;
  residentKey?: ResidentKeyRequirement;
  userVerification?: UserVerificationRequirement;
  timeout?: number;
}

/** ES256-only credential parameter. The `alg: -7` literal is non-negotiable. */
export interface PubKeyCredParam {
  type: 'public-key';
  alg: -7;
}

export interface PublicKeyCredentialCreationOptionsJSON {
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: PubKeyCredParam[];
  authenticatorSelection: {
    residentKey: ResidentKeyRequirement;
    requireResidentKey: boolean;
    userVerification: UserVerificationRequirement;
  };
  attestation: 'none';
  timeout: number;
}

/**
 * Build WebAuthn registration options that offer ES256 *and only* ES256
 * (`pubKeyCredParams: [{ type: 'public-key', alg: -7 }]`) — invariant #1.
 * Soroban verifies only secp256r1, so we never advertise any other algorithm.
 */
export function buildCreateOptions(
  input: BuildCreateOptionsInput,
): PublicKeyCredentialCreationOptionsJSON {
  const residentKey = input.residentKey ?? 'required';
  return {
    rp: { id: input.rpId, name: input.rpName },
    user: {
      id: bytesToBase64Url(input.userId ?? utf8ToBytes(input.userName)),
      name: input.userName,
      displayName: input.userDisplayName ?? input.userName,
    },
    challenge: bytesToBase64Url(input.challenge),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: {
      residentKey,
      requireResidentKey: residentKey === 'required',
      userVerification: input.userVerification ?? 'preferred',
    },
    attestation: 'none',
    timeout: input.timeout ?? 60_000,
  };
}
