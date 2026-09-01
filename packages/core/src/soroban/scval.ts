import { xdr } from '@stellar/stellar-sdk';

/**
 * stellar-sdk 17 models every XDR union as an immutable discriminated union of
 * per-variant classes: an arm property exists only on its variant, so reading
 * "the map, if this is a map" requires narrowing on `.type` first, and updating
 * a field means rebuilding the value. These helpers centralize both patterns
 * for the handful of shapes the SDK reads and writes. Internal only.
 */

/** The elements of an scvVec arm, or undefined for any other arm (or a null vec). */
export function scVec(v: xdr.ScVal): xdr.ScVal[] | undefined {
  return v.type === 'scvVec' ? (v.vec ?? undefined) : undefined;
}

/** The entries of an scvMap arm, or undefined for any other arm (or a null map). */
export function scMap(v: xdr.ScVal): xdr.ScMapEntry[] | undefined {
  return v.type === 'scvMap' ? (v.map ?? undefined) : undefined;
}

/**
 * The bytes of an scvBytes arm as a plain Uint8Array, or undefined for any
 * other arm. v17 wraps the payload in an `ScBytes` value object; feeding that
 * wrapper to `new Uint8Array(...)` yields an EMPTY array, so every extraction
 * must go through `.toBytes()`.
 */
export function scBytes(v: xdr.ScVal): Uint8Array | undefined {
  return v.type === 'scvBytes' ? new Uint8Array(v.bytes.toBytes()) : undefined;
}

/** The string of an scvSymbol arm, or undefined for any other arm. */
export function scSymbol(v: xdr.ScVal): string | undefined {
  return v.type === 'scvSymbol' ? v.sym.toString() : undefined;
}

/**
 * The address credentials of an auth entry, or undefined for another credential
 * kind. Covers BOTH `sorobanCredentialsAddress` and the Protocol 23 (CAP-71)
 * `sorobanCredentialsAddressV2` variant, which carries the identical
 * `SorobanAddressCredentials` struct but binds the address into the signature
 * payload; simulation on a Protocol 23+ network returns V2 entries.
 * `sorobanCredentialsAddressWithDelegates` (delegate trees) is out of scope for
 * this passkey SDK and reads as undefined, so it is never half-signed.
 */
export function addressCredentials(
  entry: xdr.SorobanAuthorizationEntry,
): xdr.SorobanAddressCredentials | undefined {
  const credentials = entry.credentials;
  if (credentials.type === 'sorobanCredentialsAddress') return credentials.address;
  if (credentials.type === 'sorobanCredentialsAddressV2') return credentials.addressV2;
  return undefined;
}

/**
 * Rebuild an auth entry with updated address-credential fields, preserving the
 * entry's credential variant (classic address stays classic, V2 stays V2 --
 * the variant selects which preimage the host verifies against). `base` is the
 * entry's current address credentials (from {@link addressCredentials});
 * omitted fields carry over unchanged. The input entry is not modified.
 */
export function withAddressCredentials(
  entry: xdr.SorobanAuthorizationEntry,
  base: xdr.SorobanAddressCredentials,
  update: { signature?: xdr.ScVal; signatureExpirationLedger?: number },
): xdr.SorobanAuthorizationEntry {
  const rebuilt = new xdr.SorobanAddressCredentials({
    address: base.address,
    nonce: base.nonce,
    signatureExpirationLedger: update.signatureExpirationLedger ?? base.signatureExpirationLedger,
    signature: update.signature ?? base.signature,
  });
  const credentials =
    entry.credentials.type === 'sorobanCredentialsAddressV2'
      ? xdr.SorobanCredentials.sorobanCredentialsAddressV2(rebuilt)
      : xdr.SorobanCredentials.sorobanCredentialsAddress(rebuilt);
  return new xdr.SorobanAuthorizationEntry({
    credentials,
    rootInvocation: entry.rootInvocation,
  });
}
