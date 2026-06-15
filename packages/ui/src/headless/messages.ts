import { KIT_ERROR_CODES, type KitErrorCode } from '@soropass/core/types';

export type Translate = (key: string) => string;

/** Default English copy. Consumers pass their own `translate` for i18n. */
export const DEFAULT_MESSAGES: Record<string, string> = {
  'passkey.create.idle': 'Create a passkey',
  'passkey.create.prompting': 'Waiting for your passkey…',
  'passkey.create.deploying': 'Setting up your account…',
  'passkey.create.success': 'Passkey created',
  'passkey.create.trigger': 'Create passkey',

  'passkey.sign.idle': 'Ready to sign',
  'passkey.sign.prompting': 'Confirm with your passkey…',
  'passkey.sign.submitting': 'Submitting…',
  'passkey.sign.done': 'Done',
  'passkey.sign.trigger': 'Sign',

  'passkey.recover.idle': 'Recover your account',
  'passkey.recover.discovering': 'Looking for your passkey…',
  'passkey.recover.resolved': 'Choose an account',
  'passkey.recover.selected': 'Account selected',
  'passkey.recover.none': 'No accounts found for this passkey',
  'passkey.recover.trigger': 'Recover with passkey',

  'passkey.error.generic': 'Something went wrong. Please try again.',
  'passkey.error.USER_CANCELLED': 'You cancelled the passkey prompt.',
  'passkey.error.ES256_NOT_SUPPORTED':
    'This device created an unsupported key type (ES256 is required).',
  'passkey.error.RP_ID_MISMATCH': 'This passkey belongs to a different site.',
  'passkey.error.ORIGIN_MISMATCH': 'This passkey belongs to a different origin.',
  'passkey.error.CHALLENGE_MISMATCH': 'The signature did not match the request. Please try again.',
  'passkey.error.INVALID_SIGNATURE_DER': 'The authenticator returned an invalid signature.',
  'passkey.error.INVALID_PUBLIC_KEY': 'The authenticator returned an invalid public key.',
  'passkey.error.CONTRACT_AUTH_FAILED': 'The network rejected the authorization.',
  'passkey.error.NETWORK_ERROR': 'Network error. Please check your connection and try again.',
  'passkey.error.UNSUPPORTED_AUTHENTICATOR':
    'This device or browser does not support passkeys here.',
};

// Compile-time-ish guard: ensure every KitErrorCode has a default message.
for (const code of KIT_ERROR_CODES) {
  if (!(`passkey.error.${code}` in DEFAULT_MESSAGES)) {
    DEFAULT_MESSAGES[`passkey.error.${code}`] = DEFAULT_MESSAGES['passkey.error.generic'] ?? code;
  }
}

export const defaultTranslate: Translate = (key) => DEFAULT_MESSAGES[key] ?? key;

export function errorKey(code: KitErrorCode): string {
  return `passkey.error.${code}`;
}
