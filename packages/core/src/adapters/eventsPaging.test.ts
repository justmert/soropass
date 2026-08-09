import { describe, expect, it, vi } from 'vitest';
import type { rpc } from '@stellar/stellar-sdk';
import { collectEventsToTip, cursorLedger, parseOldestLedger } from './eventsPaging';

/** Build a fake EventResponse carrying just a contractId (all the helper reads). */
function ev(contractId: string, ledger: number): rpc.Api.EventResponse {
  return { contractId: { toString: () => contractId }, ledger } as unknown as rpc.Api.EventResponse;
}

/** A cursor whose encoded ledger is `ledger` (TOID = ledger << 32). */
function cursorAt(ledger: number): string {
  return `${(BigInt(ledger) << 32n).toString()}-0`;
}

function page(
  events: rpc.Api.EventResponse[],
  cursor: string,
  latestLedger: number,
): rpc.Api.GetEventsResponse {
  return { events, cursor, latestLedger } as unknown as rpc.Api.GetEventsResponse;
}

describe('cursorLedger', () => {
  it('decodes the ledger from a TOID cursor', () => {
    expect(cursorLedger(cursorAt(4_054_918))).toBe(4_054_918);
  });
  it('returns null on a malformed cursor', () => {
    expect(cursorLedger('not-a-cursor')).toBeNull();
  });
});

describe('parseOldestLedger', () => {
  it('extracts the floor from the RPC range error (Error or plain object)', () => {
    const msg = 'startLedger must be within the ledger range: 3933976 - 4054935';
    expect(parseOldestLedger(new Error(msg))).toBe(3_933_976);
    expect(parseOldestLedger({ message: msg })).toBe(3_933_976);
  });
  it('returns null when there is no range', () => {
    expect(parseOldestLedger(new Error('boom'))).toBeNull();
  });
});

describe('collectEventsToTip', () => {
  it('follows the cursor past an empty first page to reach an event near the tip', async () => {
    // Regression for the recovery bug: the founding event sits ~17k ledgers ahead
    // of startLedger, past the first bounded scan slice. One-shot missed it.
    const latest = 4_054_960;
    const getEvents = vi
      .fn<rpc.Server['getEvents']>()
      // page 1: startLedger range mode, empty, cursor mid-window
      .mockResolvedValueOnce(page([], cursorAt(4_046_000), latest))
      // page 2: cursor mode, the event, cursor at tip → loop stops
      .mockResolvedValueOnce(page([ev('CWALLET', 4_054_918)], cursorAt(latest), latest));

    const events = await collectEventsToTip(
      { getEvents } as never,
      [{ type: 'contract' }],
      latest - 17_280,
    );

    expect(getEvents).toHaveBeenCalledTimes(2);
    // first call is range mode, second is cursor mode
    expect(getEvents.mock.calls[0]![0]).toMatchObject({ startLedger: latest - 17_280 });
    expect(getEvents.mock.calls[1]![0]).toMatchObject({ cursor: cursorAt(4_046_000) });
    expect(events.map((e) => e.contractId?.toString())).toEqual(['CWALLET']);
  });

  it('stops when the cursor stops advancing (steady state at the tip)', async () => {
    const latest = 1000;
    const stuck = cursorAt(latest);
    const getEvents = vi.fn<rpc.Server['getEvents']>().mockResolvedValue(page([], stuck, latest));
    const events = await collectEventsToTip({ getEvents } as never, [{ type: 'contract' }], 900);
    // first page returns the tip cursor → scanned >= latest → one call only
    expect(getEvents).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });

  it('clamps startLedger inside the window on an out-of-range error, then scans', async () => {
    const latest = 5000;
    const getEvents = vi
      .fn<rpc.Server['getEvents']>()
      .mockRejectedValueOnce(new Error('startLedger must be within the ledger range: 4000 - 5000'))
      .mockResolvedValueOnce(page([ev('CFOUND', 4900)], cursorAt(latest), latest));

    const events = await collectEventsToTip({ getEvents } as never, [{ type: 'contract' }], 1);

    expect(getEvents).toHaveBeenCalledTimes(2);
    // retried just inside the reported floor (4000 + 2)
    expect(getEvents.mock.calls[1]![0]).toMatchObject({ startLedger: 4002 });
    expect(events.map((e) => e.contractId?.toString())).toEqual(['CFOUND']);
  });

  it('rethrows a non-range error', async () => {
    const getEvents = vi
      .fn<rpc.Server['getEvents']>()
      .mockRejectedValueOnce(new Error('network down'));
    await expect(
      collectEventsToTip({ getEvents } as never, [{ type: 'contract' }], 10),
    ).rejects.toThrow('network down');
  });
});
