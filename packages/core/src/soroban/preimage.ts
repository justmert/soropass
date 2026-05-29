import { xdr, hash } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import { bytesToBase64Url, utf8ToBytes } from '../internal/encoding';

/**
 * Compute the auth-entry preimage hash that `__check_auth` reconstructs and that
 * becomes the WebAuthn `challenge`:
 *   SHA256( XDR( HashIdPreimage::SorobanAuthorization{ networkId, nonce,
 *   signatureExpirationLedger, invocation } ) )
 * where networkId = SHA256(networkPassphrase).
 */
export function authEntryChallengeBytes(
  entry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
): Uint8Array {
  const credentials = entry.credentials();
  if (credentials.switch().name !== 'sorobanCredentialsAddress') {
    throw new KitError('CONTRACT_AUTH_FAILED', 'auth entry has no address credentials to sign');
  }
  const address = credentials.address();
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: Buffer.from(hash(Buffer.from(utf8ToBytes(networkPassphrase)))),
      nonce: address.nonce(),
      signatureExpirationLedger: address.signatureExpirationLedger(),
      invocation: entry.rootInvocation(),
    }),
  );
  return new Uint8Array(hash(preimage.toXDR()));
}

/** The base64url challenge string the authenticator signs (43 chars). */
export function authEntryChallenge(
  entry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
): string {
  return bytesToBase64Url(authEntryChallengeBytes(entry, networkPassphrase));
}
