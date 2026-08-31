import { SignTransactionScreen } from '@soropass/ui-react';

const PAYMENT = {
  amountValue: '250.00 USDC',
  amountFiat: '≈ $250.00',
  destination: 'GDUKMGUGDZQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6X',
  action: 'transfer' as const,
};

export const Idle = () => <SignTransactionScreen state={{ status: 'idle' }} tx={PAYMENT} />;

export const Prompting = () => (
  <SignTransactionScreen state={{ status: 'prompting' }} tx={PAYMENT} />
);

export const Submitting = () => (
  <SignTransactionScreen state={{ status: 'submitting' }} tx={PAYMENT} />
);

export const Done = () => (
  <SignTransactionScreen
    tx={PAYMENT}
    state={{
      status: 'done',
      result: {
        status: 'SUCCESS',
        hash: '979b823c1f4e6a2d8c0b5f7a9e3d1c6b4a2f8e0d7c5b3a1f9e7d5c3b1a0f8e6d',
      },
    }}
  />
);

export const Failed = () => (
  <SignTransactionScreen
    tx={PAYMENT}
    state={{ status: 'error', code: 'NETWORK_ERROR', message: 'The network could not be reached.' }}
  />
);
