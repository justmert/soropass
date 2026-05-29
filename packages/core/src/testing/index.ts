/**
 * `@stellar-passkey/core/testing` — deterministic mock mode for downstream
 * adopters + tests (S15). Kept in a separate entry so none of it lands in
 * production bundles.
 */
export { createPasskeyKit } from './kit';
export type { CreatePasskeyKitOptions, PasskeyKit } from './kit';
export { mockAuthenticator } from './mockAuthenticator';
export type { MockAuthenticator, MockAuthenticatorOptions } from './mockAuthenticator';
export { createInMemoryBackend } from './inMemory';
export type { InMemoryBackend } from './inMemory';
