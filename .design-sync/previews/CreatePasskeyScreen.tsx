import { CreatePasskeyScreen } from '@soropass/ui-react';

export const Idle = () => <CreatePasskeyScreen state={{ status: 'idle' }} />;

export const Prompting = () => <CreatePasskeyScreen state={{ status: 'prompting' }} />;

export const Deploying = () => <CreatePasskeyScreen state={{ status: 'deploying' }} />;

export const Success = () => (
  <CreatePasskeyScreen
    state={{
      status: 'success',
      credential: {
        contractId: 'CDIUAXCB7Z2K4M6N8P0R1S3T5V7W9Y1A2C4E6G8J0L2N4Q6S8U0W2Y4',
        credentialId: 'Rmlkb0NyZWRlbnRpYWxJZA',
        publicKey: new Uint8Array(65),
      },
    }}
  />
);

export const Cancelled = () => (
  <CreatePasskeyScreen
    state={{ status: 'error', code: 'USER_CANCELLED', message: 'The passkey prompt was dismissed.' }}
  />
);
