/**
 * `@soropass/core/recover` — the recovery family: the lost-localStorage /
 * new-device path (`recover`), and on-chain multi-device recovery (`addSigner` /
 * `removeSigner`) so a lost device never locks the user out.
 */
export { recover } from './ceremonies/recover';
export type { RecoverOptions, RecoverResult } from './ceremonies/recover';
export { addSigner, removeSigner } from './ceremonies/addDevice';
export type {
  AddSignerOptions,
  RemoveSignerOptions,
  WalletCallOptions,
  NewDeviceSigner,
} from './ceremonies/addDevice';
