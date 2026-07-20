import { xdr } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { sha256 } from '../internal/sha256';
import { concatBytes } from '../internal/bytes';
import { bytesToBase64Url, bytesToUtf8 } from '../internal/encoding';
import { authEntryChallengeBytes } from './preimage';

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
    const e = structMap.find((x) => x.key().sym().toString() === name);
    return e ? new Uint8Array(e.val().bytes()) : undefined;
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
  // Host fn semantics: no low-S enforcement (lowS:false), compact format.
  const digest = sha256(concatBytes(authenticatorData, sha256(clientDataJSON)));
  const signatureValid = p256.verify(signature, digest, publicKey, {
    lowS: false,
    format: 'compact',
  });
  return { ok: challengeBound && signatureValid, challengeBound, signatureValid };
}

/**
 * A faithful JavaScript model of the on-chain `__check_auth` (kalepail
 * `webauthn-wallet` `verify.rs`): reconstruct `SHA256(authenticator_data ‖
 * SHA256(client_data_json))`, run `secp256r1_verify` (which does NOT enforce
 * low-S — hence the client-side normalization), and assert challenge-binding
 * (`clientDataJSON.challenge === base64url(signature_payload)`). Lets us prove
 * the assembly without a live Soroban RPC; the real on-chain run is exercised
 * by the kit integration (S17) and the demo (S21).
 */
export function referenceCheckAuth(
  entry: xdr.SorobanAuthorizationEntry,
  publicKey: Uint8Array,
  networkPassphrase: string,
): CheckAuthResult {
  if (entry.credentials().switch().name !== 'sorobanCredentialsAddress') {
    return fail('no address credentials');
  }
  // The signature is the Secp256r1Signature struct directly: a sorted ScMap
  // { authenticator_data, client_data_json, signature } (see assemble.ts).
  const structMap = entry.credentials().address().signature().map();
  if (!structMap) return fail('signature is not a Secp256r1Signature map');

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
  if (entry.credentials().switch().name !== 'sorobanCredentialsAddress') {
    return { success: false, signers: [], reason: 'no address credentials' };
  }
  const sig = entry.credentials().address().signature();
  const map = sig.switch().name === 'scvVec' ? sig.vec()?.[0]?.map() : undefined;
  if (!map) {
    return { success: false, signers: [], reason: 'signature is not a Signatures(Map) vec' };
  }
  if (map.length === 0) return { success: false, signers: [], reason: 'empty signatures map' };

  const signaturePayload = authEntryChallengeBytes(entry, networkPassphrase);
  const signers: SmartWalletCheckAuthResult['signers'] = [];
  let allOk = true;

  for (const e of map) {
    const keyVec = e.key().vec();
    const idBytes = keyVec?.[1]?.bytes();
    const credentialId = idBytes ? Buffer.from(idBytes).toString('hex') : '';
    // Signature::Secp256r1(struct) → scvVec([Symbol, structMap]).
    const structMap = e.val().vec()?.[1]?.map();
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
