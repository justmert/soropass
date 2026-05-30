# UI framework decision (S20 · YK-446)

> RFP Deliverable #3 asks us to choose framework-agnostic vs framework-specific
> for the UI, **with rationale**. This is that decision.

## TL;DR

| Layer                                 | What ships                                                                                         | Framework dependency |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| **Logic / state / a11y / i18n** (S18) | `@stellar-passkey/ui/headless` — framework-agnostic state machines + a11y prop-getters + i18n keys | **none**             |
| **Styled reference** (S20)            | `@stellar-passkey/ui/styled` — vanilla-DOM `mount*` renderers + `styled.css`/`tokens.css`          | **none**             |
| **Theming surface**                   | `tokens.css` (CSS custom properties)                                                               | **none** (CSS)       |

We ship **framework-agnostic** at every layer. There is **no React/Vue/Svelte
runtime dependency** anywhere in the package. Framework wrappers are a thin,
optional adopter concern — and because the headless layer already owns all logic,
state, accessibility, and i18n, a wrapper is ~20 lines (examples below), not a
re-implementation.

## Decision

1. **Headless core stays framework-agnostic** (already true from S18). It is the
   product: the create/sign/recover state machines, the a11y prop-getters
   (`getTriggerProps`, `getStatusProps`, `getListProps`, `getOptionProps`), and
   the i18n message keys. Zero DOM, zero framework.
2. **The styled reference layer is also framework-agnostic.** It is a set of
   `mount*Screen(root, { flow, … })` functions that render plain DOM and bind to
   a headless flow. All visual values come from CSS custom properties in
   `tokens.css`; the markup is identical to the design reference, so the result is
   **pixel-identical** to the React prototype in the handoff.
3. **No framework wrapper is shipped as the default.** Instead we document thin
   wrappers (React/Vue/Web Component) that adopters drop in. If wallet teams ask
   for a first-class React package, it is a small follow-up that _wraps_ the
   headless flow + `mount` — not a rewrite.

## Why framework-agnostic (not "React first")

- **Invariant #5 — minimal API surface; large frameworks lose RFP points.** A
  React/React-DOM peer dependency is the single biggest dependency we could add
  to a "minimal, headless" SDK. The brief explicitly rewards staying lean.
- **No design-system lock-in (the actual deliverable).** "Looks great out of the
  box, re-theme by tokens." That promise lives in `tokens.css`, not in a
  component framework. Shipping framework-free keeps the promise literal.
- **The design's fidelity is 100% in the tokens + CSS.** The handoff is an
  HTML/React+Babel _reference_, and its README is explicit: "framework-agnostic —
  every value comes from CSS custom properties, so Vue/Svelte/Web Components work
  equally well … recreate these designs in the target codebase's environment using
  its established patterns." Our renderer emits the same class names against the
  same `passkey.css`, so it is faithful without importing React.
- **The repo's established UI pattern is already vanilla mount functions**
  (`apps/demo/src/headlessHarness.ts`). Matching it keeps the codebase coherent
  and the build trivial (no JSX toolchain, no `@types/react`, nothing new in
  `tsup`).
- **The prop-getter shape composes everywhere.** `{ role, 'aria-live', onClick, … }`
  objects spread onto a React element, a Vue template, or a DOM node identically.
  The headless layer was designed for this.
- **Widest adoption surface for an RFP reference.** A wallet team on Svelte, Lit,
  or vanilla can adopt the styled layer as-is; a React team adds a 20-line wrapper.
  The reverse (a React-only package) excludes everyone else.

### What we explicitly did **not** do, and why

- **Ship a React component package.** Rejected as the _default_ (adds the heaviest
  dependency, narrows adoption). Kept as a documented, trivial wrapper. Revisit if
  adopters ask — it is additive and low-risk.
- **Ship Web Components / custom elements.** A reasonable framework-agnostic
  alternative, but it adds a registration/shadow-DOM model and complicates
  token inheritance and testing for no fidelity gain over plain `mount`. Documented
  as a wrapper instead.

## What ships

```
@stellar-passkey/ui
  /headless     → flows + a11y prop-getters + i18n   (no DOM, no framework)
  /styled       → mountCreateScreen / mountSignScreen / mountRecoverScreen,
                  pure views, the error connector, identicon/icons helpers
  /styled.css   → tokens.css + passkey.css (one import)
  /tokens.css   → the theming surface alone (override to re-skin)
```

Subpath exports keep them independent: an adopter can use `headless` with their
own styles, or `styled` for the drop-in look.

## How adopters consume it

**Vanilla / any framework:**

```ts
import { createCreatePasskeyFlow } from '@stellar-passkey/ui/headless';
import { mountCreateScreen } from '@stellar-passkey/ui/styled';
import '@stellar-passkey/ui/styled.css';

const flow = createCreatePasskeyFlow({ create, userActivation: navigator.userActivation });
const { unmount } = mountCreateScreen(document.getElementById('slot')!, { flow });
```

**React (thin wrapper — no package needed):**

```tsx
function CreatePasskey(props: CreateScreenOptions) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => mountCreateScreen(ref.current!, props).unmount, []);
  return <div ref={ref} className="pk" />;
}
```

**Vue:** the same shape in `onMounted` / `onUnmounted`. **Lit/Web Component:** call
`mount*` in `connectedCallback`, return the handle's `unmount` from
`disconnectedCallback`.

## Re-theme contract (the S20 gate)

Override tokens on `:root` or any wrapping scope — **never edit components**:

```css
.my-wallet {
  --pk-color-brand: oklch(0.7 0.13 190); /* teal */
  --pk-radius-lg: 4px;
}
.my-wallet[data-theme='dark'] {
  /* dark skin ships in tokens.css */
}
```

Proven by `apps/demo` (a live tweaks bar) and asserted in
`apps/demo/e2e/passkey.spec.ts` ("a single token override restyles every card —
no component code change"), plus a `prefers-reduced-motion` / `[data-reduced-motion]`
fallback and RTL via logical properties.

## Connector notes (headless ↔ design)

The styled layer adds two things over the raw headless contract, isolated so the
headless package stays pure:

1. **Error connector** (`errors.ts`): maps the 10 screen-agnostic `KitErrorCode`s
   to the design's one-layout-per-screen error copy (`create:cancelled`, …). Every
   code maps to valid copy on every screen (tested).
2. **Listbox keyboard pattern** (`recoverScreen.ts`): the headless `RecoverFlow`
   ships listbox roles + selection but deliberately no key handler; the styled
   layer adds roving focus + ↑/↓/Home/End/Enter/Space.

Folded in alongside S20: `browserWebAuthnClient` now maps a dismissed-sheet
`NotAllowedError` → `USER_CANCELLED`, so the cancel copy is reached on the real
path (was previously the generic unsupported fallback).
