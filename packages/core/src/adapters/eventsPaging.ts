import type { rpc } from '@stellar/stellar-sdk';

/**
 * Shared soroban-rpc `getEvents` pagination.
 *
 * A single `getEvents` call scans only a BOUNDED ledger slice from `startLedger`
 * (not the whole retained window) and returns a `cursor`; a naive one-shot query
 * therefore misses events near the tip. That is precisely why recovering a
 * just-created wallet found nothing: the founding `signer_added` sat ~17k ledgers
 * ahead of `latest - 1 day`, past the first page. `collectEventsToTip` follows the
 * cursor from `startLedger` to the chain tip and returns every matched event.
 */

export const EVENTS_PAGE_LIMIT = 10_000; // soroban-rpc max page size
export const MAX_EVENT_PAGES = 40; // safety backstop; ~1 day is 2-3 pages

/** Decode the ledger sequence out of a getEvents paging cursor (`<toid>-<index>`);
 *  the TOID's top 32 bits are the ledger. Returns `null` if the shape is unexpected. */
export function cursorLedger(cursor: string): number | null {
  try {
    const toid = cursor.split('-')[0];
    if (!toid) return null;
    return Number(BigInt(toid) >> 32n);
  } catch {
    return null;
  }
}

/** Parse the retained window floor out of the RPC's out-of-range error, e.g.
 *  "startLedger must be within the ledger range: 3933976 - 4054935". */
export function parseOldestLedger(error: unknown): number | null {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : error;
  const message = typeof raw === 'string' ? raw : String(raw);
  const match = /ledger range:\s*(\d+)\s*-\s*\d+/.exec(message);
  return match ? Number(match[1]) : null;
}

type EventsServer = Pick<rpc.Server, 'getEvents'>;

/**
 * Page through `getEvents` from `startLedger` to the tip, returning all events.
 * If `startLedger` predates the retained window, clamps just inside the reported
 * floor (+2 absorbs the window advancing mid-round-trip and an exclusive bound)
 * and retries. Bounded by {@link MAX_EVENT_PAGES}.
 */
export async function collectEventsToTip(
  server: EventsServer,
  filters: rpc.Api.EventFilter[],
  startLedger: number,
): Promise<rpc.Api.EventResponse[]> {
  const events: rpc.Api.EventResponse[] = [];
  let start = startLedger;
  let cursor: string | undefined;
  let previousCursor: string | undefined;

  for (let page = 0; page < MAX_EVENT_PAGES; page++) {
    let response: rpc.Api.GetEventsResponse;
    try {
      response = await server.getEvents(
        cursor
          ? { filters, cursor, limit: EVENTS_PAGE_LIMIT }
          : { filters, startLedger: start, limit: EVENTS_PAGE_LIMIT },
      );
    } catch (error) {
      const oldest = parseOldestLedger(error);
      if (!cursor && oldest != null && start <= oldest) {
        start = oldest + 2;
        continue;
      }
      throw error;
    }
    events.push(...response.events);
    previousCursor = cursor;
    cursor = response.cursor;
    // Stop once the scan reaches the tip, the cursor stops advancing, or it is gone.
    if (!cursor || cursor === previousCursor) break;
    const scanned = cursorLedger(cursor);
    if (scanned != null && scanned >= response.latestLedger) break;
  }
  return events;
}
