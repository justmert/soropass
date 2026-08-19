import { Address, xdr } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import { derToCompactLowS, normalizeLowS } from '../webauthn/signature';
import { parseClientDataJSON, verifyClientDataJSON, type ClientData } from '../webauthn/clientData';
import { parseAuthenticatorData, verifyRpIdHash } from '../webauthn/authData';
import { verifyAssertionSignature } from '../webauthn/verify';
import { authEntryChallenge } from './preimage';
import { applyAssertionToEntry } from './assemble';
import { applyAssertionToSmartWalletEntry } from './smartWallet';

/**
 * Which contract ABI the assembled signature targets:
 *  - `single-signer` (default): the bare `Secp256r1Signature` struct our own
 *    webauthn-account consumes (`type Signature = Secp256r1Signature`).
 *  - `smart-wallet`: passkey-kit's `Signatures(Map<SignerKey, Signature>)`
 *    (`type Signature = Signatures`) — see `smartWallet.ts` / kalepail #32.
 * Both reuse the identical low-S, field-packing, and challenge-binding core;
 * only the outer wrapper differs, so the two stay separate ABI targets behind
 * one signing interface.
 */
export type WalletTarget = 'single-signer' | 'smart-wallet';

/** The raw WebAuthn assertion a signer returns for a given challenge. */
export interface AssertionResult {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** DER-encoded (≤72B) or already-compact (64B) ECDSA signature. */
  signature: Uint8Array;
  /** base64url credential id → the SignerKey. */
  credentialId: Uint8Array;
}

/** Produce a WebAuthn assertion over the base64url `challenge` (e.g. navigator.credentials.get). */
export type WebAuthnSigner = (challenge: string) => Promise<AssertionResult> | AssertionResult;

/**
 * Opt-in pre-flight validation of the returned assertion, run BEFORE the entry
 * is assembled and submitted. On-chain `__check_auth` is the real gate, but
 * catching these client-side turns an opaque on-chain failure into a typed
 * `KitError` at the call site. Providing this object always enforces the
 * `webauthn.get` type, the User-Present (UP) flag (required by passkey-kit v1),
 * and challenge-binding; `rpId` / `origin` / `publicKey` add their checks when
 * supplied. Omit the object entirely to skip pre-flight (the default).
 */
export interface SignVerifyOptions {
  /** Verify `authenticatorData.rpIdHash === SHA-256(rpId)`. */
  rpId?: string;
  /** Verify `clientDataJSON.origin` is one of these exact origins. */
  origin?: string | string[];
  /** SEC-1 (65-byte) public key → verify the ECDSA assertion signature. */
  publicKey?: Uint8Array;
  /** Also require the User-Verified (UV) flag (biometric / PIN). Default false. */
  requireUserVerification?: boolean;
  /** Allow an assertion made in a cross-origin context (crossOrigin=true). Default false. */
  allowCrossOrigin?: boolean;
}

export interface SorobanSignOptions {
  networkPassphrase: string;
  sign: WebAuthnSigner;
  /**
   * Restrict `signTransaction` to auth entries whose credential address equals this
   * C-address. When set, only the connected account's entries are signed and any other
   * authorizer's entries are left untouched, so the passkey never signs on behalf of, or
   * prompts for, accounts that are not the signer. Omit to sign every address-credential
   * entry.
   */
  signerAddress?: string;
  /** Contract ABI to assemble for. Defaults to `single-signer` (our account). */
  target?: WalletTarget;
  /** Opt-in pre-flight assertion validation. Omit to skip. */
  verify?: SignVerifyOptions;
  /**
   * Stamp this `signatureExpirationLedger` onto every address-credential auth
   * entry BEFORE the challenge is computed, so the signature binds the exact
   * expiration the contract re-derives in `__check_auth`. Needed for smart-wallet
   * writes (add/remove signer) where the caller learns the ledger at sign time;
   * omit when the entry already carries the intended expiration.
   */
  signatureExpirationLedger?: number;
}

/** Validate an assertion against the expected challenge + RP context. Throws KitError. */
function preflightAssertion(
  assertion: AssertionResult,
  challenge: string,
  verify: SignVerifyOptions,
): void {
  // Ceremony type + challenge-binding (+ origin when provided).
  let clientData: ClientData;
  if (verify.origin !== undefined) {
    clientData = verifyClientDataJSON(assertion.clientDataJSON, {
      origin: verify.origin,
      challenge,
    });
  } else {
    clientData = parseClientDataJSON(assertion.clientDataJSON);
    if (clientData.type !== 'webauthn.get') {
      throw new KitError(
        'UNSUPPORTED_AUTHENTICATOR',
        `clientDataJSON.type "${clientData.type}" is not "webauthn.get"`,
      );
    }
    if (clientData.challenge !== challenge) {
      throw new KitError('CHALLENGE_MISMATCH', 'assertion challenge does not match the auth entry');
    }
  }
  if (clientData.crossOrigin === true && !verify.allowCrossOrigin) {
    throw new KitError(
      'ORIGIN_MISMATCH',
      'assertion was made in a cross-origin context (crossOrigin=true)',
    );
  }
  // User-Present is mandatory (passkey-kit v1 hardening); UV is opt-in.
  const parsed = parseAuthenticatorData(assertion.authenticatorData);
  if (!parsed.flags.up) {
    throw new KitError(
      'UNSUPPORTED_AUTHENTICATOR',
      'assertion is missing the User-Present (UP) flag',
    );
  }
  if (verify.requireUserVerification && !parsed.flags.uv) {
    throw new KitError(
      'UNSUPPORTED_AUTHENTICATOR',
      'assertion is missing the required User-Verified (UV) flag',
    );
  }
  if (verify.rpId !== undefined) {
    verifyRpIdHash(assertion.authenticatorData, verify.rpId);
  }
  if (verify.publicKey !== undefined) {
    const ok = verifyAssertionSignature({
      publicKey: verify.publicKey,
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      signature: assertion.signature,
    });
    if (!ok) {
      throw new KitError(
        'CONTRACT_AUTH_FAILED',
        'assertion signature failed pre-flight verification',
      );
    }
  }
}

async function signEntryInPlace(
  entry: xdr.SorobanAuthorizationEntry,
  options: SorobanSignOptions,
): Promise<void> {
  // Stamp the expiration first: the challenge preimage includes
  // signatureExpirationLedger, so it must be final before we compute it.
  if (options.signatureExpirationLedger !== undefined) {
    const creds = entry.credentials();
    if (creds.switch().name === 'sorobanCredentialsAddress') {
      creds.address().signatureExpirationLedger(options.signatureExpirationLedger);
    }
  }
  const challenge = authEntryChallenge(entry, options.networkPassphrase);
  const assertion = await options.sign(challenge);
  if (options.verify) preflightAssertion(assertion, challenge, options.verify);
  // Always low-S normalize (invariant #2), on BOTH branches: an already-compact
  // 64-byte signature from a custom signer can still be high-S, which the on-chain
  // secp256r1 verifier rejects.
  const signature =
    assertion.signature.length === 64 ? normalizeLowS(assertion.signature) : derToCompactLowS(assertion.signature);
  const normalized = {
    credentialId: assertion.credentialId,
    authenticatorData: assertion.authenticatorData,
    clientDataJSON: assertion.clientDataJSON,
    signature,
  };
  if (options.target === 'smart-wallet') {
    applyAssertionToSmartWalletEntry(entry, normalized);
  } else {
    applyAssertionToEntry(entry, normalized);
  }
}

/**
 * Sign a single `SorobanAuthorizationEntry` (base64 XDR): compute the challenge,
 * obtain a WebAuthn assertion, low-S-normalize, and assemble the contract
 * signature. Returns the signed entry as base64 XDR.
 */
export async function signAuthEntry(
  entryXdr: string,
  options: SorobanSignOptions,
): Promise<string> {
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, 'base64');
  await signEntryInPlace(entry, options);
  return entry.toXDR('base64');
}

/**
 * The operations whose Soroban auth entries we sign, for a v1 or a fee-bump
 * envelope. (Sign the Soroban auth entries before adding classic tx signatures
 * or fee-bumping; a fee-bump around an already-classic-signed inner tx is the
 * caller's sequencing concern.)
 */
function operationsForSigning(envelope: xdr.TransactionEnvelope): xdr.Operation[] {
  const kind = envelope.switch().name;
  if (kind === 'envelopeTypeTx') return envelope.v1().tx().operations();
  if (kind === 'envelopeTypeTxFeeBump') {
    const inner = envelope.feeBump().tx().innerTx();
    if (inner.switch().name !== 'envelopeTypeTx') {
      throw new KitError(
        'CONTRACT_AUTH_FAILED',
        'signTransaction: fee-bump inner transaction is not a v1 transaction',
      );
    }
    return inner.v1().tx().operations();
  }
  throw new KitError(
    'CONTRACT_AUTH_FAILED',
    `signTransaction: unsupported envelope type "${kind}" (expected v1 or fee-bump)`,
  );
}

/**
 * Sign every address-credential Soroban auth entry carried by the InvokeHostFunction
 * operations of a transaction (base64 XDR envelope — v1 or fee-bump). Returns the
 * signed envelope XDR.
 */
export async function signTransaction(txXdr: string, options: SorobanSignOptions): Promise<string> {
  const envelope = xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  for (const op of operationsForSigning(envelope)) {
    if (op.body().switch().name !== 'invokeHostFunction') continue;
    const entries = op.body().invokeHostFunctionOp().auth();
    for (const entry of entries) {
      if (entry.credentials().switch().name !== 'sorobanCredentialsAddress') continue;
      if (
        options.signerAddress !== undefined &&
        Address.fromScAddress(entry.credentials().address().address()).toString() !== options.signerAddress
      ) {
        continue;
      }
      await signEntryInPlace(entry, options);
    }
  }
  return envelope.toXDR('base64');
}
