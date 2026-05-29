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
}

/** credentialId → smart-account address lookup. */
export interface IndexerAdapter {
  resolveByCredential(credentialId: string): Promise<ResolvedAccount[]>;
}
