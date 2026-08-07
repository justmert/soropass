# SoroPass passkey screens — usage conventions

These are the SoroPass wallet's passkey-flow screens: create a wallet, sign a
transaction, recover an account, connect, and add a backup device. They wrap the
framework-agnostic `@soropass/ui` styled layer, so every screen is a real,
shippable SoroPass part — never restyle their internals; theme with tokens.

## One component = one flow state, driven by `state`

Each screen renders a single state of its flow, chosen by the `state` prop (a
discriminated union keyed on `status`). Build a working flow by advancing `state`
as the ceremony progresses:

- **CreatePasskeyScreen** — `idle` → `prompting` → `deploying` → `success` | `error`
- **SignTransactionScreen** — `idle` → `prompting` → `submitting` → `done` | `error`; also takes a host-supplied `tx` summary (amount, destination, action)
- **RecoverAccountScreen** — `idle` → `discovering` → `resolved` (account list) | `none` | `error`
- **AddDeviceScreen** — `idle` → `prompting` → `binding` → `success` | `error`
- **ConnectScreen** — stateless entry chooser (create-new vs use-existing)

Omit `state` to get the `idle` entry screen. Error states take a `code` (a
`KitErrorCode` such as `USER_CANCELLED` or `NETWORK_ERROR`); the screen maps it to
the right user-facing copy automatically — you do not write the error message.

## Theming — tokens, never component CSS

All styling comes from `@soropass/ui/styled.css` (shipped here as `styles.css`).
Re-theme by overriding the `--pk-*` custom properties on `:root` or any wrapping
scope — never edit the component rules. Tokens cover color, radius, spacing, and
type; light and dark both work by overriding the color tokens. Every screen
renders inside a `.pk` root element, so scoping a theme to `.pk` (or a wrapper
around it) is safe.

## Composition

These are drop-in cards sized for a wallet modal or a centered column. They own
their internal layout and every state; the host supplies data (a `tx` summary, a
list of `accounts`) and reacts as the flow advances. To change how a screen looks,
swap tokens or change `state` — do not reach inside a card.
