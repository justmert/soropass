# @soropass/ui consuming example

The five drop-in screens from `@soropass/ui` (connect, create, sign, recover, add device), mounted in a plain page with no framework, wired to the mock kit from `@soropass/core/testing`: real flow logic, a deterministic in-memory authenticator, no hardware and no network.

```bash
pnpm install
pnpm --filter @soropass/ui-example dev   # http://localhost:5173
```

What it demonstrates:

- Each screen is one `mount*Screen(root, options)` call plus a headless flow wired to two or three async callbacks. Swap the mock kit callbacks for real `@soropass/core` adapters and the screens do not change.
- Theming is token-driven: the "Acme theme" button re-skins every screen by overriding `--pk-*` custom properties on a wrapping class. No component CSS is edited and no design system is imposed.

Outside this monorepo, the same app builds from the published packages:

```bash
npm install @soropass/ui @soropass/core "@stellar/stellar-sdk@>=17"
```
