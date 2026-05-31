/**
 * Vendored type surface from `@creit.tech/stellar-wallets-kit` **v2.2.0**
 * (`src/types/mod.ts`), pinned so this package builds and tests standalone.
 *
 * This is an exact copy of the kit's `ModuleInterface` plus the `ModuleType`,
 * `IOnChangeEvent`, and `IKitError` types it references — including the optional
 * members (`isPlatformWrapper`, `onChange`, `signAndSubmitTransaction`,
 * `disconnect`) so `PasskeyModule implements ModuleInterface` is checked against
 * the *complete* contract, not a partial copy. When the module is upstreamed
 * (S27), the single `./kitTypes` import is swapped for
 * `@creit.tech/stellar-wallets-kit` — no other change.
 */

export enum ModuleType {
  HW_WALLET = 'HW_WALLET',
  HOT_WALLET = 'HOT_WALLET',
  BRIDGE_WALLET = 'BRIDGE_WALLET',
  AIR_GAPED_WALLET = 'AIR_GAPED_WALLET',
}

export interface IKitError {
  code: number;
  message: string;
  ext?: string;
}

export interface IOnChangeEvent {
  address: string;
  network: string;
  networkPassphrase: string;
  error?: IKitError;
}

export interface ModuleInterface {
  moduleType: ModuleType;
  productId: string;
  productName: string;
  productUrl: string;
  productIcon: string;
  isAvailable(): Promise<boolean>;
  isPlatformWrapper?(): Promise<boolean>;
  onChange?(callback: (event: IOnChangeEvent) => void): void;
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
  signAndSubmitTransaction?(
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ): Promise<{ status: 'success' | 'pending' }>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  disconnect?(): Promise<void>;
}
