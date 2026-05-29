import { p256 } from '@noble/curves/nist';
import { sha256 } from '../internal/sha256';
import { concatBytes } from '../internal/bytes';
import { bytesToBase64Url, utf8ToBytes } from '../internal/encoding';
import { encodeCbor } from '../internal/cborEncode';
import type { CborValue } from '../internal/cbor';
import type {
  WebAuthnClient,
  WebAuthnCreateResult,
  WebAuthnGetOptions,
  WebAuthnGetResult,
} from '../ceremonies/types';
import type { AssertionResult } from '../soroban/sign';

export interface MockAuthenticatorOptions {
  rpId: string;
  origin?: string;
  /** Deterministic seed → keypair + credentialId. */
  seed?: string;
  /** Emit high-S signatures, to exercise the perpetual low-S guard (S04). */
  forceHighS?: boolean;
}

export interface MockAuthenticator extends WebAuthnClient {
  readonly publicKey: Uint8Array; // 65-byte SEC-1
  readonly credentialId: string; // base64url
  readonly privateKey: Uint8Array;
  /** WebAuthnSigner for the Soroban sign path (challenge already base64url). */
  sign(challenge: string): AssertionResult;
}

function deriveScalar(seed: string): Uint8Array {
  const n = p256.CURVE.n;
  let scalar = BigInt('0x' + bytesToHexLocal(sha256(utf8ToBytes('priv:' + seed)))) % n;
  if (scalar === 0n) scalar = 1n;
  const hex = scalar.toString(16).padStart(64, '0');
  return Uint8Array.from((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));
}
function bytesToHexLocal(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * A deterministic, in-memory WebAuthn authenticator for the mock kit (S15). It
 * synthesizes a REAL attestationObject / COSE key (so `createPasskey` runs the
 * exact production extraction path) and signs assertions with the same P-256
 * key — optionally as high-S to prove the low-S normalization guard.
 */
export function mockAuthenticator(options: MockAuthenticatorOptions): MockAuthenticator {
  const seed = options.seed ?? 'mock-authenticator';
  const origin = options.origin ?? `https://${options.rpId}`;
  const privateKey = deriveScalar(seed);
  const publicKey = p256.getPublicKey(privateKey, false); // 0x04 ‖ X ‖ Y
  const x = publicKey.slice(1, 33);
  const y = publicKey.slice(33, 65);
  const credIdBytes = sha256(utf8ToBytes('cred:' + seed)).slice(0, 16);
  const credentialId = bytesToBase64Url(credIdBytes);
  const rpIdHash = sha256(utf8ToBytes(options.rpId));

  const coseKey = encodeCbor(
    new Map<number | string, CborValue>([
      [1, 2], // kty EC2
      [3, -7], // alg ES256
      [-1, 1], // crv P-256
      [-2, x],
      [-3, y],
    ]),
  );

  const attestedAuthData = concatBytes(
    rpIdHash,
    new Uint8Array([0x45]), // UP | UV | AT
    new Uint8Array([0, 0, 0, 0]), // signCount
    new Uint8Array(16), // aaguid
    new Uint8Array([0, credIdBytes.length]),
    credIdBytes,
    coseKey,
  );
  const attestationObject = encodeCbor(
    new Map<number | string, CborValue>([
      ['fmt', 'none'],
      ['attStmt', new Map<number | string, CborValue>()],
      ['authData', attestedAuthData],
    ]),
  );

  function signAssertion(challengeB64: string): {
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    signatureDer: Uint8Array;
  } {
    const authenticatorData = concatBytes(
      rpIdHash,
      new Uint8Array([0x05]),
      new Uint8Array([0, 0, 0, 1]),
    );
    const clientDataJSON = utf8ToBytes(
      JSON.stringify({ type: 'webauthn.get', challenge: challengeB64, origin }),
    );
    const payload = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
    const sig = p256.sign(payload, privateKey); // low-S by default
    const s = options.forceHighS ? p256.CURVE.n - sig.s : sig.s;
    const signatureDer = new p256.Signature(sig.r, s).toDERRawBytes();
    return { authenticatorData, clientDataJSON, signatureDer };
  }

  return {
    publicKey,
    credentialId,
    privateKey,
    create(): Promise<WebAuthnCreateResult> {
      return Promise.resolve({ id: credentialId, rawId: credIdBytes, attestationObject });
    },
    get(getOptions: WebAuthnGetOptions): Promise<WebAuthnGetResult> {
      const challengeB64 = getOptions.challenge ? bytesToBase64Url(getOptions.challenge) : 'mock';
      const a = signAssertion(challengeB64);
      return Promise.resolve({
        id: credentialId,
        rawId: credIdBytes,
        authenticatorData: a.authenticatorData,
        clientDataJSON: a.clientDataJSON,
        signature: a.signatureDer,
      });
    },
    sign(challenge: string): AssertionResult {
      const a = signAssertion(challenge);
      return {
        authenticatorData: a.authenticatorData,
        clientDataJSON: a.clientDataJSON,
        signature: a.signatureDer,
        credentialId: credIdBytes,
      };
    },
  };
}
