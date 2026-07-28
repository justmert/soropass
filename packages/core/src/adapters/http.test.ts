import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchtubeSubmission, mercuryIndexer, openzeppelinRelayerSubmission } from './index';
import { isKitError } from '../errors';

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  const status = init?.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('launchtubeSubmission (hardened)', () => {
  it('returns SUCCESS with the tx hash on ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ hash: 'abc' })));
    const r = await launchtubeSubmission({ url: 'https://lt.example' }).send('XDR');
    expect(r.status).toBe('SUCCESS');
    expect(r.hash).toBe('abc');
  });

  it('returns FAILED on an HTTP error, preserving errorResultXdr', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ errorResultXdr: 'ERR' }, { status: 400 })),
    );
    const r = await launchtubeSubmission({ url: 'https://lt.example' }).send('XDR');
    expect(r.status).toBe('FAILED');
    expect(r.errorResultXdr).toBe('ERR');
  });

  it('throws KitError NETWORK_ERROR when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    try {
      await launchtubeSubmission({ url: 'https://lt.example' }).send('XDR');
      expect.unreachable();
    } catch (e) {
      expect(isKitError(e) && e.code).toBe('NETWORK_ERROR');
    }
  });

  it('retries a transient 503, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ hash: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await launchtubeSubmission({
      url: 'https://lt.example',
      retry: { retries: 2, backoffMs: 0 },
    }).send('XDR');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('SUCCESS');
    expect(r.hash).toBe('ok');
  });
});

describe('openzeppelinRelayerSubmission (hardened)', () => {
  it('maps a status:"failed" body to FAILED even on HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ status: 'failed', hash: 'h' })),
    );
    const r = await openzeppelinRelayerSubmission({ url: 'https://oz.example' }).send('XDR');
    expect(r.status).toBe('FAILED');
    expect(r.hash).toBe('h');
  });

  it('returns SUCCESS on an ok relayer response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ hash: 'h', status: 'submitted' })),
    );
    const r = await openzeppelinRelayerSubmission({ url: 'https://oz.example' }).send('XDR');
    expect(r.status).toBe('SUCCESS');
  });
});

describe('mercuryIndexer (hardened)', () => {
  it('parses accounts on ok (skipping rows without a contractId)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ accounts: [{ contractId: 'C1' }, {}] })),
    );
    const r = await mercuryIndexer({ url: 'https://m.example' }).resolveByCredential('cred');
    expect(r).toEqual([{ contractId: 'C1' }]);
  });

  it('throws NETWORK_ERROR on an HTTP error (never silently empty)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 502 })));
    try {
      await mercuryIndexer({ url: 'https://m.example' }).resolveByCredential('cred');
      expect.unreachable();
    } catch (e) {
      expect(isKitError(e) && e.code).toBe('NETWORK_ERROR');
    }
  });

  it('honors a custom parse function', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: ['CX'] })));
    const r = await mercuryIndexer({
      url: 'https://m.example',
      parse: (j) => (j as { data: string[] }).data.map((contractId) => ({ contractId })),
    }).resolveByCredential('cred');
    expect(r).toEqual([{ contractId: 'CX' }]);
  });
});
