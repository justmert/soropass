import { describe, expect, it } from 'vitest';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { p256 } from '@noble/curves/nist';
import { addSigner, removeSigner } from './addDevice';
import { isKitError } from '../errors';
import type { WebAuthnSigner } from '../soroban/sign';

const WALLET = StrKey.encodeContract(Buffer.alloc(32, 4));
const PUB = p256.getPublicKey(new Uint8Array(32).fill(3), false);
const RPC = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';

// A signer that fails loudly: these guard tests must reject BEFORE any signing or
// network round-trip, so this must never be invoked.
const neverSign: WebAuthnSigner = () => {
  throw new Error('sign() must not be reached — input validation failed');
};

const base = {
  networkPassphrase: PASSPHRASE,
  rpcUrl: RPC,
  sourceSecret: Keypair.random().secret(),
  sign: neverSign,
};

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return '<<no throw>>';
  } catch (e) {
    return isKitError(e) ? e.code : `<<${String(e)}>>`;
  }
}

describe('addSigner / removeSigner — input validation (no network)', () => {
  it('addSigner rejects an invalid wallet contract id before any network call', async () => {
    expect(
      await codeOf(
        addSigner({
          ...base,
          walletContractId: 'not-a-contract',
          newSigner: { credentialId: 'AAAA', publicKey: PUB },
        }),
      ),
    ).toBe('CONTRACT_AUTH_FAILED');
  });

  it('addSigner rejects a malformed new-signer public key', async () => {
    expect(
      await codeOf(
        addSigner({
          ...base,
          walletContractId: WALLET,
          newSigner: { credentialId: 'AAAA', publicKey: new Uint8Array(10) },
        }),
      ),
    ).toBe('INVALID_PUBLIC_KEY');
  });

  it('removeSigner rejects an empty credential id', async () => {
    expect(
      await codeOf(
        removeSigner({ ...base, walletContractId: WALLET, credentialId: new Uint8Array(0) }),
      ),
    ).toBe('CONTRACT_AUTH_FAILED');
  });
});
