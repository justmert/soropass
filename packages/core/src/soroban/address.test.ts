import { describe, expect, it } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';
import { deriveAccountAddress } from '../create';
import { isKitError } from '../errors';

// The real on-chain factoryDeployProof from contracts/deployments.json:
// factory.deploy(public_key, credential_id="democred") deployed this account.
const FACTORY = 'CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM';
const CRED_DEMOCRED = Uint8Array.from(Buffer.from('64656d6f63726564', 'hex')); // "democred"
const DEPLOYED = 'CAGWE36MQRWXIXS4Z4G6UYEEJMJ7XGNOE7K5PHQ6BCZYMAPAWPBHLBQV';

describe('deriveAccountAddress (deterministic C-address, no network)', () => {
  it('matches the real on-chain factory deployment (deployments.json proof)', () => {
    const derived = deriveAccountAddress({
      factoryContractId: FACTORY,
      credentialId: CRED_DEMOCRED,
      networkPassphrase: Networks.TESTNET,
    });
    expect(derived).toBe(DEPLOYED);
  });

  it('is deterministic and depends on the credential id', () => {
    const a = deriveAccountAddress({
      factoryContractId: FACTORY,
      credentialId: CRED_DEMOCRED,
      networkPassphrase: Networks.TESTNET,
    });
    const again = deriveAccountAddress({
      factoryContractId: FACTORY,
      credentialId: CRED_DEMOCRED,
      networkPassphrase: Networks.TESTNET,
    });
    const other = deriveAccountAddress({
      factoryContractId: FACTORY,
      credentialId: Uint8Array.from([9, 9, 9, 9]),
      networkPassphrase: Networks.TESTNET,
    });
    expect(again).toBe(a);
    expect(other).not.toBe(a);
    expect(other).toMatch(/^C[A-Z2-7]{55}$/); // a valid contract StrKey
  });

  it('depends on the network passphrase (testnet vs public differ)', () => {
    const testnet = deriveAccountAddress({
      factoryContractId: FACTORY,
      credentialId: CRED_DEMOCRED,
      networkPassphrase: Networks.TESTNET,
    });
    const pubnet = deriveAccountAddress({
      factoryContractId: FACTORY,
      credentialId: CRED_DEMOCRED,
      networkPassphrase: Networks.PUBLIC,
    });
    expect(pubnet).not.toBe(testnet);
  });

  it('throws a typed KitError on a bad factory id or empty credential', () => {
    const bad = () =>
      deriveAccountAddress({
        factoryContractId: 'not-a-contract',
        credentialId: CRED_DEMOCRED,
        networkPassphrase: Networks.TESTNET,
      });
    expect(bad).toThrow();
    try {
      bad();
    } catch (e) {
      expect(isKitError(e)).toBe(true);
    }
    try {
      deriveAccountAddress({
        factoryContractId: FACTORY,
        credentialId: new Uint8Array(0),
        networkPassphrase: Networks.TESTNET,
      });
      throw new Error('expected throw');
    } catch (e) {
      expect(isKitError(e)).toBe(true);
    }
  });
});
