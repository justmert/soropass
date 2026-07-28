import { httpPost, type RetryOptions } from './http';
import type { SubmissionAdapter, SubmitResult } from './types';

export interface LaunchtubeSubmissionOptions {
  url: string;
  /** Bearer token (Launchtube is invite/credit-gated). */
  token?: string;
  /** Optional bounded retry on transient (429 / 5xx / network) failures. */
  retry?: RetryOptions;
}

interface LaunchtubeResponse {
  hash?: string;
  status?: string;
  error?: string;
  errorResultXdr?: string;
}

/**
 * Legacy Launchtube relay (optional). Modelled as ONE submission adapter — the
 * SDK does not depend on it; `direct` is the default and `openzeppelinRelayer`
 * is the post-Launchtube direction. A network failure surfaces as a typed
 * `KitError('NETWORK_ERROR')`; an HTTP error becomes a `FAILED` result carrying
 * the relay's error body.
 */
export function launchtubeSubmission(options: LaunchtubeSubmissionOptions): SubmissionAdapter {
  return {
    async send(signedTxXdr: string): Promise<SubmitResult> {
      const headers: Record<string, string> = {
        'content-type': 'application/x-www-form-urlencoded',
      };
      if (options.token) headers['authorization'] = `Bearer ${options.token}`;
      const response = await httpPost(
        options.url,
        { headers, body: new URLSearchParams({ xdr: signedTxXdr }).toString() },
        options.retry,
      );
      const body = (await response.json().catch(() => ({}))) as LaunchtubeResponse;
      if (!response.ok || body.status === 'FAILED' || body.error) {
        return { status: 'FAILED', hash: body.hash ?? '', errorResultXdr: body.errorResultXdr };
      }
      return { status: 'SUCCESS', hash: body.hash ?? '', returnValue: body };
    },
  };
}
