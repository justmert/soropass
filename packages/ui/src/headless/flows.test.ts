import { describe, expect, it } from 'vitest';
import { KitError } from '@stellar-passkey/core/types';
import type { PasskeyCredential, SubmitResult } from '@stellar-passkey/core/types';
import type { RecoverResult } from '@stellar-passkey/core/recover';
import { createCreatePasskeyFlow } from './createFlow';
import { createSignFlow } from './signFlow';
import { createRecoverFlow } from './recoverFlow';

const CRED: PasskeyCredential = {
  contractId: 'CACCOUNT',
  credentialId: 'cred-1',
  publicKey: new Uint8Array(65),
};

function track<S extends { status: string }>(flow: { subscribe(l: (s: S) => void): () => void }) {
  const seen: string[] = [];
  flow.subscribe((s) => seen.push(s.status));
  return seen;
}

describe('createCreatePasskeyFlow (S18)', () => {
  it('idle → prompting → deploying → success; no CSS, a11y props correct', async () => {
    const flow = createCreatePasskeyFlow({
      create: (_input, report) => {
        report.deploying();
        return Promise.resolve(CRED);
      },
    });
    expect(flow.getState().status).toBe('idle');
    expect(flow.getTriggerProps()['aria-busy']).toBe(false);
    const seen = track(flow);
    await flow.start({ userName: 'alice' });
    expect(seen).toEqual(['prompting', 'deploying', 'success']);
    const state = flow.getState();
    expect(state.status === 'success' && state.credential.contractId).toBe('CACCOUNT');
    const status = flow.getStatusProps();
    expect(status.role).toBe('status');
    expect(status['aria-live']).toBe('polite');
    expect(status.children).toBe('Passkey created');
  });

  it('surfaces KitErrorCode + assertive live region on failure', async () => {
    const flow = createCreatePasskeyFlow({
      create: () => Promise.reject(new KitError('CONTRACT_AUTH_FAILED', 'boom')),
    });
    await flow.start();
    const state = flow.getState();
    expect(state.status === 'error' && state.code).toBe('CONTRACT_AUTH_FAILED');
    expect(flow.getStatusProps()['aria-live']).toBe('assertive');
    expect(flow.getStatusProps().children).toBe('The network rejected the authorization.');
  });

  it('enforces the user-gesture rule (S04) — start without activation never calls create', async () => {
    let calls = 0;
    const flow = createCreatePasskeyFlow({
      create: () => {
        calls += 1;
        return Promise.resolve(CRED);
      },
      userActivation: { isActive: false },
    });
    await flow.start();
    expect(calls).toBe(0);
    const state = flow.getState();
    expect(state.status === 'error' && state.code).toBe('USER_CANCELLED');
  });

  it('uses an injected translate for i18n', async () => {
    const flow = createCreatePasskeyFlow({
      create: () => Promise.resolve(CRED),
      translate: (key) => `T:${key}`,
    });
    await flow.start();
    expect(flow.getStatusProps().children).toBe('T:passkey.create.success');
  });
});

describe('createSignFlow (S18)', () => {
  const ok: SubmitResult = { status: 'SUCCESS', hash: 'h' };
  it('idle → prompting → submitting → done', async () => {
    const flow = createSignFlow({
      sign: () => Promise.resolve('XDR'),
      submit: () => Promise.resolve(ok),
    });
    const seen = track(flow);
    await flow.start();
    expect(seen).toEqual(['prompting', 'submitting', 'done']);
    expect(flow.getState().status).toBe('done');
  });
  it('maps a FAILED submission to CONTRACT_AUTH_FAILED', async () => {
    const flow = createSignFlow({
      sign: () => Promise.resolve('XDR'),
      submit: () => Promise.resolve({ status: 'FAILED', hash: 'h' }),
    });
    await flow.start();
    const state = flow.getState();
    expect(state.status === 'error' && state.code).toBe('CONTRACT_AUTH_FAILED');
  });
});

describe('createRecoverFlow (S18)', () => {
  const accounts: RecoverResult[] = [
    { contractId: 'C1', credentialId: 'k' },
    { contractId: 'C2', credentialId: 'k' },
  ];
  it('idle → discovering → resolved → selected', async () => {
    const flow = createRecoverFlow({ recover: () => Promise.resolve(accounts) });
    const seen = track(flow);
    await flow.start();
    expect(seen).toEqual(['discovering', 'resolved']);
    const first = accounts[0];
    if (!first) throw new Error('no account');
    flow.select(first);
    const state = flow.getState();
    expect(state.status === 'selected' && state.account.contractId).toBe('C1');
    expect(flow.getListProps().role).toBe('listbox');
    expect(flow.getOptionProps(first, 0)['aria-selected']).toBe(true);
  });
  it('resolves to "none" when no accounts are found', async () => {
    const flow = createRecoverFlow({ recover: () => Promise.resolve([]) });
    await flow.start();
    expect(flow.getState().status).toBe('none');
  });
  it('allows re-selecting a different account from the selected state', async () => {
    const flow = createRecoverFlow({ recover: () => Promise.resolve(accounts) });
    await flow.start();
    const [a, b] = accounts;
    if (!a || !b) throw new Error('no account');
    flow.select(a);
    expect(flow.getState().status).toBe('selected');
    flow.select(b); // re-select while already in selected
    const state = flow.getState();
    expect(state.status === 'selected' && state.account.contractId).toBe('C2');
  });
});
