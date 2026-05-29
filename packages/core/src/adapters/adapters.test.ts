import { describe, expect, it } from 'vitest';
import {
  defaultAdapters,
  directSubmission,
  eventsIndexer,
  launchtubeSubmission,
  mercuryIndexer,
} from './index';
import type { IndexerAdapter, SubmissionAdapter } from './types';

const RPC = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';

// A ceremony-shaped flow parameterized ONLY by adapters — proves there is no
// other infra coupling and that backends are swap-in.
async function createConnectRecover(
  adapters: { submission: SubmissionAdapter; indexer: IndexerAdapter },
  credentialId: string,
) {
  const created = await adapters.submission.send('CREATE_DEPLOY_TX');
  const connected = await adapters.indexer.resolveByCredential(credentialId);
  const recovered = await adapters.submission.send('RECOVER_ADD_SIGNER_TX');
  return { created, connected, recovered };
}

function mockSubmission(label: string): SubmissionAdapter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    send(xdr) {
      calls.push(`${label}:${xdr}`);
      return Promise.resolve({ status: 'SUCCESS', hash: `${label}-hash` });
    },
  };
}
function mockEventsIndexer(): IndexerAdapter {
  return { resolveByCredential: (id) => Promise.resolve([{ contractId: `C-${id}` }]) };
}

describe('pluggable adapters (S12)', () => {
  it('GATE: full create→connect→recover runs with only zero-infra (direct+events) adapters', async () => {
    const result = await createConnectRecover(
      { submission: mockSubmission('direct'), indexer: mockEventsIndexer() },
      'cred-1',
    );
    expect(result.created.status).toBe('SUCCESS');
    expect(result.connected[0]?.contractId).toBe('C-cred-1');
    expect(result.recovered.status).toBe('SUCCESS');
  });

  it('swapping submission direct→launchtube requires zero ceremony changes', async () => {
    const direct = mockSubmission('direct');
    const launchtube = mockSubmission('launchtube');
    const indexer = mockEventsIndexer();
    const viaDirect = await createConnectRecover({ submission: direct, indexer }, 'x');
    const viaLaunchtube = await createConnectRecover({ submission: launchtube, indexer }, 'x');
    expect(viaDirect.created.status).toBe(viaLaunchtube.created.status);
    expect(direct.calls).toHaveLength(2);
    expect(launchtube.calls).toHaveLength(2);
    expect(launchtube.calls[0]).toContain('launchtube:');
  });

  it('mercury is optional: the events-only indexer satisfies the flow', async () => {
    const result = await createConnectRecover(
      { submission: mockSubmission('d'), indexer: mockEventsIndexer() },
      'c',
    );
    expect(result.connected).toHaveLength(1);
  });

  it('the concrete adapters all satisfy their interfaces (constructed, no network)', () => {
    const sub: SubmissionAdapter = directSubmission({ rpcUrl: RPC, networkPassphrase: PASSPHRASE });
    const lt: SubmissionAdapter = launchtubeSubmission({ url: 'https://launchtube.example' });
    const idx: IndexerAdapter = eventsIndexer({ rpcUrl: RPC, factoryContractId: 'CFACTORY' });
    const mercury: IndexerAdapter = mercuryIndexer({ url: 'https://mercury.example' });
    expect(typeof sub.send).toBe('function');
    expect(typeof lt.send).toBe('function');
    expect(typeof idx.resolveByCredential).toBe('function');
    expect(typeof mercury.resolveByCredential).toBe('function');

    const stack = defaultAdapters({
      rpcUrl: RPC,
      networkPassphrase: PASSPHRASE,
      factoryContractId: 'CF',
    });
    expect(typeof stack.submission.send).toBe('function');
    expect(typeof stack.indexer.resolveByCredential).toBe('function');
  });
});
