import type { IndexerAdapter, SubmissionAdapter } from './types';
import { directSubmission } from './direct';
import { eventsIndexer } from './events';

export interface DefaultAdapterOptions {
  rpcUrl: string;
  networkPassphrase: string;
  factoryContractId: string;
  allowHttp?: boolean;
}

/** The zero-infra default stack: `direct` submission + `events` indexer. */
export function defaultAdapters(options: DefaultAdapterOptions): {
  submission: SubmissionAdapter;
  indexer: IndexerAdapter;
} {
  return {
    submission: directSubmission({
      rpcUrl: options.rpcUrl,
      networkPassphrase: options.networkPassphrase,
      allowHttp: options.allowHttp,
    }),
    indexer: eventsIndexer({
      rpcUrl: options.rpcUrl,
      factoryContractId: options.factoryContractId,
      allowHttp: options.allowHttp,
    }),
  };
}
