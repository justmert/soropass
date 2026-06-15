import { afterEach, describe, expect, it } from 'vitest';
import {
  Account,
  Address,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { referenceCheckAuth } from '@soropass/core';
import { createInMemoryBackend, mockAuthenticator } from '@soropass/core/testing';
import { PASSKEY_ID, PasskeyModule } from './index';
import type { ModuleInterface } from './kitTypes';

const RP_ID = 'localhost';
const PASSPHRASE = Networks.TESTNET;

// Minimal mirror of StellarWalletsKit.init/setWallet/selectedModule (v2.2.0).
class MiniKit {
  private modules: ModuleInterface[] = [];
  private selected?: ModuleInterface;
  init(params: { modules: ModuleInterface[] }): this {
    this.modules = params.modules;
    return this;
  }
  setWallet(id: string): void {
    const target = this.modules.find((m) => m.productId === id);
    if (!target) throw new Error(`Wallet id "${id}" is not an existing module`);
    this.selected = target;
  }
  get selectedModule(): ModuleInterface {
    if (!this.selected) throw new Error('Please set the wallet first');
    return this.selected;
  }
}

function makeModule() {
  const auth = mockAuthenticator({ rpId: RP_ID, seed: 'kit-module' });
  const backend = createInMemoryBackend();
  const module = new PasskeyModule({
    rpId: RP_ID,
    networkPassphrase: PASSPHRASE,
    indexer: backend.indexer,
    deployer: backend.deployer,
    signer: auth.sign,
    webauthn: auth,
  });
  return { module, auth };
}

function unsignedEntry(): xdr.SorobanAuthorizationEntry {
  const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 5)));
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: address.toScAddress(),
        nonce: new xdr.Int64(7),
        signatureExpirationLedger: 1000,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: address.toScAddress(),
          functionName: 'transfer',
          args: [],
        }),
      ),
      subInvocations: [],
    }),
  });
}

function unsignedTxXdr(): string {
  const address = new Address(StrKey.encodeContract(Buffer.alloc(32, 5)));
  const op = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeInvokeContract(
      new xdr.InvokeContractArgs({
        contractAddress: address.toScAddress(),
        functionName: 'transfer',
        args: [],
      }),
    ),
    auth: [unsignedEntry()],
  });
  const source = new Account(Keypair.random().publicKey(), '0');
  return new TransactionBuilder(source, { fee: '100', networkPassphrase: PASSPHRASE })
    .addOperation(op)
    .setTimeout(60)
    .build()
    .toXDR();
}

afterEach(() => {
  delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;
});

describe('PasskeyModule (S17) — @creit.tech/stellar-wallets-kit v2.2.0', () => {
  it('registers via StellarWalletsKit.init({ modules }) + setWallet, with correct metadata', () => {
    const { module } = makeModule();
    const kit = new MiniKit().init({ modules: [module] });
    kit.setWallet(PASSKEY_ID);
    expect(kit.selectedModule.productId).toBe(PASSKEY_ID);
    expect(kit.selectedModule.productName).toBe('Passkey (Smart Account)');
    expect(module.moduleType).toBe('HOT_WALLET');
  });

  it('GATE: conforms to the full @creit.tech/stellar-wallets-kit v2.2.0 ModuleInterface', () => {
    const { module } = makeModule();
    // Compile-time conformance against the complete v2.2.0 surface (vendored in
    // kitTypes.ts); the upstream PR swaps this for the kit's own ModuleInterface.
    const asInterface: ModuleInterface = module;
    for (const method of [
      'isAvailable',
      'getAddress',
      'signTransaction',
      'signAuthEntry',
      'signMessage',
      'getNetwork',
    ] as const) {
      expect(typeof (asInterface as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it('GATE: getAddress() (C-address) + signTransaction() verify THROUGH the module', async () => {
    const { module } = makeModule();
    const created = await module.createAccount('alice');
    const { address } = await module.getAddress();
    expect(address.startsWith('C')).toBe(true);
    expect(address).toBe(created.contractId);

    const { signedTxXdr, signerAddress } = await module.signTransaction(unsignedTxXdr());
    expect(signerAddress).toBe(created.contractId);
    const envelope = xdr.TransactionEnvelope.fromXDR(signedTxXdr, 'base64');
    const entry = envelope.v1().tx().operations()[0]!.body().invokeHostFunctionOp().auth()[0]!;
    expect(referenceCheckAuth(entry, created.publicKey, PASSPHRASE).success).toBe(true);
  });

  it('signAuthEntry() verifies through the module', async () => {
    const { module } = makeModule();
    const created = await module.createAccount();
    const { signedAuthEntry } = await module.signAuthEntry(unsignedEntry().toXDR('base64'));
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(signedAuthEntry, 'base64');
    expect(referenceCheckAuth(entry, created.publicKey, PASSPHRASE).success).toBe(true);
  });

  it('isAvailable() returns false (never throws) when WebAuthn is unavailable', async () => {
    const { module } = makeModule();
    expect(await module.isAvailable()).toBe(false);
  });

  it('isAvailable() honors the 500ms budget when isUVPAA hangs', async () => {
    (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: () => new Promise<boolean>(() => {}),
    };
    const { module } = makeModule();
    expect(await module.isAvailable()).toBe(false); // resolves via the 500ms race, not a hang
  });

  it('getNetwork() reports the configured network', async () => {
    const { module } = makeModule();
    expect((await module.getNetwork()).networkPassphrase).toBe(PASSPHRASE);
  });
});
