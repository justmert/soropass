/**
 * Real captured WebAuthn fixtures used by the crypto tests + the validation
 * gate. The assertion + COSE public key are a genuine P-256 `webauthn.get`
 * response lifted from SimpleWebAuthn's test suite (MIT-licensed):
 *   references/SimpleWebAuthn/packages/server/src/authentication/
 *     verifyAuthenticationResponse.test.ts
 * The registration `attestationObject` (none attestation) is from passkey-kit's
 * test vectors:
 *   references/passkey-kit/bun_tests/2.index.ts
 *
 * The EXPECTED_* hex values are hand-computed once (see the YK-429 commit notes)
 * and pinned here so the tests assert against fixed values, not recomputations.
 */
import { base64UrlToBytes } from '../internal/encoding';

// --- real P-256 assertion (origin https://dev.dontneeda.pw) ---
export const ASSERTION = {
  authenticatorData: base64UrlToBytes('PdxHEOnAiLIp26idVjIguzn3Ipr_RlsKZWsa-5qK-KABAAAAkA'),
  clientDataJSON: base64UrlToBytes(
    'eyJjaGFsbGVuZ2UiOiJkRzkwWVd4c2VWVnVhWEYxWlZaaGJIVmxSWFpsY25sVWFXMWwiLCJjbGllbnRFeHRlbnNpb25zIjp7fSwiaGFzaEFsZ29yaXRobSI6IlNIQS0yNTYiLCJvcmlnaW4iOiJodHRwczovL2Rldi5kb250bmVlZGEucHciLCJ0eXBlIjoid2ViYXV0aG4uZ2V0In0',
  ),
  /** DER-encoded ECDSA signature (71 bytes, low-S). */
  signatureDer: base64UrlToBytes(
    'MEUCIQDYXBOpCWSWq2Ll4558GJKD2RoWg958lvJSB_GdeokxogIgWuEVQ7ee6AswQY0OsuQ6y8Ks6jhd45bDx92wjXKs900',
  ),
  /** CBOR-encoded COSE EC2 public key. */
  coseKey: base64UrlToBytes(
    'pQECAyYgASFYIIheFp-u6GvFT2LNGovf3ZrT0iFVBsA_76rRysxRG9A1Ilgg8WGeA6hPmnab0HAViUYVRkwTNcN77QBf_RR0dv3lIvQ',
  ),
  rpId: 'dev.dontneeda.pw',
  origin: 'https://dev.dontneeda.pw',
  /** base64url challenge embedded in clientDataJSON (= "totallyUniqueValueEveryTime"). */
  challenge: 'dG90YWxseVVuaXF1ZVZhbHVlRXZlcnlUaW1l',
} as const;

// --- registration attestationObject (fmt: none), passkey-kit ---
export const ATTESTATION_OBJECT = base64UrlToBytes(
  'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjESZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NBAAAABAAAAAAAAAAAAAAAAAAAAAAAQA8EYfqizPJVk0HtwVdqazrXmAyb7tuHDD7PzBmf6gFOyCngKjd1RCTIQHCpS3SMyeYULBg7Ykx6n1usOd5PlSilAQIDJiABIVggIWhAQyE5H-_9WM__87tYZq3yJPQ0rostof00z3MMSMoiWCCG3SuBh2TaTUHQDwd4CHyArPQ4EhKoScPbq0zxm1k_Dw',
);

// --- hand-computed expected values (hex) ---
export const EXPECTED = {
  /** SHA256(authData ‖ SHA256(clientDataJSON)). */
  payloadHex: '5090551651fdef7652709d3dcc5dc32f4141eae1e5f5b27871a9d2cc46e5874f',
  /** derToCompact(signatureDer) — 64-byte R‖S. */
  compactSigHex:
    'd85c13a9096496ab62e5e39e7c189283d91a1683de7c96f25207f19d7a8931a25ae11543b79ee80b30418d0eb2e43acbc2acea385de396c3c7ddb08d72acf74d',
  /** SEC-1 public key from ASSERTION.coseKey. */
  sec1PubKeyHex:
    '04885e169faee86bc54f62cd1a8bdfdd9ad3d2215506c03fefaad1cacc511bd035f1619e03a84f9a769bd07015894615464c1335c37bed005ffd147476fde522f4',
  /** SEC-1 public key extracted from ATTESTATION_OBJECT. */
  attestationSec1Hex:
    '042168404321391feffd58cffff3bb5866adf224f434ae8b2da1fd34cf730c48ca86dd2b818764da4d41d00f0778087c80acf4381212a849c3dbab4cf19b593f0f',
  /** A high-S malleable variant of compactSigHex (same R, S' = n − S). */
  highSCompactSigHex:
    'd85c13a9096496ab62e5e39e7c189283d91a1683de7c96f25207f19d7a8931a2a51eeabb486117f5cfbe72f14d1bc533fa3a1075493407c12bdc1a3589b62e04',
} as const;
