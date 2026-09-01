import { xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '../internal/sha256';
import { bytesToHex, concatBytes } from '../internal/bytes';
import { bytesToBase64Url, bytesToUtf8 } from '../internal/encoding';
import { authEntryChallengeBytes } from './preimage';
import { addressCredentials, scBytes, scMap, scSymbol, scVec } from './scval';

export interface CheckAuthResult {
  success: boolean;
  /** clientDataJSON.challenge === base64url(preimage hash). */
  challengeBound: boolean;
  /** secp256r1_verify over SHA256(authData ‖ SHA256(cdj)) passed. */
  signatureValid: boolean;
  reason?: string;
}

function fail(reason: string): CheckAuthResult {
  return { success: false, challengeBound: false, signatureValid: false, reason };
}

/**
 * Verify a bare `Secp256r1Signature` ScMap ({ authenticator_data,
 * client_data_json, signature }) against a public key + the expected signature
 * payload. Shared by the single-signer and smart-wallet reference verifiers.
 */
function verifySecp256r1StructMap(
  structMap: xdr.ScMapEntry[],
  publicKey: Uint8Array,
  signaturePayload: Uint8Array,
): { ok: boolean; challengeBound: boolean; signatureValid: boolean; reason?: string } {
  const field = (name: string): Uint8Array | undefined => {
    const e = structMap.find((x) => scSymbol(x.key) === name);
    return e ? scBytes(e.val) : undefined;
  };
  const authenticatorData = field('authenticator_data');
  const clientDataJSON = field('client_data_json');
  const signature = field('signature');
  if (!authenticatorData || !clientDataJSON || !signature) {
    return { ok: false, challengeBound: false, signatureValid: false, reason: 'missing fields' };
  }
  if (signature.length !== 64) {
    return {
      ok: false,
      challengeBound: false,
      signatureValid: false,
      reason: 'not 64-byte compact',
    };
  }
  let challengeBound = false;
  try {
    const cdj = JSON.parse(bytesToUtf8(clientDataJSON)) as { challenge?: string };
    challengeBound = cdj.challenge === bytesToBase64Url(signaturePayload);
  } catch {
    challengeBound = false;
  }
  // Host fn semantics: the Soroban secp256r1 host REQUIRES low-S. It rejects a
  // high-S signature at decode, so the reference model must too (lowS:true).
  // Modeling it as lowS:false would accept signatures the chain rejects and
  // could mask a missing client-side normalization in a signer path.
  const digest = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
  const signatureValid = p256.verify(signature, digest, publicKey, {
    lowS: true,
    format: 'compact',
  });
  return { ok: challengeBound && signatureValid, challengeBound, signatureValid };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * A faithful JavaScript model of the on-chain v0.2 `__check_auth`
 * (`contracts/webauthn-account`): read the inline `public_key`, require it to be
 * an enrolled signer (here, equal to `publicKey`), reconstruct
 * `SHA256(authenticator_data ‖ SHA256(client_data_json))`, run `secp256r1_verify`
 * (which REQUIRES low-S and rejects high-S at decode, so the model verifies with
 * lowS:true — the client-side normalization is what makes real assertions pass),
 * and assert challenge-binding (`clientDataJSON.challenge ===
 * base64url(signature_payload)`). Lets us prove the assembly without a live
 * Soroban RPC; the real on-chain run is exercised by the kit integration and the
 * demo. A 3-field struct with no inline key still verifies against `publicKey`
 * for back-compat with the smart-wallet reference.
 */
export function referenceCheckAuth(
  entry: xdr.SorobanAuthorizationEntry,
  publicKey: Uint8Array,
  networkPassphrase: string,
): CheckAuthResult {
  const credentials = addressCredentials(entry);
  if (!credentials) {
    return fail('no address credentials');
  }
  // The signature is the Secp256r1Signature struct directly: a sorted ScMap
  // { authenticator_data, client_data_json, public_key, signature } (assemble.ts).
  const structMap = scMap(credentials.signature);
  if (!structMap) return fail('signature is not a Secp256r1Signature map');

  // Enrollment: the contract rejects a key it does not hold before any crypto.
  const inline = structMap.find((x) => scSymbol(x.key) === 'public_key');
  const inlineBytes = inline ? scBytes(inline.val) : undefined;
  if (inline && (!inlineBytes || !bytesEqual(inlineBytes, publicKey))) {
    return fail('unknown signer: inline public_key is not the enrolled key');
  }

  const signaturePayload = authEntryChallengeBytes(entry, networkPassphrase);
  const r = verifySecp256r1StructMap(structMap, publicKey, signaturePayload);
  return { success: r.ok, challengeBound: r.challengeBound, signatureValid: r.signatureValid };
}

export interface SmartWalletCheckAuthResult {
  success: boolean;
  signers: { credentialId: string; challengeBound: boolean; signatureValid: boolean }[];
  reason?: string;
}

/**
 * A reference model of passkey-kit's smart-wallet `__check_auth`: unwrap the
 * `Signatures(Map<SignerKey, Signature>)` value (`ScVal::Vec([ScVal::Map(...)])`),
 * and for each `SignerKey::Secp256r1(id) => Signature::Secp256r1(struct)` entry,
 * look up that credential id's SEC-1 public key and verify the struct. Succeeds
 * only when the map is non-empty and every signer verifies + is challenge-bound.
 * `publicKeyFor` receives the lowercase-hex credential id.
 */
export function referenceSmartWalletCheckAuth(
  entry: xdr.SorobanAuthorizationEntry,
  publicKeyFor: (credentialIdHex: string) => Uint8Array | undefined,
  networkPassphrase: string,
): SmartWalletCheckAuthResult {
  const credentials = addressCredentials(entry);
  if (!credentials) {
    return { success: false, signers: [], reason: 'no address credentials' };
  }
  const sigVec = scVec(credentials.signature);
  const map = sigVec?.[0] ? scMap(sigVec[0]) : undefined;
  if (!map) {
    return { success: false, signers: [], reason: 'signature is not a Signatures(Map) vec' };
  }
  if (map.length === 0) return { success: false, signers: [], reason: 'empty signatures map' };

  const signaturePayload = authEntryChallengeBytes(entry, networkPassphrase);
  const signers: SmartWalletCheckAuthResult['signers'] = [];
  let allOk = true;

  for (const e of map) {
    const keyVec = scVec(e.key);
    const idBytes = keyVec?.[1] ? scBytes(keyVec[1]) : undefined;
    const credentialId = idBytes ? bytesToHex(idBytes) : '';
    // Signature::Secp256r1(struct) → scvVec([Symbol, structMap]).
    const valVec = scVec(e.val);
    const structMap = valVec?.[1] ? scMap(valVec[1]) : undefined;
    const publicKey = publicKeyFor(credentialId);
    if (!structMap || !publicKey) {
      allOk = false;
      signers.push({ credentialId, challengeBound: false, signatureValid: false });
      continue;
    }
    const r = verifySecp256r1StructMap(structMap, publicKey, signaturePayload);
    if (!r.ok) allOk = false;
    signers.push({
      credentialId,
      challengeBound: r.challengeBound,
      signatureValid: r.signatureValid,
    });
  }
  return { success: allOk, signers };
}
