import { rpc } from '@stellar/stellar-sdk';
import type { IndexerAdapter, ResolvedAccount } from './types';

export interface EventsIndexerOptions {
  rpcUrl: string;
  /** The passkey factory contract that emits an `add`/deploy event per account. */
  factoryContractId: string;
  /** Ledger to scan from; defaults to ~1 day back from the latest ledger. */
  startLedger?: number;
  allowHttp?: boolean;
  /**
   * Map a factory event → resolved account when it concerns `credentialId`.
   * The default is best-effort (scans the event XDR for the credentialId and
   * returns the emitting contract); the exact factory event schema is wired in
   * S17 against the deployed contract.
   */
  matchEvent?: (event: rpc.Api.EventResponse, credentialId: string) => ResolvedAccount | null;
}

const LEDGERS_PER_DAY = 17_280; // ~5s ledgers

function defaultMatch(event: rpc.Api.EventResponse, credentialId: string): ResolvedAccount | null {
  try {
    const haystack = [event.value, ...event.topic].map((v) => v.toXDR('base64')).join('|');
    if (!haystack.includes(credentialId)) return null;
    return event.contractId ? { contractId: event.contractId.toString() } : null;
  } catch {
    return null;
  }
}

/**
 * Default, zero-infra indexer: soroban-rpc `getEvents` filtered on the factory
 * contract — no external indexing service. `mercury` is an optional alternative;
 * the SDK works with `events` alone.
 */
export function eventsIndexer(options: EventsIndexerOptions): IndexerAdapter {
  const server = new rpc.Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
  });
  const match = options.matchEvent ?? defaultMatch;
  return {
    async resolveByCredential(credentialId: string): Promise<ResolvedAccount[]> {
      const startLedger =
        options.startLedger ??
        Math.max(1, (await server.getLatestLedger()).sequence - LEDGERS_PER_DAY);
      const response = await server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [options.factoryContractId] }],
      });
      const accounts: ResolvedAccount[] = [];
      for (const event of response.events) {
        const resolved = match(event, credentialId);
        if (resolved) accounts.push(resolved);
      }
      return accounts;
    },
  };
}
