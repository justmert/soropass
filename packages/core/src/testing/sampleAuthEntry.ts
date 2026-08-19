import { Address, xdr } from '@stellar/stellar-sdk';

/**
 * A ready-to-sign `SorobanAuthorizationEntry` (base64 XDR) for a demo call on
 * `contractId`. A convenience for smoke tests and examples, so you do not hand-
 * build auth-entry XDR just to have something to sign. The nonce and expiration
 * are fixed placeholders, so this is for local verification, not production.
 */
export function sampleAuthEntry(contractId: string, functionName = 'protected'): string {
  const address = new Address(contractId).toScAddress();
  const entry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address,
        nonce: new xdr.Int64(1),
        signatureExpirationLedger: 1000,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({ contractAddress: address, functionName, args: [] }),
      ),
      subInvocations: [],
    }),
  });
  return entry.toXDR('base64');
}
