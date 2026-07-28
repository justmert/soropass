import { describe, expect, it } from 'vitest';
import { Contract, StrKey } from '@stellar/stellar-sdk';
import { sendSmartWalletTx } from './submit';
import { isKitError } from '../errors';
import type { WebAuthnSigner } from './sign';

const WALLET = StrKey.encodeContract(Buffer.alloc(32, 6));
const neverSign: WebAuthnSigner = () => {
  throw new Error('sign() must not be reached');
};

describe('sendSmartWalletTx — input validation (no network)', () => {
  it('rejects an invalid fee-source secret before any network call', async () => {
    const operation = new Contract(WALLET).call('noop');
    let code: string | undefined;
    try {
      await sendSmartWalletTx({
        operation,
        networkPassphrase: 'Test SDF Network ; September 2015',
        rpcUrl: 'https://soroban-testnet.stellar.org',
        sourceSecret: 'not-a-secret',
        sign: neverSign,
      });
    } catch (e) {
      code = isKitError(e) ? e.code : `<<${String(e)}>>`;
    }
    expect(code).toBe('CONTRACT_AUTH_FAILED');
  });
});
