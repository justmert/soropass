import { describe, expect, it } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { DEFAULT_ACCOUNT_FACTORIES, defaultAccountFactory } from './networks';
import { deriveAccountAddress } from './soroban/address';
import { isKitError } from './errors';

const PUB = p256.getPublicKey(new Uint8Array(32).fill(7), false);
const CRED = new TextEncoder().encode('default-factory-test');

describe('default AccountFactory per network', () => {
  it('maps testnet and mainnet to the deployed SoroPass factories', () => {
    expect(defaultAccountFactory(Networks.TESTNET)).toBe(
      'CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH',
    );
    expect(defaultAccountFactory(Networks.PUBLIC)).toBe(
      'CCCNRWMICVEMMUSBI7DL3IKB566QEOOQOLVDOAM5SLFDZ2KGUSRR3JVF',
    );
    expect(Object.keys(DEFAULT_ACCOUNT_FACTORIES)).toEqual([Networks.TESTNET, Networks.PUBLIC]);
  });

  it('throws a typed KitError for a network with no deployed default', () => {
    try {
      defaultAccountFactory('Standalone Network ; February 2017');
      expect.unreachable();
    } catch (e) {
      expect(isKitError(e) && e.code).toBe('CONTRACT_AUTH_FAILED');
    }
  });

  it('deriveAccountAddress without factoryContractId equals the explicit-factory derivation', () => {
    for (const networkPassphrase of [Networks.TESTNET, Networks.PUBLIC]) {
      const defaulted = deriveAccountAddress({
        credentialId: CRED,
        publicKey: PUB,
        networkPassphrase,
      });
      const explicit = deriveAccountAddress({
        factoryContractId: defaultAccountFactory(networkPassphrase),
        credentialId: CRED,
        publicKey: PUB,
        networkPassphrase,
      });
      expect(defaulted).toBe(explicit);
      expect(defaulted.startsWith('C')).toBe(true);
    }
  });

  it('the two networks derive DIFFERENT addresses for the same credential', () => {
    const t = deriveAccountAddress({
      credentialId: CRED,
      publicKey: PUB,
      networkPassphrase: Networks.TESTNET,
    });
    const m = deriveAccountAddress({
      credentialId: CRED,
      publicKey: PUB,
      networkPassphrase: Networks.PUBLIC,
    });
    expect(t).not.toBe(m);
  });

  it('an explicit factoryContractId overrides the default', () => {
    const other = 'CAGWE36MQRWXIXS4Z4G6UYEEJMJ7XGNOE7K5PHQ6BCZYMAPAWPBHLBQV';
    const overridden = deriveAccountAddress({
      factoryContractId: other,
      credentialId: CRED,
      publicKey: PUB,
      networkPassphrase: Networks.TESTNET,
    });
    const defaulted = deriveAccountAddress({
      credentialId: CRED,
      publicKey: PUB,
      networkPassphrase: Networks.TESTNET,
    });
    expect(overridden).not.toBe(defaulted);
  });
});
