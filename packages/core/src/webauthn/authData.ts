import { KitError } from '../errors';
import { decodeCbor } from '../internal/cbor';
import { sha256 } from '../internal/sha256';
import { equalBytes } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';

export interface AuthenticatorDataFlags {
  /** User Present */
  up: boolean;
  /** User Verified */
  uv: boolean;
  /** Backup Eligible */
  be: boolean;
  /** Backup State */
  bs: boolean;
  /** Attested credential data present */
  at: boolean;
  /** Extension data present */
  ed: boolean;
  /** Raw flags byte. */
  bits: number;
}

export interface ParsedAuthenticatorData {
  rpIdHash: Uint8Array;
  flags: AuthenticatorDataFlags;
  signCount: number;
  aaguid?: Uint8Array;
  credentialId?: Uint8Array;
  /** Raw CBOR-encoded COSE public key (exact bytes), if attested data present. */
  credentialPublicKey?: Uint8Array;
}

const MIN_LENGTH = 37; // rpIdHash(32) + flags(1) + signCount(4)

/** Parse the authenticatorData byte structure (WebAuthn §6.1). */
export function parseAuthenticatorData(authData: Uint8Array): ParsedAuthenticatorData {
  if (authData.length < MIN_LENGTH) {
    throw new KitError(
      'UNSUPPORTED_AUTHENTICATOR',
      `authenticatorData is ${authData.length} bytes, expected at least ${MIN_LENGTH}`,
    );
  }
  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
  const rpIdHash = authData.slice(0, 32);
  const bits = authData[32] ?? 0;
  const flags: AuthenticatorDataFlags = {
    up: (bits & 0x01) !== 0,
    uv: (bits & 0x04) !== 0,
    be: (bits & 0x08) !== 0,
    bs: (bits & 0x10) !== 0,
    at: (bits & 0x40) !== 0,
    ed: (bits & 0x80) !== 0,
    bits,
  };
  const signCount = view.getUint32(33, false);

  const result: ParsedAuthenticatorData = { rpIdHash, flags, signCount };

  if (flags.at) {
    if (authData.length < 55) {
      throw new KitError(
        'UNSUPPORTED_AUTHENTICATOR',
        'authenticatorData truncated in attested data',
      );
    }
    result.aaguid = authData.slice(37, 53);
    const credIdLength = view.getUint16(53, false);
    const credIdEnd = 55 + credIdLength;
    if (authData.length < credIdEnd) {
      throw new KitError(
        'UNSUPPORTED_AUTHENTICATOR',
        'authenticatorData truncated in credentialId',
      );
    }
    result.credentialId = authData.slice(55, credIdEnd);
    // The COSE public key is the next CBOR item; capture its exact bytes so we
    // stop cleanly before any extension data (when flags.ed is set).
    const rest = authData.slice(credIdEnd);
    const { length } = decodeCbor(rest, 0);
    result.credentialPublicKey = rest.slice(0, length);
  }

  return result;
}

/** Verify that authenticatorData's rpIdHash equals SHA-256(rpId). */
export function verifyRpIdHash(authData: Uint8Array, rpId: string): void {
  const actual = parseAuthenticatorData(authData).rpIdHash;
  const expected = sha256(utf8ToBytes(rpId));
  if (!equalBytes(actual, expected)) {
    throw new KitError(
      'RP_ID_MISMATCH',
      `authenticatorData rpIdHash does not match SHA-256("${rpId}")`,
    );
  }
}
