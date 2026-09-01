import { xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import { buildSignatureScVal } from './assemble';
import {
  addressCredentials,
  scBytes,
  scMap,
  scSymbol,
  scVec,
  withAddressCredentials,
} from './scval';
import type { AssertionResult } from './sign';

/**
 * The passkey-kit / `webauthn-wallet` smart-wallet ABI target.
 *
 * Our own single-signer account declares `type Signature = Secp256r1Signature`
 * and consumes the bare struct (see `assemble.ts`). passkey-kit's smart-wallet
 * declares `type Signature = Signatures`, so authorizing it needs the assertion
 * wrapped as `Signatures(Map<SignerKey, Signature>)`. The exact shape, the raw-
 * credential-id key, and the canonical map ordering below are confirmed by
 * kalepail (passkey-kit author) in issue #32 against v1 / v0.13.0 (Protocol 27,
 * independently audited); the wire shape is unchanged from v0.12.
 */

/**
 * `SignerKey::Secp256r1(Bytes)` → `scvVec([Symbol("Secp256r1"), Bytes(rawId)])`.
 * The key is the RAW WebAuthn credential-id bytes (base64url-decoded `rawId`):
 * never hashed, never the UTF-8 of the base64url string, and never the public
 * key — the SEC-1 public key lives in `SignerVal` on-chain, not in the key.
 */
export function buildSignerKeyScVal(credentialId: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Secp256r1'), xdr.ScVal.scvBytes(credentialId)]);
}

/** `Signature::Secp256r1(Secp256r1Signature)` → `scvVec([Symbol("Secp256r1"), <bare struct map>])`. */
export function buildSmartWalletSignatureVariant(assertion: AssertionResult): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Secp256r1'), buildSignatureScVal(assertion)]);
}

function decomposeSignerKey(key: xdr.ScVal): { variant: string; payload: Uint8Array } {
  const vec = scVec(key);
  if (!vec || vec.length < 2) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'malformed SignerKey (expected an enum vec)');
  }
  const variant = scSymbol(vec[0]!);
  if (variant === undefined) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'malformed SignerKey (variant tag is not a symbol)');
  }
  const el = vec[1]!;
  // Secp256r1(Bytes) and Ed25519(BytesN<32>) are scvBytes; Policy(Address) falls
  // back to its XDR bytes (rare in a passkey SDK — see the ordering note below).
  const payload = scBytes(el) ?? new Uint8Array(el.toXDR());
  return { variant, payload };
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  }
  return a.length - b.length;
}

/**
 * Canonical Soroban-host ordering for `SignerKey` map keys. The host requires
 * `Map<SignerKey, _>` entries sorted by ScVal `Ord` — an **element-wise byte
 * comparison**, NOT a length-major XDR-hex / `localeCompare` string sort. This is
 * the one correctness landmine kalepail flagged in #32: passkey-kit v1 replaced
 * its old string sort with exactly this because the old approach could mis-order
 * same-variant keys of differing length, producing a map the host rejects.
 *
 * We compare the enum variant symbol first, then the payload bytes element-wise,
 * so homogeneous `Secp256r1` keys (the multi-passkey case) sort purely by their
 * raw credential-id bytes. (Ordering across mixed variant types relies on the
 * variant names being capitalized single words, which matches the host's symbol
 * order; a Policy/Address-keyed multi-sig is out of scope for this passkey SDK.)
 */
export function compareSignerKeyScVal(a: xdr.ScVal, b: xdr.ScVal): number {
  const ka = decomposeSignerKey(a);
  const kb = decomposeSignerKey(b);
  if (ka.variant !== kb.variant) return ka.variant < kb.variant ? -1 : 1;
  return compareBytes(ka.payload, kb.payload);
}

/**
 * Assemble/merge a passkey assertion into an address-credential auth entry as the
 * smart-wallet `Signatures(Map<SignerKey, Signature>)` wire shape
 * (`ScVal::Vec([ScVal::Map(...)])`). `assertion.signature` MUST already be 64-byte
 * low-S compact (`signAuthEntry` normalizes first). Existing map entries — a
 * partially-signed multi-sig entry — are preserved; an entry for the same signer
 * key is replaced; then the whole map is canonically sorted.
 *
 * Returns a NEW entry carrying the merged signatures; the input entry is not
 * modified (stellar-sdk 17 XDR values are immutable).
 *
 * Use this for the passkey-kit / webauthn-wallet ABI. For our own single-signer
 * account (`type Signature = Secp256r1Signature`) use `applyAssertionToEntry`.
 */
export function applyAssertionToSmartWalletEntry(
  entry: xdr.SorobanAuthorizationEntry,
  assertion: AssertionResult,
): xdr.SorobanAuthorizationEntry {
  const credentials = addressCredentials(entry);
  if (!credentials) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'auth entry has no address credentials to sign');
  }
  const key = buildSignerKeyScVal(assertion.credentialId);
  const newEntry = new xdr.ScMapEntry({ key, val: buildSmartWalletSignatureVariant(assertion) });

  const current = credentials.signature;
  let mapEntries: xdr.ScMapEntry[];
  switch (current.type) {
    case 'scvVoid':
      mapEntries = [newEntry];
      break;
    case 'scvVec': {
      // Preserve any existing signatures (partial multi-sig); replace same key.
      const first = current.vec?.[0];
      const existing = (first ? scMap(first) : undefined) ?? [];
      mapEntries = existing.filter((e) => compareSignerKeyScVal(e.key, key) !== 0);
      mapEntries.push(newEntry);
      break;
    }
    default:
      throw new KitError(
        'CONTRACT_AUTH_FAILED',
        'unexpected existing signature shape for a smart-wallet entry',
      );
  }
  mapEntries.sort((a, b) => compareSignerKeyScVal(a.key, b.key));
  return withAddressCredentials(entry, credentials, {
    signature: xdr.ScVal.scvVec([xdr.ScVal.scvMap(mapEntries)]),
  });
}
