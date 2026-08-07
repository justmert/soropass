import { RecoverAccountScreen } from '@soropass/ui-react';

const ACCOUNTS = [
  {
    contractId: 'CDIUAXCB7Z2K4M6N8P0R1S3T5V7W9Y1A2C4E6G8J0L2N4Q6S8U0W2Y4',
    credentialId: 'Rmlkb0NyZWRlbnRpYWxJZA',
  },
  {
    contractId: 'CBQK6YHKVPETMTBTYVATSORDCJUWCNCRZ2V7Y5T2RZ7Q4Z6XA3F2BQX',
    credentialId: 'U2Vjb25kQ3JlZGVudGlhbA',
  },
  {
    contractId: 'CA3F2BQX7Y4ZK8MN6WV2T9LRPD5HJ0C1A8E7G9KQ4ZK8MN6WV2T9LRP',
    credentialId: 'VGhpcmRDcmVkZW50aWFs',
  },
];

export const Idle = () => <RecoverAccountScreen state={{ status: 'idle' }} />;

export const Discovering = () => <RecoverAccountScreen state={{ status: 'discovering' }} />;

export const OneAccount = () => (
  <RecoverAccountScreen state={{ status: 'resolved', accounts: ACCOUNTS.slice(0, 1) }} />
);

export const MultipleAccounts = () => (
  <RecoverAccountScreen state={{ status: 'resolved', accounts: ACCOUNTS }} />
);

export const NoneFound = () => <RecoverAccountScreen state={{ status: 'none' }} />;
