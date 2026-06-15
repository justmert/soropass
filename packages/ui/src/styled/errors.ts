/**
 * The error connector. The headless layer surfaces a `KitErrorCode` (10 codes,
 * screen-agnostic); the design specifies ONE error layout whose copy swaps by a
 * screen-scoped key (e.g. `create:cancelled`). This maps `(screen, KitErrorCode)`
 * → the design key + copy, so the styled layer never duplicates flow logic and
 * the design's error table stays the single source of copy.
 */
import type { KitErrorCode } from '@soropass/core/types';

export type Screen = 'create' | 'sign' | 'recover' | 'addDevice';

export type DesignErrorKey =
  | 'create:cancelled'
  | 'create:unsupported'
  | 'create:onchain'
  | 'create:keyread'
  | 'create:setup'
  | 'create:network'
  | 'sign:cancelled'
  | 'sign:unsupported'
  | 'sign:verify'
  | 'sign:network'
  | 'sign:signature'
  | 'recover:cancelled'
  | 'recover:unsupported'
  | 'recover:network'
  | 'addDevice:cancelled'
  | 'addDevice:unsupported'
  | 'addDevice:binding'
  | 'addDevice:network';

export interface ErrorCopy {
  title: string;
  message: string;
  /** Button label — "Try again" for user-actionable, "Retry" for transient/network. */
  action: string;
}

/** Verbatim from the design handoff "Error copy" table (README). */
export const ERROR_COPY: Record<DesignErrorKey, ErrorCopy> = {
  'create:cancelled': {
    title: 'Setup cancelled',
    message:
      'You closed the passkey prompt before your wallet was created. You can try again whenever you’re ready.',
    action: 'Try again',
  },
  'create:unsupported': {
    title: 'Device not supported',
    message:
      'This device or passkey can’t be used to create a wallet. Try another device or security key.',
    action: 'Try again',
  },
  'create:onchain': {
    title: 'Passkey not supported',
    message:
      'This passkey type isn’t supported for on-chain accounts yet. Try a different device or passkey.',
    action: 'Try again',
  },
  'create:keyread': {
    title: 'Couldn’t read your passkey',
    message: 'We couldn’t read the key from this passkey. Please try again.',
    action: 'Try again',
  },
  'create:setup': {
    title: 'Account setup didn’t finish',
    message:
      'Your passkey was created, but we couldn’t finish setting up your account. Please try again.',
    action: 'Try again',
  },
  'create:network': {
    title: 'Connection problem',
    message: 'We couldn’t reach the network. Check your connection and try again.',
    action: 'Retry',
  },
  'sign:cancelled': {
    title: 'Signing cancelled',
    message: 'You closed the passkey prompt before the transaction was signed. You can try again.',
    action: 'Try again',
  },
  'sign:unsupported': {
    title: 'Device not supported',
    message: 'This device or passkey can’t be used to sign. Try another device or security key.',
    action: 'Try again',
  },
  'sign:verify': {
    title: 'Couldn’t verify this request',
    message: 'This transaction may have changed or expired. Review the details and try again.',
    action: 'Try again',
  },
  'sign:network': {
    title: 'Connection problem',
    message: 'We couldn’t reach the network. Check your connection and try again.',
    action: 'Retry',
  },
  'sign:signature': {
    title: 'Signature problem',
    message: 'The signature couldn’t be completed. Please try signing again.',
    action: 'Try again',
  },
  'recover:cancelled': {
    title: 'Recovery cancelled',
    message:
      'You closed the passkey prompt before we finished. You can try again whenever you’re ready.',
    action: 'Try again',
  },
  'recover:unsupported': {
    title: 'Device not supported',
    message:
      'This device or passkey can’t be used to recover an account. Try another device or security key.',
    action: 'Try again',
  },
  'recover:network': {
    title: 'Connection problem',
    message: 'We couldn’t reach the network. Check your connection and try again.',
    action: 'Retry',
  },
  'addDevice:cancelled': {
    title: 'Cancelled',
    message: 'You closed the passkey prompt before the backup was added. You can try again.',
    action: 'Try again',
  },
  'addDevice:unsupported': {
    title: 'Device not supported',
    message:
      'This device or passkey can’t be added as a signer. Try another device or security key.',
    action: 'Try again',
  },
  'addDevice:binding': {
    title: 'Couldn’t add the signer',
    message: 'We couldn’t add this passkey to your account on-chain. Please try again.',
    action: 'Try again',
  },
  'addDevice:network': {
    title: 'Connection problem',
    message: 'We couldn’t reach the network. Check your connection and try again.',
    action: 'Retry',
  },
};

// Per-screen map from a KitErrorCode to the design's error key. Unlisted codes
// fall back to the screen's `*:unsupported` (a safe, device-level message).
const CREATE_MAP: Partial<Record<KitErrorCode, DesignErrorKey>> = {
  USER_CANCELLED: 'create:cancelled',
  UNSUPPORTED_AUTHENTICATOR: 'create:unsupported',
  ES256_NOT_SUPPORTED: 'create:onchain',
  INVALID_PUBLIC_KEY: 'create:keyread',
  INVALID_SIGNATURE_DER: 'create:keyread',
  CONTRACT_AUTH_FAILED: 'create:setup',
  NETWORK_ERROR: 'create:network',
};

const SIGN_MAP: Partial<Record<KitErrorCode, DesignErrorKey>> = {
  USER_CANCELLED: 'sign:cancelled',
  UNSUPPORTED_AUTHENTICATOR: 'sign:unsupported',
  ES256_NOT_SUPPORTED: 'sign:unsupported',
  CHALLENGE_MISMATCH: 'sign:verify',
  RP_ID_MISMATCH: 'sign:verify',
  ORIGIN_MISMATCH: 'sign:verify',
  CONTRACT_AUTH_FAILED: 'sign:verify',
  INVALID_SIGNATURE_DER: 'sign:signature',
  INVALID_PUBLIC_KEY: 'sign:signature',
  NETWORK_ERROR: 'sign:network',
};

const RECOVER_MAP: Partial<Record<KitErrorCode, DesignErrorKey>> = {
  USER_CANCELLED: 'recover:cancelled',
  UNSUPPORTED_AUTHENTICATOR: 'recover:unsupported',
  ES256_NOT_SUPPORTED: 'recover:unsupported',
  NETWORK_ERROR: 'recover:network',
};

const ADDDEVICE_MAP: Partial<Record<KitErrorCode, DesignErrorKey>> = {
  USER_CANCELLED: 'addDevice:cancelled',
  UNSUPPORTED_AUTHENTICATOR: 'addDevice:unsupported',
  ES256_NOT_SUPPORTED: 'addDevice:unsupported',
  INVALID_PUBLIC_KEY: 'addDevice:unsupported',
  CONTRACT_AUTH_FAILED: 'addDevice:binding',
  NETWORK_ERROR: 'addDevice:network',
};

const MAPS: Record<Screen, Partial<Record<KitErrorCode, DesignErrorKey>>> = {
  create: CREATE_MAP,
  sign: SIGN_MAP,
  recover: RECOVER_MAP,
  addDevice: ADDDEVICE_MAP,
};

const FALLBACK: Record<Screen, DesignErrorKey> = {
  create: 'create:unsupported',
  sign: 'sign:unsupported',
  recover: 'recover:unsupported',
  addDevice: 'addDevice:unsupported',
};

/** Resolve the design error key for a screen + headless error code. */
export function errorKeyFor(screen: Screen, code: KitErrorCode): DesignErrorKey {
  return MAPS[screen][code] ?? FALLBACK[screen];
}

/** Resolve the full design copy for a screen + headless error code. */
export function errorCopyFor(screen: Screen, code: KitErrorCode): ErrorCopy {
  return ERROR_COPY[errorKeyFor(screen, code)];
}
