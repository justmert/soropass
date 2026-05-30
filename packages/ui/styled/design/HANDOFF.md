# Handoff: Stellar Passkey UI

Drop-in reference components that let any web wallet add **passkey sign-in** for
Stellar smart-account wallets. A passkey (Face ID / Touch ID / Windows Hello /
security key) replaces the seed phrase: the device holds the key, and these
screens wrap the three moments where the user uses it — **Create**, **Sign**,
**Recover**.

---

## About the design files

The files in this bundle are **design references created in HTML/React+Babel** —
prototypes that demonstrate the intended look, copy, states, and interactions.
**They are not production code to copy verbatim.**

Your task is to **recreate these designs in the target codebase's environment**
using its established patterns and libraries. These components are meant to sit on
top of a **finished headless logic layer** (passkey/WebAuthn + Stellar smart-account
calls already exist) — so the work here is purely the **visual + interaction layer**.
Wire the documented events (`onCreate`, `onSign`, `onRecover`, `onSelect`, `onRetry`,
etc.) to that existing logic; don't reimplement crypto.

If there is no front-end environment yet, React is the natural choice (the reference
is React), but the design is framework-agnostic — every value comes from CSS custom
properties, so Vue/Svelte/Web Components work equally well.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, motion, and a11y behavior are
all specified below and in the files. Recreate pixel-faithfully, but **theme through
the token layer** — see "Theming contract."

---

## NON-NEGOTIABLE design principles (from the brief)

1. **Re-themeable by tokens ONLY.** Every color, radius, space, and font value comes
   from a single shared token set (`tokens.css`). An adopter restyles the whole set by
   overriding tokens — **never** by editing components. Do not hardcode raw values in
   components.
2. **One shared token set** across all three screens. No per-screen scale.
3. **Mobile-first**, works from **360px** width up; also adapts to a browser-extension
   popup and a centered web modal.
4. **Accessible:**
   - Visible focus ring on **every** interactive element.
   - Status messages announced: **polite** for progress/waiting, **assertive**
     (`role="alert"`) for errors.
   - Fully keyboard-navigable; the Recover list is a real listbox with a roving-focus
     pattern.
   - **RTL** support via CSS logical properties (`inline-start/end`, not left/right).
   - **Reduced-motion** variant (media query + a manual override attribute).
5. **The OS shows its own native passkey/biometric sheet ON TOP of our UI** during the
   passkey step. So the "waiting for the OS" states (`prompting`, `discovering`) must
   read as **calm and opaque** — a still panel with a gently pulsing glyph. **No spinner
   competing with the system dialog.** This is visually distinct from the "we're working"
   states (`deploying`, `submitting`) which DO show a spinner + progress bar.
6. **The error state is ONE layout** whose message swaps by an error code. **Do not build
   a separate screen per error.** Always show message + a "Try again" action.

---

## The three screens & their states (16 total)

### Screen 1 — Create passkey (5 states)
New wallet from a passkey; a smart account deploys on-chain. Primary action: **Create passkey**.

| State | What it shows |
|---|---|
| `idle` | Glyph + "Create your wallet" + one line explaining a passkey replaces a seed phrase + primary **Create passkey** + subtle "What's a passkey?" link. |
| `prompting` | OS passkey sheet is open on top; our card content dims, an **opaque calm panel** covers it with a pulsing passkey glyph + "Waiting for your passkey." Polite live region. |
| `deploying` | Passkey made, account deploying on-chain. **Spinner + indeterminate progress bar** + "Setting up your account…". Polite live region. |
| `success` | Centered: success glyph + "Wallet ready" + message + **truncated account address with copy-to-clipboard** + primary **Continue**. |
| `error` | One centered layout; copy swaps by code (see Error copy table). |

### Screen 2 — Sign transaction (5 states)
Approve a host-supplied transaction. Primary action: **Sign**.
**Important:** the transaction details come from the **host app** — the summary card
accepts `amount`, `destination`, and an `action`/function name as props. Don't assume
they originate inside the component.

| State | What it shows |
|---|---|
| `idle` | Header + **transaction summary card** (amount / destination / action) + secondary **Cancel** + primary **Sign** (row layout). The summary must stay legible as it moves into `prompting`. |
| `prompting` | OS sheet open; summary dims behind the calm opaque waiting panel. Polite. |
| `submitting` | Signature captured, submitting. Spinner + progress + "Submitting transaction…". Polite. |
| `done` | Centered: success glyph + "Transaction sent" + message + **transaction hash row** + primary **Done** + "View on explorer" link. |
| `error` | One centered layout; copy swaps by code. |

### Screen 3 — Recover (6 states)
Return on a new device; find accounts the passkey controls. Primary action: **Recover**.

| State | What it shows |
|---|---|
| `idle` | Glyph + "Find your account" + explanation + primary **Recover**. |
| `discovering` | OS sheet open; calm opaque waiting panel "Looking for your accounts." Polite. |
| `resolved` | **A selectable listbox** of 1..n matching accounts, each by truncated address + identicon + meta line. Full keyboard pattern. Primary **Continue** (disabled until a row is chosen). Handle 1-account and many-accounts cases. |
| `selected` | A row is chosen (`aria-selected`, brand highlight, check icon); **Continue** enabled. |
| `none` | Empty state: "No accounts found" + primary **Create a new passkey instead** + "Try a different passkey" link. |
| `error` | One centered layout; copy swaps by code. |

---

## Four distinct "busy" looks — get this right

| Look | States | Treatment |
|---|---|---|
| **OS sheet is open** | `prompting`, `discovering` | Card content dims to near-invisible (`--pk-busy-opacity`) behind an **opaque** scrim panel (`--pk-scrim` = surface color, fully opaque). Pulsing passkey glyph (72px), title, polite hint. **No spinner.** A 12px "OS sheet" hint bar peeks from the bottom edge. |
| **We're working** | `deploying`, `submitting` | No scrim. Branded **spinner** (`--pk-spinner-head` = info color) + **indeterminate progress bar** + title + polite hint, centered. |

---

## Error copy (ONE layout, swappable by code)

Layout: centered column → error glyph → bold title → message paragraph
(`role="alert"`, assertive, receives focus) → mono `error code: <key>` → full-width
**Try again** / **Retry** button.

| Code | Title | Message | Button |
|---|---|---|---|
| `create:cancelled` | Setup cancelled | You closed the passkey prompt before your wallet was created. You can try again whenever you're ready. | Try again |
| `create:unsupported` | Device not supported | This device or passkey can't be used to create a wallet. Try another device or security key. | Try again |
| `create:onchain` | Passkey not supported | This passkey type isn't supported for on-chain accounts yet. Try a different device or passkey. | Try again |
| `create:keyread` | Couldn't read your passkey | We couldn't read the key from this passkey. Please try again. | Try again |
| `create:setup` | Account setup didn't finish | Your passkey was created, but we couldn't finish setting up your account. Please try again. | Try again |
| `create:network` | Connection problem | We couldn't reach the network. Check your connection and try again. | Retry |
| `sign:cancelled` | Signing cancelled | You closed the passkey prompt before the transaction was signed. You can try again. | Try again |
| `sign:unsupported` | Device not supported | This device or passkey can't be used to sign. Try another device or security key. | Try again |
| `sign:verify` | Couldn't verify this request | This transaction may have changed or expired. Review the details and try again. | Try again |
| `sign:network` | Connection problem | We couldn't reach the network. Check your connection and try again. | Retry |
| `sign:signature` | Signature problem | The signature couldn't be completed. Please try signing again. | Try again |
| `recover:cancelled` | Recovery cancelled | You closed the passkey prompt before we finished. You can try again whenever you're ready. | Try again |
| `recover:unsupported` | Device not supported | This device or passkey can't be used to recover an account. Try another device or security key. | Try again |
| `recover:network` | Connection problem | We couldn't reach the network. Check your connection and try again. | Retry |

---

## Interactions & behavior

### Flow transitions (reference timing — replace with real async resolution)
- **Create:** `idle` → (Create passkey) → `prompting` → `deploying` → `success` | `error`
- **Sign:** `idle` → (Sign) → `prompting` → `submitting` → `done` | `error`; Cancel → `idle`
- **Recover:** `idle` → (Recover) → `discovering` → `resolved` (or `none`) → (select row) → `selected` → (Continue)

In the prototype these use `setTimeout`. In production, each transition is driven by
the headless layer resolving/rejecting (WebAuthn prompt result, on-chain deploy, submit,
account discovery).

### Focus management (after terminal states)
- `success` / `done` / `none` / `error` → focus lands on the **status/message paragraph**
  (`tabIndex={-1}`, focused with `{ preventScroll: true }`).
- `resolved` → focus lands on the **first account** in the list (roving tabindex).

### Recover listbox keyboard pattern (`role="listbox"`, options `role="option"`)
- **Up / Down** — move active option (wraps).
- **Home / End** — first / last.
- **Enter / Space** — choose the active option → transitions to `selected`.
- Roving focus: only the active row has `tabIndex=0`; the active row shows the focus ring
  (`.is-active`); the selected row shows `aria-selected="true"` + brand highlight + check icon.

### Address / hash handling
- **Always middle-truncate** long strings (`truncMiddle(s, lead, tail)` → e.g. `CA3F2B…G9KQ4`).
- Always offer **copy-to-clipboard**; show a check + "Address copied" for ~1.6s after copy.
- Each address gets a deterministic **identicon** (5×5 symmetric, hue derived from an
  FNV-1a hash of the address) so users can visually distinguish accounts.

### Motion
- Standard transitions 120/200/360ms on `cubic-bezier(0.2,0.6,0.2,1)`.
- Spinner 900ms linear; calm pulse 2000ms.
- **Reduced motion:** all durations collapse to ~1ms via `prefers-reduced-motion` AND a
  manual `[data-reduced-motion="true"]` override (for demos/testing).

---

## Theming contract (the ONLY styling surface)

All values live in `tokens.css` as CSS custom properties on `:root`, with a dark skin
under `[data-theme="dark"]` that overrides only the values that change. Components read
tokens exclusively.

**To re-theme:** override tokens on `:root` or a wrapping scope. Demonstrated overridable
axes (see the Tweaks panel in the prototype): light/dark, brand accent, corner radius,
density (spacing), reduced-motion, RTL.

### Token categories
- **Color:** `--pk-color-brand` (+ hover/active/on-brand/soft), `--pk-color-background`,
  `--pk-color-surface`, `--pk-color-surface-sunken`, `--pk-color-text` (+ muted/faint),
  `--pk-color-border` (+ strong).
- **Status color (semantically distinct):** `--pk-color-success`, `--pk-color-error`,
  `--pk-color-info` (progress) + `*-soft` variants. Errors are surfaced assertively,
  progress calmly.
- **Shape & space:** `--pk-radius-*` (none→full), `--pk-space-0..10`.
- **Typography:** `--pk-font-sans` (system stack), `--pk-font-mono` (addresses/hashes),
  `--pk-text-xs..xl`, `--pk-weight-regular/medium/semibold`, `--pk-leading-tight/normal`.
- **A11y / interaction extras:** focus ring (`--pk-focus-color/width/offset/halo`),
  busy/disabled (`--pk-disabled-opacity`, `--pk-busy-opacity`, `--pk-scrim`),
  spinner/progress tokens, elevation/z-index (`--pk-shadow-*`, `--pk-z-*` — our top layer
  stays at `--pk-z-toast` so it never fights the native OS sheet), motion/transition
  tokens with reduced-motion fallback.

Default theme: cool-neutral surfaces, indigo brand `oklch(0.55 0.18 264)`, system font
stack, thin (1.75px) line icons.

> **Note on color space:** the default tokens use `oklch()` and `color-mix(in oklch, …)`.
> These are well-supported in current evergreen browsers. If you must support older
> targets, transpile to hex/rgb at build time — but keep the token *names* intact.

---

## Components to build

| Component | Notes |
|---|---|
| `Card` | The shell. `max-width: 384px`, surface bg, 1px border, `--pk-radius-lg`, `--pk-shadow-md`, padding `--pk-space-6`, `overflow: hidden`, `isolation: isolate`. `is-waiting` modifier for the OS-sheet states. |
| `Button` | Variants `primary` / `secondary` / `ghost`. Min-height 48px (≥44 touch target). Optional leading icon and busy spinner. |
| `AddressChip` | Identicon + label + middle-truncated mono address + copy button. |
| `Identicon` | Deterministic 5×5 symmetric SVG from address hash. |
| `Spinner` | Token-driven ring; "we're working" color. |
| `StatusLine` / message | Live region; polite vs assertive. |
| `ErrorState` | The single error layout driven by `code`. |
| `WaitOverlay` | Opaque calm panel for `prompting`/`discovering`. |
| `WorkBlock` | Spinner + progress for `deploying`/`submitting`. |
| `TxSummary` | Amount (large) + rows (To / Action tag) from host props. |
| `RecoverList` | The listbox + roving focus + keyboard pattern. |

### Icons (thin line, 1.75px stroke, `currentColor`, 24px grid)
`passkey` (fingerprint), `key`, `shield-check`, `copy`, `check`, `check-circle`,
`alert`, `external`, `refresh`, `plus`, `chevron`, `help`, `arrow-left`. Full SVG
source in `icons.jsx` — reuse or map to your existing icon set.

---

## Files in this bundle

- `Stellar Passkey UI.html` — entry point. Mounts the design canvas (16 states grouped by
  screen, the "Where it runs" mobile/extension/web frames, and 3 live clickable prototypes)
  plus a Tweaks panel proving the token system re-themes everything.
- `tokens.css` — **the single shared token set** (light + dark, all categories above).
- `passkey.css` — component styles, built purely from tokens.
- `icons.jsx` — the SVG icon set.
- `primitives.jsx` — shared primitives (`truncMiddle`, `Identicon`, `Spinner`, `Button`,
  `AddressChip`, `StatusLine`, `ErrorState`) + the **error copy map** (`ERROR_COPY`).
- `screens.jsx` — the three screen components, each controlled by a `state` prop, plus
  `WaitOverlay`, `WorkBlock`, `TxSummary`, `RecoverList`, sample data, and the `Card` shell.
- `design-canvas.jsx`, `tweaks-panel.jsx` — presentation scaffolding only (the canvas and
  the live theming panel). **Not part of the shipped component** — ignore for production.

> The small monospace toolbar under each live prototype (restart / error-code select /
> account-count select / fail) is a **demo harness**, not part of the component.

## Recommended file structure in your codebase

```
passkey-ui/
  tokens.css                 # ← the theming surface; ship as-is, override to re-skin
  components/
    PasskeyCard.tsx
    Button.tsx
    AddressChip.tsx / Identicon.tsx
    Spinner.tsx / ProgressBar.tsx
    StatusMessage.tsx
    icons.tsx
  screens/
    CreatePasskey.tsx        # 5 states via a `state` prop or your state machine
    SignTransaction.tsx      # accepts host tx props: { amount, destination, action }
    RecoverAccount.tsx       # listbox + keyboard pattern
  errors.ts                  # ERROR_COPY map (code → { title, message, action })
```

Each screen is best modeled as a small **state machine** (`idle | prompting | … | error`)
fed by the headless layer's promises. Keep the error copy in one map keyed by `screen:code`.

## Assets
No external image assets. All icons are inline SVG (`icons.jsx`). Identicons are generated
at runtime from the address. Fonts use the native system stack (no web-font dependency).
