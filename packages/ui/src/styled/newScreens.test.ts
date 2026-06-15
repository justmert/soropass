// @vitest-environment jsdom
/**
 * Connect + Add-device — the two new shipping components. Verifies the views
 * render the right structure per state and the add-device flow walks its state
 * machine, the same standard as create/sign/recover.
 */
import { describe, it, expect } from 'vitest';
import {
  connectView,
  addDeviceView,
  DEFAULT_CONNECT_COPY,
  DEFAULT_ADDDEVICE_COPY,
  type ConnectCtx,
  type AddDeviceCtx,
} from './index';
import { createAddDeviceFlow } from '../headless';

const connectCtx: ConnectCtx = {
  copy: DEFAULT_CONNECT_COPY,
  onCreate: () => {},
  onUseExisting: () => {},
  onHelp: () => {},
};
const addCtx: AddDeviceCtx = {
  copy: DEFAULT_ADDDEVICE_COPY,
  onAdd: () => {},
  onCancel: () => {},
  onRetry: () => {},
  onDone: () => {},
};

describe('connectView', () => {
  it('renders the chooser: two choice rows + a help link', () => {
    const el = connectView(connectCtx);
    expect(el.getAttribute('data-pk-screen')).toBe('connect');
    expect(el.querySelectorAll('.pk-choice')).toHaveLength(2);
    expect(el.querySelector('.pk-link')).toBeTruthy();
    expect(el.textContent).toContain(DEFAULT_CONNECT_COPY.title);
    expect(el.textContent).toContain(DEFAULT_CONNECT_COPY.createTitle);
  });
});

describe('addDeviceView', () => {
  it('idle surfaces the security banner + cancel/add actions', () => {
    const el = addDeviceView({ status: 'idle' }, addCtx);
    expect(el.getAttribute('data-pk-state')).toBe('idle');
    expect(el.querySelector('.pk-banner--warn')).toBeTruthy();
    expect(el.querySelectorAll('.pk-btn')).toHaveLength(2);
  });

  it('prompting dims behind a calm wait overlay (no spinner)', () => {
    const el = addDeviceView({ status: 'prompting' }, addCtx);
    expect(el.classList.contains('is-waiting')).toBe(true);
    expect(el.querySelector('.pk-wait')).toBeTruthy();
    expect(el.querySelector('.pk-wait .pk-spinner')).toBeNull();
  });

  it('binding shows the working block: spinner + progress', () => {
    const el = addDeviceView({ status: 'binding' }, addCtx);
    expect(el.querySelector('.pk-work')).toBeTruthy();
    expect(el.querySelector('.pk-spinner')).toBeTruthy();
    expect(el.querySelector('.pk-progress')).toBeTruthy();
  });

  it('success shows the new-signer address chip', () => {
    const el = addDeviceView({ status: 'success', result: { signer: 'P256:ABCD…1234' } }, addCtx);
    expect(el.querySelector('.pk-address')).toBeTruthy();
    expect(el.textContent).toContain(DEFAULT_ADDDEVICE_COPY.successTitle);
  });

  it('error renders the single error layout, code mapped to addDevice:binding', () => {
    const el = addDeviceView({ status: 'error', code: 'CONTRACT_AUTH_FAILED', message: '' }, addCtx);
    expect(el.querySelector('[role="alert"]')).toBeTruthy();
    expect(el.querySelector('[data-error-key]')?.getAttribute('data-error-key')).toBe('addDevice:binding');
  });
});

describe('createAddDeviceFlow', () => {
  it('walks idle → prompting → binding → success', async () => {
    const seen: string[] = [];
    const flow = createAddDeviceFlow({
      addDevice: async (report) => {
        report.binding();
        return { signer: 'k' };
      },
    });
    flow.subscribe(() => seen.push(flow.getState().status));
    await flow.start();
    expect(flow.getState().status).toBe('success');
    expect(seen).toContain('prompting');
    expect(seen).toContain('binding');
  });

  it('a thrown error lands in the error state', async () => {
    const flow = createAddDeviceFlow({
      addDevice: async () => {
        throw new Error('boom');
      },
    });
    await flow.start();
    expect(flow.getState().status).toBe('error');
  });
});
