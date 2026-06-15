/**
 * `@soropass/ui/styled` — the styled reference components (S20) for the
 * create / sign / recover screens, built on the S18 headless flows. Framework-
 * agnostic: plain DOM + the design's token-driven CSS. Re-theme by overriding
 * tokens (`tokens.css`) — never by editing components.
 *
 * Ship the stylesheet alongside: `import '@soropass/ui/styled.css'`
 * (bundles `tokens.css` + `passkey.css`).
 */
export { mountCreateScreen, createView, DEFAULT_CREATE_COPY } from './createScreen';
export type { CreateScreenOptions, CreateCopy, CreateCtx } from './createScreen';
export { mountSignScreen, signView, DEFAULT_SIGN_COPY } from './signScreen';
export type { SignScreenOptions, SignCopy, SignCtx } from './signScreen';
export { mountRecoverScreen, recoverView, DEFAULT_RECOVER_COPY } from './recoverScreen';
export type { RecoverScreenOptions, RecoverCopy, RecoverCtx } from './recoverScreen';
export { mountConnectScreen, connectView, DEFAULT_CONNECT_COPY } from './connectScreen';
export type { ConnectScreenOptions, ConnectCopy, ConnectCtx } from './connectScreen';
export { mountAddDeviceScreen, addDeviceView, DEFAULT_ADDDEVICE_COPY } from './addDeviceScreen';
export type { AddDeviceScreenOptions, AddDeviceCopy, AddDeviceCtx } from './addDeviceScreen';

export type { ScreenHandle } from './mount';
export type { TxSummaryData } from './components';

// Error connector (KitErrorCode × screen → design copy) + the design's copy table.
export { ERROR_COPY, errorKeyFor, errorCopyFor } from './errors';
export type { Screen, DesignErrorKey, ErrorCopy } from './errors';

// Primitives, exposed for adopters composing their own layouts.
export { truncMiddle, hashStr, identicon, icon } from './dom';
export type { IconName } from './dom';
