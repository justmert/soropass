import { sha256 } from '../internal/sha256';
import { bytesToHex } from '../internal/bytes';
import { utf8ToBytes } from '../internal/encoding';
import type { AccountDeployer } from '../ceremonies/types';
import type { IndexerAdapter, SubmissionAdapter } from '../adapters/types';

export interface InMemoryBackend {
  deployer: AccountDeployer;
  indexer: IndexerAdapter;
  submission: SubmissionAdapter;
  /** credentialId → { contractId, publicKey } — shared so create/connect/recover agree. */
  registry: Map<string, { contractId: string; publicKey: Uint8Array }>;
}

/**
 * Deterministic, zero-IO backend for the mock kit: the deployer derives a stable
 * C-address from the credentialId and records it; the indexer resolves from the
 * same registry; submission is a no-op SUCCESS.
 */
export function createInMemoryBackend(): InMemoryBackend {
  const registry = new Map<string, { contractId: string; publicKey: Uint8Array }>();
  let nonce = 0;
  return {
    registry,
    deployer: {
      deploy({ publicKey, credentialId }) {
        const digest = bytesToHex(sha256(utf8ToBytes('account:' + credentialId)));
        const contractId = 'C' + digest.slice(0, 55).toUpperCase();
        registry.set(credentialId, { contractId, publicKey });
        return Promise.resolve({ contractId, txHash: `mock-deploy-${String(nonce++)}` });
      },
    },
    indexer: {
      resolveByCredential(credentialId) {
        const account = registry.get(credentialId);
        return Promise.resolve(account ? [{ contractId: account.contractId }] : []);
      },
    },
    submission: {
      send: () => Promise.resolve({ status: 'SUCCESS', hash: 'mock-tx' }),
    },
  };
}
