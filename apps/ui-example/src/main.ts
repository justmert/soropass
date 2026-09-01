/**
 * Consuming example for @soropass/ui: the five drop-in screens, wired to the
 * mock kit from @soropass/core/testing. Real flow logic, deterministic
 * in-memory authenticator, no hardware and no network, so it runs anywhere.
 * Swap the mock kit for real core adapters and the screens stay identical.
 */
import '@soropass/ui/styled.css';
import {
  createCreatePasskeyFlow,
  createSignFlow,
  createRecoverFlow,
  createAddDeviceFlow,
} from '@soropass/ui/headless';
import {
  mountConnectScreen,
  mountCreateScreen,
  mountSignScreen,
  mountRecoverScreen,
  mountAddDeviceScreen,
  truncMiddle,
  type ScreenHandle,
} from '@soropass/ui/styled';
import { createPasskeyKit, sampleAuthEntry } from '@soropass/core/testing';
import type { SubmitResult } from '@soropass/core/types';

const kit = createPasskeyKit({ mode: 'mock', rpId: 'example.com', rpName: 'Acme Example' });
let account: { contractId: string; credentialId: string; publicKey: Uint8Array } | undefined;

const root = document.querySelector<HTMLElement>('#screen')!;
const nav = document.querySelector<HTMLElement>('#nav')!;
let handle: ScreenHandle | undefined;

const SCREENS = ['connect', 'create', 'sign', 'recover', 'add device'] as const;
type ScreenName = (typeof SCREENS)[number];

function show(name: ScreenName): void {
  handle?.unmount();
  root.innerHTML = '';
  for (const b of nav.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.textContent === name));
  }
  handle = MOUNTS[name]();
}

const MOUNTS: Record<ScreenName, () => ScreenHandle> = {
  connect: () =>
    mountConnectScreen(root, {
      onCreate: () => show('create'),
      onUseExisting: () => show('recover'),
    }),

  create: () =>
    mountCreateScreen(root, {
      flow: createCreatePasskeyFlow({
        create: async (input, report) => {
          report.deploying();
          account = await kit.createPasskey(input);
          return account;
        },
      }),
      input: { userName: 'alice' },
      onContinue: () => show('sign'),
    }),

  sign: () =>
    mountSignScreen(root, {
      flow: createSignFlow({
        sign: async () => {
          if (!account) account = await kit.createPasskey({ userName: 'alice' });
          return kit.signAuthEntry(sampleAuthEntry(account.contractId));
        },
        submit: (): Promise<SubmitResult> =>
          Promise.resolve({ status: 'SUCCESS', hash: 'mock-tx-hash' }),
      }),
      tx: {
        amountValue: '25.00 XLM',
        amountFiat: '$8.71',
        destination: 'GDPA…NRPK',
        action: 'transfer',
      },
      onCancel: () => show('connect'),
    }),

  recover: () =>
    mountRecoverScreen(root, {
      flow: createRecoverFlow({
        recover: async () => {
          if (!account) account = await kit.createPasskey({ userName: 'alice' });
          return kit.recover();
        },
      }),
      accountMeta: (a) => truncMiddle(a.contractId, 12),
      onContinue: () => show('sign'),
      onCreateNew: () => show('create'),
    }),

  'add device': () =>
    mountAddDeviceScreen(root, {
      flow: createAddDeviceFlow({
        addDevice: async (report) => {
          report.binding();
          if (!account) account = await kit.createPasskey({ userName: 'alice' });
          return { signer: truncMiddle(account.credentialId, 16) };
        },
      }),
      onDone: () => show('connect'),
      onCancel: () => show('connect'),
    }),
};

for (const name of SCREENS) {
  const b = document.createElement('button');
  b.textContent = name;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => show(name));
  nav.append(b);
}

document.querySelector<HTMLButtonElement>('#theme')!.addEventListener('click', (e) => {
  const on = document.body.classList.toggle('theme-acme');
  (e.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(on));
});

show('connect');
