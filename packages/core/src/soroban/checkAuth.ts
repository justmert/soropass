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
  const mapEntry = entry.credentials().address().signature().vec()?.[0]?.map()?.[0];
  if (!mapEntry) return fail('no signature map entry');
  const structMap = mapEntry.val().vec()?.[1]?.map();
  if (!structMap) return fail('malformed Signature enum');

  const field = (name: string): Uint8Array | undefined => {
    const e = structMap.find((x) => x.key().sym().toString() === name);
    return e ? new Uint8Array(e.val().bytes()) : undefined;
  };
  const authenticatorData = field('authenticator_data');
  const clientDataJSON = field('client_data_json');
  const signature = field('signature');
  if (!authenticatorData || !clientDataJSON || !signature) return fail('missing signature fields');
  if (signature.length !== 64) return fail('signature is not 64-byte compact');

  const signaturePayload = authEntryChallengeBytes(entry, networkPassphrase);

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

  return { success: challengeBound && signatureValid, challengeBound, signatureValid };
}
