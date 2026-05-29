import type { SubmissionAdapter, SubmitResult } from './types';

export interface LaunchtubeSubmissionOptions {
  url: string;
  /** Bearer token (Launchtube is invite/credit-gated). */
  token?: string;
}

/**
 * Legacy Launchtube relay (optional). Modelled as ONE submission adapter — the
 * SDK does not depend on it; `direct` is the default and `openzeppelinRelayer`
 * is the post-Launchtube direction.
 */
export function launchtubeSubmission(options: LaunchtubeSubmissionOptions): SubmissionAdapter {
  return {
    async send(signedTxXdr: string): Promise<SubmitResult> {
      const headers: Record<string, string> = {
        'content-type': 'application/x-www-form-urlencoded',
      };
      if (options.token) headers['authorization'] = `Bearer ${options.token}`;
      const response = await fetch(options.url, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ xdr: signedTxXdr }).toString(),
      });
      const body = (await response.json().catch(() => ({}))) as { hash?: string };
      return { status: response.ok ? 'SUCCESS' : 'FAILED', hash: body.hash ?? '' };
    },
  };
}
