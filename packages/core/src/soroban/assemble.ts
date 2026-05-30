import { xdr } from '@stellar/stellar-sdk';
import type { AssertionResult } from './sign';

/**
 * Set an address-credential auth entry's signature to the `Secp256r1Signature`
 * struct the on-chain `__check_auth` consumes:
 *
 *   ScVal::Map { authenticator_data: Bytes, client_data_json: Bytes, signature: BytesN<64> }
 *
 * Map keys are alphabetical, so the ScMap is canonically sorted as Soroban
 * requires. `signature` MUST already be 64-byte low-S compact (`signAuthEntry`
 * normalizes before calling this). This is the exact shape the audited
 * webauthn-verifier reference expects — proven on testnet by the on-chain
 * integration test (scripts/onchain-e2e.ts).
 */
export function applyAssertionToEntry(
  entry: xdr.SorobanAuthorizationEntry,
  assertion: AssertionResult,
): xdr.SorobanAuthorizationEntry {
  entry.credentials().address().signature(buildSignatureScVal(assertion));
  return entry;
}

/** The `Secp256r1Signature` ScVal — a contracttype struct → sorted ScMap. */
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
