/**
 * A faithful mirror of `@creit-tech/stellar-wallets-kit` **v2.2.0**
 * `src/types/mod.ts`. In the upstream PR (S27) the module imports these from the
 * kit itself; they are mirrored here so this package builds + tests standalone.
 */
export enum ModuleType {
  HW_WALLET = 'HW_WALLET',
  HOT_WALLET = 'HOT_WALLET',
  BRIDGE_WALLET = 'BRIDGE_WALLET',
  AIR_GAPED_WALLET = 'AIR_GAPED_WALLET',
}

export interface ModuleInterface {
  moduleType: ModuleType;
  productId: string;
  productName: string;
  productUrl: string;
  productIcon: string;
  isAvailable(): Promise<boolean>;
  getAddress(params?: { path?: string; skipRequestAccess?: boolean }): Promise<{ address: string }>;
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string; path?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
  signAuthEntry(
    authEntry: string,
    opts?: { networkPassphrase?: string; address?: string; path?: string },
  ): Promise<{ signedAuthEntry: string; signerAddress?: string }>;
  signMessage(
    message: string,
    opts?: { networkPassphrase?: string; address?: string; path?: string },
  ): Promise<{ signedMessage: string; signerAddress?: string }>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  disconnect?(): Promise<void>;
}
