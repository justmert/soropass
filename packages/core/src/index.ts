/**
 * `@stellar-passkey/core` — the minimal, headless, ES256-only passkey SDK.
 *
 * The public surface is intentionally tiny. Crypto primitives (S03/YK-429),
 * battle-tested anchors (S04/YK-430), Soroban auth assembly (S11/YK-437),
 * pluggable adapters (S12/YK-438), and the `create`/`connect`/`recover`
 * ceremonies (S13/YK-439) are added in their own issues — this skeleton only
 * pins the package identity so the monorepo builds and tree-shakes.
 */
export const SDK_VERSION = '0.0.0';
