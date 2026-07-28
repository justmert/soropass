import { KitError } from '../errors';
import { httpPost, type RetryOptions } from './http';
import type { IndexerAdapter, ResolvedAccount } from './types';

export interface MercuryIndexerOptions {
  url: string;
  token?: string;
  /** Map the Mercury/Zephyr JSON response → resolved accounts. */
  parse?: (json: unknown) => ResolvedAccount[];
  /** Optional bounded retry on transient (429 / 5xx / network) failures. */
  retry?: RetryOptions;
}

/**
 * Optional Mercury (Zephyr) indexer. Entirely optional — `events` is the
 * zero-infra default and the SDK never requires Mercury. A network failure
 * surfaces as `KitError('NETWORK_ERROR')`; an HTTP error throws
 * `NETWORK_ERROR` too, so a server error is never silently read as "no accounts".
 */
export function mercuryIndexer(options: MercuryIndexerOptions): IndexerAdapter {
  const parse =
    options.parse ??
    ((json: unknown): ResolvedAccount[] => {
      const rows = (json as { accounts?: { contractId?: string }[] }).accounts ?? [];
      return rows.flatMap((r) => (r.contractId ? [{ contractId: r.contractId }] : []));
    });
  return {
    async resolveByCredential(credentialId: string): Promise<ResolvedAccount[]> {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (options.token) headers['authorization'] = `Bearer ${options.token}`;
      const response = await httpPost(
        options.url,
        { headers, body: JSON.stringify({ credentialId }) },
        options.retry,
      );
      if (!response.ok) {
        throw new KitError(
          'NETWORK_ERROR',
          `mercury indexer returned HTTP ${String(response.status)}`,
        );
      }
      return parse(await response.json().catch(() => ({})));
    },
  };
}
