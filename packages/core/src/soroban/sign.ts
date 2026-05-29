import { xdr } from '@stellar/stellar-sdk';
import { derToCompactLowS } from '../webauthn/signature';
import { authEntryChallenge } from './preimage';
import { applyAssertionToEntry } from './assemble';

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

export interface SorobanSignOptions {
  networkPassphrase: string;
  sign: WebAuthnSigner;
}

async function signEntryInPlace(
  entry: xdr.SorobanAuthorizationEntry,
  options: SorobanSignOptions,
): Promise<void> {
  const challenge = authEntryChallenge(entry, options.networkPassphrase);
  const assertion = await options.sign(challenge);
  const signature =
    assertion.signature.length === 64 ? assertion.signature : derToCompactLowS(assertion.signature);
  applyAssertionToEntry(entry, {
    credentialId: assertion.credentialId,
    authenticatorData: assertion.authenticatorData,
    clientDataJSON: assertion.clientDataJSON,
    signature,
  });
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
 * Sign every address-credential Soroban auth entry carried by the InvokeHostFunction
 * operations of a transaction (base64 XDR envelope). Returns the signed envelope XDR.
 */
export async function signTransaction(txXdr: string, options: SorobanSignOptions): Promise<string> {
  const envelope = xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  if (envelope.switch().name !== 'envelopeTypeTx') {
    throw new Error('signTransaction expects a v1 (envelopeTypeTx) transaction envelope');
  }
  const operations = envelope.v1().tx().operations();
  for (const op of operations) {
    if (op.body().switch().name !== 'invokeHostFunction') continue;
    const entries = op.body().invokeHostFunctionOp().auth();
    for (const entry of entries) {
      if (entry.credentials().switch().name !== 'sorobanCredentialsAddress') continue;
      await signEntryInPlace(entry, options);
    }
  }
  return envelope.toXDR('base64');
}
