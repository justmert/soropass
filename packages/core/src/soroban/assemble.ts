import { xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import type { AssertionResult } from './sign';

/**
 * Set an address-credential auth entry's signature to the `Secp256r1Signature`
 * struct our v0.2 `webauthn-account` `__check_auth` consumes:
 *
 *   ScVal::Map {
 *     authenticator_data: Bytes,
 *     client_data_json:   Bytes,
 *     public_key:         BytesN<65>,   // the enrolled signer to verify against
 *     signature:          BytesN<64>,
 *   }
 *
 * Map keys are alphabetical, so the ScMap is canonically sorted as Soroban
 * requires. `signature` MUST already be 64-byte low-S compact (`signAuthEntry`
 * normalizes before calling this). `publicKey` names which enrolled signer the
 * contract checks; the multi-signer account rejects a key it does not hold
 * before any crypto runs.
 */
export function applyAssertionToEntry(
  entry: xdr.SorobanAuthorizationEntry,
  assertion: AssertionResult,
  publicKey: Uint8Array,
): xdr.SorobanAuthorizationEntry {
  entry.credentials().address().signature(buildSingleSignerSignatureScVal(assertion, publicKey));
  return entry;
}

/** The v0.2 single-signer `Secp256r1Signature` ScVal (4 fields, sorted ScMap). */
export function buildSingleSignerSignatureScVal(
  assertion: AssertionResult,
  publicKey: Uint8Array,
): xdr.ScVal {
  if (publicKey.length !== 65) {
    throw new KitError(
      'CONTRACT_AUTH_FAILED',
      `single-signer signature needs a 65-byte SEC-1 public key (got ${String(publicKey.length)})`,
    );
  }
  return xdr.ScVal.scvMap([
    bytesField('authenticator_data', assertion.authenticatorData),
    bytesField('client_data_json', assertion.clientDataJSON),
    bytesField('public_key', publicKey),
    bytesField('signature', assertion.signature),
  ]);
}

/**
 * The 3-field `Secp256r1Signature` ScVal that passkey-kit v1's smart-wallet
 * consumes ({ authenticator_data, client_data_json, signature }): that contract
 * resolves the public key from its own `SignerKey -> public key` storage, so the
 * key is NOT inlined here. Kept separate from the single-signer struct above so
 * the two ABIs never drift into each other.
 */
export function buildSignatureScVal(assertion: AssertionResult): xdr.ScVal {
  return xdr.ScVal.scvMap([
    bytesField('authenticator_data', assertion.authenticatorData),
    bytesField('client_data_json', assertion.clientDataJSON),
    bytesField('signature', assertion.signature),
  ]);
}

function bytesField(name: string, bytes: Uint8Array): xdr.ScMapEntry {
  return new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol(name),
    val: xdr.ScVal.scvBytes(Buffer.from(bytes)),
  });
}
