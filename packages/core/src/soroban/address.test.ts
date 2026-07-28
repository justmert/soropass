import { describe, expect, it } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';
import { deriveAccountAddress, deriveSmartWalletAddress } from '../create';
import { encodeChallenge } from '../webauthn/clientData';
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

describe('deriveSmartWalletAddress (passkey-kit v1, offline)', () => {
  // A REAL on-chain v1 deployment from scripts/v1-events-probe.ts: this deployer +
  // founding credential deployed exactly this wallet (verified: derived === deployed).
  const V1_DEPLOYER = 'GCO3Q7OMYHLFWQL7EZQNF5DHXR3PQ4TFZHBZE6MMD4B3QMMCV3TZNFIT';
  const V1_CRED = encodeChallenge(
    Uint8Array.from(Buffer.from('401017927d529605e32979bad2e1534c', 'hex')),
  );
  const V1_WALLET = 'CDXICVKLHPPAZ3EM65OESOGBSQE4YQGFN6JK7ICPYUXDAQPAVXBZ4PAT';

  it('matches a real on-chain v1 deployment (salt = sha256(rawCredentialId))', () => {
    expect(
      deriveSmartWalletAddress({
        deployer: V1_DEPLOYER,
        credentialId: V1_CRED,
        networkPassphrase: Networks.TESTNET,
      }),
    ).toBe(V1_WALLET);
  });

  it('is deterministic and depends on deployer, credential, and network', () => {
    const base = {
      deployer: V1_DEPLOYER,
      credentialId: V1_CRED,
      networkPassphrase: Networks.TESTNET,
    };
    expect(deriveSmartWalletAddress(base)).toBe(deriveSmartWalletAddress(base));
    // Different deployer → different wallet (unlike our single-signer factory scheme).
    const otherDeployer = deriveSmartWalletAddress({
      ...base,
      deployer: 'GBISW7YZ57FZPSJYQV3YJTM4XYKQ4HWTUTCQ2RIF2VVEZVM26F544M5F',
    });
    expect(otherDeployer).not.toBe(V1_WALLET);
    expect(deriveSmartWalletAddress({ ...base, networkPassphrase: Networks.PUBLIC })).not.toBe(
      V1_WALLET,
    );
  });

  it('uses RAW credential bytes for the salt — distinct from the factory (utf8) scheme', () => {
    // deriveAccountAddress salts sha256(utf8(base64url string)); deriveSmartWalletAddress
    // salts sha256(rawBytes). Same inputs must NOT collide.
    const raw = Uint8Array.from(Buffer.from('401017927d529605e32979bad2e1534c', 'hex'));
    const asFactory = deriveAccountAddress({
      factoryContractId: 'CBVGSJEIKGQ6MYFOWCBNV2NLLPJJV757UP6QQV6FDTI4S3N72OZ676TM',
      credentialId: new TextEncoder().encode(encodeChallenge(raw)),
      networkPassphrase: Networks.TESTNET,
    });
    expect(asFactory).not.toBe(V1_WALLET);
  });

  it('throws a typed KitError on an empty credential id', () => {
    try {
      deriveSmartWalletAddress({
        deployer: V1_DEPLOYER,
        credentialId: '',
        networkPassphrase: Networks.TESTNET,
      });
      throw new Error('expected throw');
    } catch (e) {
      expect(isKitError(e)).toBe(true);
    }
  });
});
