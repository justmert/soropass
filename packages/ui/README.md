# @soropass/ui

[![npm](https://img.shields.io/npm/v/@soropass/ui.svg)](https://www.npmjs.com/package/@soropass/ui)
[![license](https://img.shields.io/npm/l/@soropass/ui.svg)](./LICENSE)

Drop-in UI for passkey smart accounts on Stellar: create, connect, sign, recover, and add-device screens, built on [`@soropass/core`](https://www.npmjs.com/package/@soropass/core). Two layers ship side by side, so you take exactly as much as you want:

- **Headless** (`@soropass/ui/headless`): the flow state machines (logic, state transitions, accessibility, copy), with no styling. Wire them into your own components.
- **Styled** (`@soropass/ui/styled`): mountable screens for every flow, themed entirely through CSS custom properties. Drop them in without adopting a design system.

The styled layer is optional and token-driven, so you re-skin it by swapping token values, never by forking component code. The library is framework-agnostic (it mounts into a DOM element); a small wrapper adopts it in React with no runtime dependency.

## Install

```bash
npm install @soropass/ui "@stellar/stellar-sdk@>=17"
```

`@soropass/core` comes in as a dependency. `@stellar/stellar-sdk` is a peer of the core SDK, so install it alongside at version 17 or newer (the `>=17` peer range this release builds against).

## Quick start

Wrap a core call in a headless **flow** (a state machine: `idle -> prompting -> deploying -> success | error`) and mount the styled screen:

```ts
import { createPasskey, factoryDeployer } from '@soropass/core';
import { createCreatePasskeyFlow } from '@soropass/ui/headless';
import { mountCreateScreen } from '@soropass/ui/styled';
import '@soropass/ui/styled.css';

const flow = createCreatePasskeyFlow({
  userActivation: navigator.userActivation, // enforces the Safari user-gesture rule
  async create({ userName }) {
    return createPasskey({ rpId: location.hostname, rpName: 'My App', userName, deployer });
  },
});

const { unmount } = mountCreateScreen(document.getElementById('slot'), { flow });
```

The same shape gives you `mountConnectScreen`, `mountSignScreen`, `mountRecoverScreen`, and `mountAddDeviceScreen`, each paired with a headless `createSignFlow` / `createRecoverFlow` / `createAddDeviceFlow`.

## Theming

Every visual value is a `--pk-*` CSS custom property. Override them in your own stylesheet to match your brand; light and dark are both covered. Import the base tokens directly if you want them without the component styles:

```css
@import '@soropass/ui/tokens.css';
```

## Exports

| Subpath                   | Contents                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@soropass/ui/headless`   | `createCreatePasskeyFlow`, `createSignFlow`, `createRecoverFlow`, `createAddDeviceFlow` and their flow types |
| `@soropass/ui/styled`     | `mountCreateScreen`, `mountConnectScreen`, `mountSignScreen`, `mountRecoverScreen`, `mountAddDeviceScreen`   |
| `@soropass/ui/styled.css` | Styles for the mounted screens                                                                               |
| `@soropass/ui/tokens.css` | The `--pk-*` design tokens on their own                                                                      |

## Documentation

- Components and states: [docs.soropass.dev/docs/components](https://docs.soropass.dev/docs/components)
- Theming and tokens: [docs.soropass.dev/docs/theming](https://docs.soropass.dev/docs/theming)
- The SDK the screens call: [`@soropass/core`](https://www.npmjs.com/package/@soropass/core)

## License

Apache-2.0
