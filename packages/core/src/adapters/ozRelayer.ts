import type { SubmissionAdapter, SubmitResult } from './types';

export interface OpenZeppelinRelayerOptions {
  url: string;
  apiKey?: string;
}

/**
 * OpenZeppelin Relayer / Channels submission (the post-Launchtube direction).
 * Same `SubmissionAdapter` shape, so swapping it in is a one-line config change.
 */
export function openzeppelinRelayerSubmission(
  options: OpenZeppelinRelayerOptions,
): SubmissionAdapter {
  return {
    async send(signedTxXdr: string): Promise<SubmitResult> {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (options.apiKey) headers['authorization'] = `Bearer ${options.apiKey}`;
      const response = await fetch(options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_xdr: signedTxXdr }),
      });
      const body = (await response.json().catch(() => ({}))) as { hash?: string; status?: string };
      return {
        status: response.ok ? (body.status === 'failed' ? 'FAILED' : 'SUCCESS') : 'FAILED',
        hash: body.hash ?? '',
      };
    },
  };
}
