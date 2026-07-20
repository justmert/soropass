import { rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import { KitError } from '../errors';
import type { SubmissionAdapter, SubmitResult } from './types';

export interface DirectSubmissionOptions {
  rpcUrl: string;
  networkPassphrase: string;
  allowHttp?: boolean;
  /** Max confirmation-poll attempts before failing with NETWORK_ERROR (default 30). */
  pollAttempts?: number;
  /** Delay between confirmation polls, in ms (default 1000). */
  pollIntervalMs?: number;
}

/**
 * Default, zero-infra submission: send straight to soroban-rpc and poll. No
 * relayer, no API key. Swappable with `launchtube`/`openzeppelinRelayer` with
 * zero ceremony changes (same `SubmissionAdapter` shape).
 */
export function directSubmission(options: DirectSubmissionOptions): SubmissionAdapter {
  const server = new rpc.Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
  });
  const attempts = options.pollAttempts ?? 30;
  const intervalMs = options.pollIntervalMs ?? 1000;
  return {
    async send(signedTxXdr: string): Promise<SubmitResult> {
      const tx = TransactionBuilder.fromXDR(signedTxXdr, options.networkPassphrase);
      let sent;
      try {
        sent = await server.sendTransaction(tx);
      } catch (cause) {
        throw new KitError('NETWORK_ERROR', 'failed to submit transaction to soroban-rpc', {
          cause,
        });
      }
      if (sent.status === 'ERROR') {
        return {
          status: 'FAILED',
          hash: sent.hash,
          errorResultXdr: sent.errorResult?.toXDR('base64'),
        };
      }
      // Bounded polling: give up (NETWORK_ERROR) instead of hanging forever.
      let final;
      try {
        final = await server.pollTransaction(sent.hash, {
          attempts,
          sleepStrategy: () => intervalMs,
        });
      } catch (cause) {
        throw new KitError(
          'NETWORK_ERROR',
          `transaction ${sent.hash} was not confirmed after ${String(attempts)} polls`,
          { cause },
        );
      }
      if (final.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        throw new KitError(
          'NETWORK_ERROR',
          `transaction ${sent.hash} still NOT_FOUND after ${String(attempts)} polls`,
        );
      }
      const success = final.status === rpc.Api.GetTransactionStatus.SUCCESS;
      return {
        status: success ? 'SUCCESS' : 'FAILED',
        hash: sent.hash,
        returnValue: success ? (final as { returnValue?: unknown }).returnValue : undefined,
      };
    },
  };
}
