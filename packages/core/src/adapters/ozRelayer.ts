import { httpPost, type RetryOptions } from './http';
import type { SubmissionAdapter, SubmitResult } from './types';

export interface OpenZeppelinRelayerOptions {
  url: string;
  apiKey?: string;
  /** Optional bounded retry on transient (429 / 5xx / network) failures. */
  retry?: RetryOptions;
}

interface RelayerResponse {
  hash?: string;
  status?: string;
  errorResultXdr?: string;
}

/**
 * OpenZeppelin Relayer / Channels submission (the post-Launchtube direction).
 * Same `SubmissionAdapter` shape, so swapping it in is a one-line config change.
 * A network failure surfaces as `KitError('NETWORK_ERROR')`; an HTTP error (or a
 * `status: "failed"` body) becomes a `FAILED` result.
 */
export function openzeppelinRelayerSubmission(
  options: OpenZeppelinRelayerOptions,
): SubmissionAdapter {
  return {
    async send(signedTxXdr: string): Promise<SubmitResult> {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (options.apiKey) headers['authorization'] = `Bearer ${options.apiKey}`;
      const response = await httpPost(
        options.url,
        { headers, body: JSON.stringify({ transaction_xdr: signedTxXdr }) },
        options.retry,
      );
      const body = (await response.json().catch(() => ({}))) as RelayerResponse;
      if (!response.ok || body.status === 'failed') {
        return { status: 'FAILED', hash: body.hash ?? '', errorResultXdr: body.errorResultXdr };
      }
      return { status: 'SUCCESS', hash: body.hash ?? '', returnValue: body };
    },
  };
}
