import { xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';

const sym = (s: string): xdr.ScVal => xdr.ScVal.scvSymbol(s);
const scBytes = (u: Uint8Array): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(u));

export interface AssembledSignature {
  credentialId: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** 64-byte low-S compact R‖S. */
  signature: Uint8Array;
}

/**
 * Build the contract `Secp256r1Signature` struct as an ScVal map with sorted
 * symbol keys: { authenticator_data, client_data_json, signature }. This is the
 * kalepail `webauthn-wallet` struct; it is also the standard Soroban
 * struct-as-Map encoding OZ Smart Accounts consume. (Note: kalepail carries the
 * credential id as the *SignerKey*, not a struct field — we follow that.)
 */
export function buildSignatureStruct(input: AssembledSignature): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: sym('authenticator_data'), val: scBytes(input.authenticatorData) }),
    new xdr.ScMapEntry({ key: sym('client_data_json'), val: scBytes(input.clientDataJSON) }),
    new xdr.ScMapEntry({ key: sym('signature'), val: scBytes(input.signature) }),
  ]);
}

/** `SignerKey::Secp256r1(credentialId)` as a Soroban enum (Vec[symbol, ...]). */
export function buildSignerKey(credentialId: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvVec([sym('Secp256r1'), scBytes(credentialId)]);
}

/** `Signature::Secp256r1(struct)` as a Soroban enum (Vec[symbol, struct]). */
export function buildSignatureEnum(signatureStruct: xdr.ScVal): xdr.ScVal {
  return xdr.ScVal.scvVec([sym('Secp256r1'), signatureStruct]);
}

/**
 * Insert the assembled WebAuthn signature into an entry's address credentials
 * as `Vec[ Map{ SignerKey => Signature } ]` (kalepail `Signatures`). Mutates and
 * returns the entry.
 */
export function applyAssertionToEntry(
  entry: xdr.SorobanAuthorizationEntry,
  assertion: AssembledSignature,
): xdr.SorobanAuthorizationEntry {
  const credentials = entry.credentials();
  if (credentials.switch().name !== 'sorobanCredentialsAddress') {
    throw new KitError('CONTRACT_AUTH_FAILED', 'auth entry has no address credentials to sign');
  }
  const mapEntry = new xdr.ScMapEntry({
    key: buildSignerKey(assertion.credentialId),
    val: buildSignatureEnum(buildSignatureStruct(assertion)),
  });
  credentials.address().signature(xdr.ScVal.scvVec([xdr.ScVal.scvMap([mapEntry])]));
  return entry;
}
