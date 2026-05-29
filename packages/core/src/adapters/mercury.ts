import type { IndexerAdapter, ResolvedAccount } from './types';

export interface MercuryIndexerOptions {
  url: string;
  token?: string;
  /** Map the Mercury/Zephyr JSON response → resolved accounts. */
  parse?: (json: unknown) => ResolvedAccount[];
}

/**
 * Optional Mercury (Zephyr) indexer. Entirely optional — `events` is the
 * zero-infra default and the SDK never requires Mercury.
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
      const response = await fetch(options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ credentialId }),
      });
      return parse(await response.json().catch(() => ({})));
    },
  };
}
