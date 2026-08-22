/**
 * S12 (YK-438) — the two adapter interfaces. The ONLY infra coupling points, so
 * the SDK is composable, not monolithic. Ceremonies (S13) depend on these
 * interfaces, never on a concrete backend.
 */

export interface SubmitResult {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  /** Transaction hash (hex), when known. */
  hash: string;
  /** Decoded contract return value on success (implementation-defined). */
  returnValue?: unknown;
  /** base64 XDR of the failure result, when failed. */
  errorResultXdr?: string;
}

/** How a signed operation reaches the network. */
export interface SubmissionAdapter {
  send(signedTxXdr: string): Promise<SubmitResult>;
}

export interface ResolvedAccount {
  /** Soroban smart-account C-address. */
  contractId: string;
  /**
   * SEC-1 (65-byte) public key the factory's `deployed` event reported as this
   * account's founding signer, when available. `deploy` is permissionless and a
   * credential id is not exclusive, so a credential can resolve to more than one
   * candidate; compare this against the user's own key (or re-derive the address
   * with `deriveAccountAddress`) before trusting a resolved account with funds.
   */
  publicKey?: Uint8Array;
}

/** credentialId → smart-account address lookup. */
export interface IndexerAdapter {
  resolveByCredential(credentialId: string): Promise<ResolvedAccount[]>;
}
