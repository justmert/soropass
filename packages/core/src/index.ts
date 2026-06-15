/**
 * `@soropass/core` — minimal, headless, ES256-only passkey SDK.
 *
 * The umbrella entry re-exports the subpath modules. Prefer importing from the
 * subpaths (`@soropass/core/sign`, `/create`, `/types`, …) for the best
 * tree-shaking; this package is `sideEffects: false`.
 */
export * from './types';
export * from './create';
export * from './sign';
export * from './connect';
export * from './recover';
export * from './adapters';
