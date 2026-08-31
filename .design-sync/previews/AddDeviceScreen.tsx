import { AddDeviceScreen } from '@soropass/ui-react';

export const Idle = () => <AddDeviceScreen state={{ status: 'idle' }} />;

export const Prompting = () => <AddDeviceScreen state={{ status: 'prompting' }} />;

export const Binding = () => <AddDeviceScreen state={{ status: 'binding' }} />;

export const Success = () => (
  <AddDeviceScreen
    state={{
      status: 'success',
      result: { signer: 'CDIUAXCB7Z2K4M6N8P0R1S3T5V7W9Y1A2C4E6G8J0L2N4Q6S8U0W2Y4' },
    }}
  />
);

export const Cancelled = () => (
  <AddDeviceScreen
    state={{
      status: 'error',
      code: 'USER_CANCELLED',
      message: 'The passkey prompt was dismissed.',
    }}
  />
);
