import { p256 } from '@noble/curves/nist';
import { KitError } from '../errors';
import { concatBytes } from '../internal/bytes';
import { decodeCborFirst, type CborMap } from '../internal/cbor';
import { parseAuthenticatorData } from './authData';

// COSE key common parameters (RFC 9052) and EC2 key parameters.
const COSE_KTY = 1;
const COSE_ALG = 3;
const COSE_CRV = -1;
const COSE_X = -2;
const COSE_Y = -3;

const KTY_EC2 = 2;
const ALG_ES256 = -7;
const CRV_P256 = 1;

/**
 * Convert a CBOR-encoded COSE EC2 public key to the 65-byte SEC-1 uncompressed
 * point `0x04 ‖ X ‖ Y`. Enforces ES256/P-256 — anything else (e.g. RS256)
 * throws `ES256_NOT_SUPPORTED` (invariant #1).
 */
export function coseKeyToSec1(coseKey: Uint8Array): Uint8Array {
  let decoded: ReturnType<typeof decodeCborFirst>;
  try {
    decoded = decodeCborFirst(coseKey);
  } catch (cause) {
    throw new KitError('INVALID_PUBLIC_KEY', 'failed to CBOR-decode COSE key', { cause });
  }
  if (!(decoded instanceof Map)) {
    throw new KitError('INVALID_PUBLIC_KEY', 'COSE key is not a CBOR map');
  }
  const map = decoded as CborMap;
  const alg = map.get(COSE_ALG);
  if (alg !== ALG_ES256) {
    throw new KitError('ES256_NOT_SUPPORTED', `COSE alg ${String(alg)} is not ES256 (-7)`);
  }
  if (map.get(COSE_KTY) !== KTY_EC2) {
    throw new KitError(
      'INVALID_PUBLIC_KEY',
      `COSE kty ${String(map.get(COSE_KTY))} is not EC2 (2)`,
    );
  }
  if (map.get(COSE_CRV) !== CRV_P256) {
    throw new KitError(
      'INVALID_PUBLIC_KEY',
      `COSE crv ${String(map.get(COSE_CRV))} is not P-256 (1)`,
    );
  }
  const x = map.get(COSE_X);
  const y = map.get(COSE_Y);
  if (!(x instanceof Uint8Array) || x.length !== 32) {
    throw new KitError('INVALID_PUBLIC_KEY', 'COSE key X coordinate is not 32 bytes');
  }
  if (!(y instanceof Uint8Array) || y.length !== 32) {
    throw new KitError('INVALID_PUBLIC_KEY', 'COSE key Y coordinate is not 32 bytes');
  }
  const sec1 = concatBytes(new Uint8Array([0x04]), x, y);
  // Reject off-curve / invalid points so an invalid key can never be persisted.
  try {
    p256.Point.fromHex(sec1);
  } catch (cause) {
    throw new KitError('INVALID_PUBLIC_KEY', 'public key is not a valid P-256 point', { cause });
  }
  return sec1;
}

/** Extract the SEC-1 public key from raw authenticatorData (attested data). */
export function extractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array {
  const parsed = parseAuthenticatorData(authData);
  if (!parsed.credentialPublicKey) {
    throw new KitError(
      'INVALID_PUBLIC_KEY',
      'authenticatorData has no attested credential public key',
    );
  }
  return coseKeyToSec1(parsed.credentialPublicKey);
}

/** Extract the SEC-1 public key from a CBOR attestationObject (create ceremony). */
export function extractPublicKeyFromAttestationObject(attestationObject: Uint8Array): Uint8Array {
  let decoded: ReturnType<typeof decodeCborFirst>;
  try {
    decoded = decodeCborFirst(attestationObject);
  } catch (cause) {
    throw new KitError('INVALID_PUBLIC_KEY', 'failed to CBOR-decode attestationObject', { cause });
  }
  if (!(decoded instanceof Map)) {
    throw new KitError('INVALID_PUBLIC_KEY', 'attestationObject is not a CBOR map');
  }
  const authData = (decoded as CborMap).get('authData');
  if (!(authData instanceof Uint8Array)) {
    throw new KitError('INVALID_PUBLIC_KEY', 'attestationObject has no authData byte string');
  }
  return extractPublicKeyFromAuthData(authData);
}
