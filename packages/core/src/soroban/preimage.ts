import { xdr, hash } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import { bytesToBase64Url, utf8ToBytes } from '../internal/encoding';
import { addressCredentials } from './scval';

/**
 * Compute the auth-entry preimage hash that the host hands `__check_auth` as the
 * signature payload and that becomes the WebAuthn `challenge`. The credential
 * variant selects the preimage (networkId = SHA256(networkPassphrase)):
 *  - `sorobanCredentialsAddress`:
 *    SHA256( XDR( HashIdPreimage::SorobanAuthorization{ networkId, nonce,
 *    signatureExpirationLedger, invocation } ) )
 *  - `sorobanCredentialsAddressV2` (Protocol 23, CAP-71) additionally binds the
 *    authorizing address:
 *    SHA256( XDR( HashIdPreimage::SorobanAuthorizationWithAddress{ networkId,
 *    nonce, signatureExpirationLedger, address, invocation } ) )
 */
export function authEntryChallengeBytes(
  entry: xdr.SorobanAuthorizationEntry,
  networkPassphrase: string,
): Uint8Array {
  const address = addressCredentials(entry);
  if (!address) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'auth entry has no address credentials to sign');
  }
  const networkId = hash(utf8ToBytes(networkPassphrase));
  const preimage =
    entry.credentials.type === 'sorobanCredentialsAddressV2'
      ? xdr.HashIdPreimage.envelopeTypeSorobanAuthorizationWithAddress(
          new xdr.HashIdPreimageSorobanAuthorizationWithAddress({
            networkId,
            nonce: address.nonce,
            signatureExpirationLedger: address.signatureExpirationLedger,
            address: address.address,
            invocation: entry.rootInvocation,
          }),
        )
      : xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
          new xdr.HashIdPreimageSorobanAuthorization({
            networkId,
            nonce: address.nonce,
            signatureExpirationLedger: address.signatureExpirationLedger,
            invocation: entry.rootInvocation,
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
