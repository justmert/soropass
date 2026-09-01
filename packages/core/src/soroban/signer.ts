import { Contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import { buildSignerKeyScVal } from './smartWallet';

/**
 * passkey-kit v1 (v0.13.0, Protocol 27) smart-wallet SIGNER encoders — the WRITE
 * path (what `add_signer` / `remove_signer` consume), complementing
 * `smartWallet.ts` (the signature READ path the wallet's `__check_auth` reads).
 *
 * A signer is added on-chain as
 *
 *   Signer::Secp256r1(Bytes id, BytesN<65> public_key,
 *                     SignerExpiration, SignerLimits, SignerStorage)
 *
 * which `process_signer` reduces to `SignerKey::Secp256r1(id) ->
 * SignerVal::Secp256r1(public_key, ..)`: the raw credential id is the key, the
 * SEC-1 public key lives in the value. Shape + field order confirmed by kalepail
 * (passkey-kit author) in issue #32 and proven on testnet against the audited v1
 * wasm (`scripts/smartwallet-v1-e2e.ts`).
 *
 * v1 note: `SignerExpiration` is a UNIX-seconds `u64` timestamp (Protocol 27),
 * NOT a ledger sequence as in the pre-v1 kit.
 */

/** `SignerStorage` — where the contract persists the signer entry. */
export type SignerStorage = 'Persistent' | 'Temporary';

export interface Secp256r1SignerSpec {
  /** Raw WebAuthn credential-id bytes (base64url-decoded `rawId`) — becomes the SignerKey. */
  credentialId: Uint8Array;
  /** SEC-1 uncompressed public key (65 bytes, `0x04 ‖ X ‖ Y`) — stored in SignerVal. */
  publicKey: Uint8Array;
  /**
   * `SignerExpiration` — a UNIX-seconds timestamp (v1 / Protocol 27) after which
   * the signer stops being valid. Omit for `None` (a non-expiring signer, the
   * usual choice for a recovery / second device).
   */
  expiration?: number | bigint;
  /** `SignerStorage` — defaults to `Persistent`. */
  storage?: SignerStorage;
}

/** A tuple-struct `Option` field set to `None` → `scvVec([Void])`. */
function noneTuple(): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvVoid()]);
}

/** `SignerExpiration(Option<u64>)` — `None` or `Some(unixSeconds)`. */
function expirationScVal(expiration?: number | bigint): xdr.ScVal {
  if (expiration === undefined) return noneTuple();
  const ts = BigInt(expiration);
  if (ts < 0n) {
    throw new KitError(
      'CONTRACT_AUTH_FAILED',
      'signer expiration must be a non-negative UNIX-seconds timestamp (v1)',
    );
  }
  return xdr.ScVal.scvVec([nativeToScVal(ts, { type: 'u64' })]);
}

/** `SignerStorage::Persistent | Temporary` → `scvVec([Symbol(variant)])`. */
function storageScVal(storage: SignerStorage = 'Persistent'): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(storage)]);
}

/**
 * Encode a `Signer::Secp256r1(..)` for `add_signer`. `SignerLimits` is always
 * `None` (unrestricted) — policy/limited signers are out of scope for this
 * minimal passkey SDK. Validates the credential id and the SEC-1 public key so a
 * malformed signer can never be handed to the contract.
 */
export function buildSecp256r1Signer(spec: Secp256r1SignerSpec): xdr.ScVal {
  if (spec.credentialId.length === 0) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'buildSecp256r1Signer: empty credential id');
  }
  if (spec.publicKey.length !== 65 || spec.publicKey[0] !== 0x04) {
    throw new KitError(
      'INVALID_PUBLIC_KEY',
      'buildSecp256r1Signer: publicKey must be a 65-byte SEC-1 uncompressed point (0x04-prefixed)',
    );
  }
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Secp256r1'),
    xdr.ScVal.scvBytes(spec.credentialId),
    xdr.ScVal.scvBytes(spec.publicKey),
    expirationScVal(spec.expiration), // SignerExpiration
    noneTuple(), // SignerLimits(None)
    storageScVal(spec.storage), // SignerStorage
  ]);
}

function contractCall(contractId: string, method: string, ...args: xdr.ScVal[]): xdr.Operation {
  let contract: Contract;
  try {
    contract = new Contract(contractId);
  } catch (cause) {
    throw new KitError('CONTRACT_AUTH_FAILED', `invalid smart-wallet contract id "${contractId}"`, {
      cause,
    });
  }
  return contract.call(method, ...args);
}

export interface BuildAddSignerOptions {
  /** The smart-wallet C-address the signer is being added to. */
  walletContractId: string;
  /** The signer to add — a `Secp256r1SignerSpec`, or a pre-built `Signer` ScVal. */
  signer: Secp256r1SignerSpec | xdr.ScVal;
}

/**
 * Build the `wallet.add_signer(signer)` invocation. The resulting invoke-host
 * operation requires the wallet's OWN auth: an EXISTING signer authorizes adding
 * the new one, which is what keeps a lost device from locking the user out.
 * Sign the produced transaction's auth entry with
 * `signTransaction(.., { target: 'smart-wallet' })`.
 */
export function buildAddSignerOperation(options: BuildAddSignerOptions): xdr.Operation {
  const signerScVal = xdr.ScVal.is(options.signer)
    ? options.signer
    : buildSecp256r1Signer(options.signer);
  return contractCall(options.walletContractId, 'add_signer', signerScVal);
}

export interface BuildRemoveSignerOptions {
  walletContractId: string;
  /** Raw credential-id bytes of the signer to remove (its `SignerKey`). */
  credentialId: Uint8Array;
}

/** Build the `wallet.remove_signer(SignerKey::Secp256r1(id))` invocation (wallet-authorized). */
export function buildRemoveSignerOperation(options: BuildRemoveSignerOptions): xdr.Operation {
  if (options.credentialId.length === 0) {
    throw new KitError('CONTRACT_AUTH_FAILED', 'buildRemoveSignerOperation: empty credential id');
  }
  return contractCall(
    options.walletContractId,
    'remove_signer',
    buildSignerKeyScVal(options.credentialId),
  );
}
