import { describe, expect, it } from 'vitest';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '@noble/hashes/sha256';
import { verifyAssertionSignature } from './verify';
import { derToCompactLowS, isLowS } from './signature';
import { concatBytes } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';

/**
 * Cross-check the SDK's low-S secp256r1 assertion against a completely
 * independent ECDSA implementation — the platform's WebCrypto (`crypto.subtle`,
 * which is Node's/BoringSSL's, not @noble). If both our verifier and WebCrypto
 * accept the same low-S signature over the same WebAuthn digest, the field
 * packing + low-S normalization are interoperable, not noble-specific.
 */
/** Copy into a fresh ArrayBuffer-backed view so it satisfies WebCrypto's BufferSource. */
const ab = (u: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(u);

const PRIV = new Uint8Array(32).fill(7);
const PUB = p256.getPublicKey(PRIV, false); // 65-byte SEC-1 uncompressed

const authenticatorData = concatBytes(
  sha256(utf8ToBytes('localhost')),
  new Uint8Array([0x05]), // UP | UV
  new Uint8Array([0, 0, 0, 1]),
);
const clientDataJSON = utf8ToBytes(
  JSON.stringify({ type: 'webauthn.get', challenge: 'abc', origin: 'https://localhost' }),
);
// The WebAuthn signed digest: SHA256(authData ‖ SHA256(clientDataJSON)).
const digest = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
const der = p256.sign(digest, PRIV).toDERRawBytes();
const compactLowS = derToCompactLowS(der);

describe('secp256r1 interop cross-check (WebCrypto vs SDK)', () => {
  it('the SDK normalizes to low-S', () => {
    expect(isLowS(compactLowS)).toBe(true);
  });

  it('the SDK verifier (noble) accepts the low-S assertion', () => {
    expect(
      verifyAssertionSignature({
        publicKey: PUB,
        authenticatorData,
        clientDataJSON,
        signature: compactLowS,
      }),
    ).toBe(true);
  });

  it('Node/WebCrypto ECDSA independently verifies the SAME low-S signature', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      ab(PUB),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    // WebCrypto applies SHA-256 itself, so pass the pre-image (authData ‖ SHA256(cdj))
    // and the raw r‖s (P1363) signature — exactly our compact 64-byte form.
    const message = concatBytes(authenticatorData, sha256(clientDataJSON));
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      ab(compactLowS),
      ab(message),
    );
    expect(ok).toBe(true);
  });

  it('WebCrypto rejects the signature under a tampered digest', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      ab(PUB),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const tampered = concatBytes(authenticatorData, sha256(utf8ToBytes('different')));
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      ab(compactLowS),
      ab(tampered),
    );
    expect(ok).toBe(false);
  });
});
