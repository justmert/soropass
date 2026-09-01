import { StrKey } from '@stellar/stellar-sdk';
import { sha256 } from '../internal/sha256';
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
 *
 * The address is a real StrKey contract id (checksummed, decodable), so a mock
 * account can be fed straight into `new Address(...)` / auth-entry XDR the same way
 * a deployed one is. It is deterministic but arbitrary: it is not the address the
 * factory would deploy for this credential (that is {@link deriveAccountAddress}).
 */
export function createInMemoryBackend(): InMemoryBackend {
  const registry = new Map<string, { contractId: string; publicKey: Uint8Array }>();
  let nonce = 0;
  return {
    registry,
    deployer: {
      deploy({ publicKey, credentialId }) {
        const contractId = StrKey.encodeContract(sha256(utf8ToBytes('account:' + credentialId)));
        registry.set(credentialId, { contractId, publicKey });
        return Promise.resolve({ contractId, txHash: `mock-deploy-${String(nonce++)}` });
      },
    },
    indexer: {
      resolveByCredential(credentialId) {
        const account = registry.get(credentialId);
        // Carry the founding public key the same way the real `eventsIndexer` reads it
        // off the factory `deployed` event, so mock-mode connect/recover can verify
        // enrollment and recover the signing key (no mock/live divergence).
        return Promise.resolve(
          account ? [{ contractId: account.contractId, publicKey: account.publicKey }] : [],
        );
      },
    },
    submission: {
      send: () => Promise.resolve({ status: 'SUCCESS', hash: 'mock-tx' }),
    },
  };
}
