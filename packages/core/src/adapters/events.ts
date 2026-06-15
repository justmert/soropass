import { rpc, scValToNative } from '@stellar/stellar-sdk';
import type { IndexerAdapter, ResolvedAccount } from './types';

function decodeNative(scv: unknown): unknown {
  try {
    return scValToNative(scv as never);
  } catch {
    return undefined;
  }
}

export interface EventsIndexerOptions {
  rpcUrl: string;
  /** The passkey factory contract that emits an `add`/deploy event per account. */
  factoryContractId: string;
  /** Ledger to scan from; defaults to ~1 day back from the latest ledger. */
  startLedger?: number;
  allowHttp?: boolean;
  /**
   * Map a factory event → resolved account when it concerns `credentialId`.
   * Defaults to the deployed `AccountFactory` schema (see contracts/account-factory):
   * topics `[symbol "deployed", bytes credentialId]`, value = the deployed C-address.
   * Override only for a different factory event shape.
   */
  matchEvent?: (event: rpc.Api.EventResponse, credentialId: string) => ResolvedAccount | null;
}

const LEDGERS_PER_DAY = 17_280; // ~5s ledgers

/**
 * Parse the `AccountFactory.deploy` event `('deployed', credentialId) -> address`:
 * confirm the second topic (credential-id bytes, utf-8) equals `credentialId` and
 * resolve to the deployed account address carried in the event value. Falls back
 * to a raw-XDR scan if the topics aren't in the expected shape.
 */
function defaultMatch(event: rpc.Api.EventResponse, credentialId: string): ResolvedAccount | null {
  try {
    const topics = event.topic ?? [];
    if (topics.length >= 2) {
      const tag = decodeNative(topics[0]);
      const credRaw = decodeNative(topics[1]);
      const cred = credRaw instanceof Uint8Array ? new TextDecoder().decode(credRaw) : String(credRaw ?? '');
      if (tag === 'deployed' && cred === credentialId) {
        const addr = decodeNative(event.value);
        if (typeof addr === 'string' && addr.startsWith('C')) return { contractId: addr };
      }
    }
    // Fallback: scan the raw XDR for the credential id; prefer the deployed
    // address in the value, else the emitting contract.
    const haystack = [event.value, ...topics].map((v) => v.toXDR('base64')).join('|');
    if (!haystack.includes(credentialId)) return null;
    const addr = decodeNative(event.value);
    if (typeof addr === 'string' && addr.startsWith('C')) return { contractId: addr };
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
