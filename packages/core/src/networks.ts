import { KitError } from './errors';

/**
 * The canonical SoroPass `AccountFactory` deployments, keyed by network
 * passphrase. These factories are permissionless: `deploy` is not auth-gated,
 * anyone can create accounts through them, and the wasm they instantiate is the
 * reproducible v0.2 multi-signer `webauthn-account` build recorded in
 * contracts/deployments.json. `factoryDeployer`, `eventsIndexer`, and
 * `deriveAccountAddress` fall back to these when no `factoryContractId` is
 * given, so a sponsor creates accounts through the deployed factory for its
 * network unless it explicitly points at another one.
 */
export const DEFAULT_ACCOUNT_FACTORIES: Readonly<Record<string, string>> = {
  // Test SDF Network ; September 2015
  'Test SDF Network ; September 2015': 'CADKKP4BEFTZYK3NDGSBTPDJESPNRQ6HF36XAT62WQUPI47MNTENY3NH',
  // Public Global Stellar Network ; September 2015
  'Public Global Stellar Network ; September 2015':
    'CCCNRWMICVEMMUSBI7DL3IKB566QEOOQOLVDOAM5SLFDZ2KGUSRR3JVF',
};

/**
 * The default `AccountFactory` C-address for `networkPassphrase`. Throws a
 * typed `KitError` for a network with no deployed default (a local network, a
 * fork): pass `factoryContractId` explicitly there.
 */
export function defaultAccountFactory(networkPassphrase: string): string {
  const factory = DEFAULT_ACCOUNT_FACTORIES[networkPassphrase];
  if (!factory) {
    throw new KitError(
      'CONTRACT_AUTH_FAILED',
      `no default AccountFactory for network "${networkPassphrase}": pass factoryContractId`,
    );
  }
  return factory;
}
