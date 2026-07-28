import { KitError } from '../errors';

/**
 * Bounded retry/backoff for the optional HTTP adapters (Launchtube / OZ Relayer /
 * Mercury). Opt-in: `retries` defaults to 1 (no retry), preserving the plain
 * single-shot behavior unless a caller asks for resilience.
 */
export interface RetryOptions {
  /** Total attempts including the first (default 1 = no retry). */
  retries?: number;
  /** Linear backoff base in ms; attempt N waits `backoffMs * N` (default 300). */
  backoffMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/** A transient status worth retrying: rate-limit or any server error. */
function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * POST with typed failure semantics: a thrown fetch (DNS/connection/abort) after
 * the last attempt becomes `KitError('NETWORK_ERROR')`; a transient HTTP status
 * (429 / 5xx) is retried up to `retries`, then the response is returned for the
 * caller to interpret (so the failure body is preserved). Non-transient responses
 * return immediately.
 */
export async function httpPost(
  url: string,
  init: { headers?: Record<string, string>; body?: string },
  retry?: RetryOptions,
): Promise<Response> {
  const attempts = Math.max(1, retry?.retries ?? 1);
  const backoffMs = retry?.backoffMs ?? 300;
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: init.headers,
        body: init.body,
      });
      if (isTransientStatus(response.status) && i < attempts) {
        await sleep(backoffMs * i);
        continue;
      }
      return response;
    } catch (cause) {
      if (i < attempts) {
        await sleep(backoffMs * i);
        continue;
      }
      throw new KitError('NETWORK_ERROR', `POST to ${url} failed`, { cause });
    }
  }
  // Unreachable (the loop always returns or throws), but keeps the type total.
  throw new KitError('NETWORK_ERROR', `POST to ${url} failed`);
}
