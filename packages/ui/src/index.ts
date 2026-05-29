/**
 * `@stellar-passkey/ui` — headless-first UI for passkey create/sign/recover.
 * The headless primitives (logic + a11y + i18n, no styles) are the umbrella
 * export; prefer `@stellar-passkey/ui/headless`. The styled layer is
 * design-gated (S19 → S20) and ships separately.
 */
export * from './headless';
