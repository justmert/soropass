import { KitError } from './errors';

/**
 * Stable identifiers for the three battle-tested anchors (S04 / YK-430) — the
 * bugs that silently break ~50% of users. Referenced by stable name from the
 * threat model (S14) and the compatibility matrix (S09) so each mitigation has
 * one canonical id across code and docs.
 */
export const BATTLE_TESTED_ANCHORS = Object.freeze({
  /** Apple Touch ID/Face ID emit high-S ~50% of the time; we normalize to low-S. */
  LOW_S_NORMALIZATION: 'low-s-normalization',
  /** Non-ES256 credentials (e.g. some Windows Hello configs) cannot verify on-chain. */
  RS256_HARD_FAIL: 'rs256-hard-fail',
  /** Safari requires create/get inside a user activation or it silently rejects. */
  APPLE_USER_GESTURE: 'apple-user-gesture',
} as const);

export type BattleTestedAnchor = (typeof BATTLE_TESTED_ANCHORS)[keyof typeof BATTLE_TESTED_ANCHORS];

/** COSE algorithm id for ES256 (ECDSA w/ SHA-256 over P-256). */
const ALG_ES256 = -7;

/**
 * Anchor `RS256_HARD_FAIL`. The Soroban webauthn-wallet verifies *only*
 * secp256r1, so a non-ES256 credential would produce an unusable account.
 * Hard-fail rather than continue (invariant #1).
 */
export function assertES256(alg: number): void {
  if (alg !== ALG_ES256) {
    throw new KitError('ES256_NOT_SUPPORTED', `COSE alg ${alg} is not ES256 (-7)`);
  }
}

interface UserActivationLike {
  isActive: boolean;
}

/**
 * Anchor `APPLE_USER_GESTURE`. `navigator.credentials.create/get` on
 * Safari/WebKit must run inside a transient user activation (a real click/tap)
 * or the promise silently rejects. Call this at the very top of a create/sign
 * handler.
 *
 * UI pattern (for S18): never auto-trigger the ceremony from a mount/effect —
 * always gate it behind an explicit user click, and surface `USER_CANCELLED`
 * in the flow state machine. Lenient when `navigator.userActivation` is
 * unavailable (non-browser / older engines) so the SDK stays isomorphic; pass
 * an explicit `{ isActive }` to force the check.
 */
export function assertUserActivation(activation?: UserActivationLike): void {
  const ua =
    activation ??
    (globalThis.navigator as { userActivation?: UserActivationLike } | undefined)?.userActivation;
  if (ua && !ua.isActive) {
    throw new KitError(
      'USER_CANCELLED',
      'WebAuthn ceremony must be invoked inside a user activation (click/tap)',
    );
  }
}
