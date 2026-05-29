import { rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import type { SubmissionAdapter, SubmitResult } from './types';

export interface DirectSubmissionOptions {
  rpcUrl: string;
  networkPassphrase: string;
  allowHttp?: boolean;
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
  return {
    async send(signedTxXdr: string): Promise<SubmitResult> {
      const tx = TransactionBuilder.fromXDR(signedTxXdr, options.networkPassphrase);
      const sent = await server.sendTransaction(tx);
      if (sent.status === 'ERROR') {
        return {
          status: 'FAILED',
          hash: sent.hash,
          errorResultXdr: sent.errorResult?.toXDR('base64'),
        };
      }
      const final = await server.pollTransaction(sent.hash);
      const success = final.status === rpc.Api.GetTransactionStatus.SUCCESS;
      return {
        status: success ? 'SUCCESS' : 'FAILED',
        hash: sent.hash,
        returnValue: success ? (final as { returnValue?: unknown }).returnValue : undefined,
      };
    },
  };
}
