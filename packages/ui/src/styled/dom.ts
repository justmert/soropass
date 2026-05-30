/**
 * Tiny framework-agnostic DOM helpers for the styled layer. No framework
 * runtime — just `document`. Everything here is called lazily (inside mount /
 * view functions) so importing this module never touches `document` (SSR-safe).
 */

export type Child = Node | string | null | undefined | false;

interface ElProps {
  class?: string;
  html?: string;
  [key: string]: unknown;
}

/** Hyperscript: `h('button', { class: 'pk-btn', onClick }, 'Label')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElProps | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'html') el.innerHTML = String(value);
      else if (key === 'tabIndex') el.tabIndex = Number(value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key.startsWith('aria-')) {
        el.setAttribute(key, String(value));
      } else if (typeof value === 'boolean') {
        if (value) el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** Middle-truncate a long string: `truncMiddle('CA3F2…', 6, 4)` → `CA3F2B…G9KQ4`. */
export function truncMiddle(s: string, lead = 6, tail = 4): string {
  if (!s || s.length <= lead + tail + 1) return s;
  return `${s.slice(0, lead)}…${s.slice(-tail)}`;
}

/** FNV-1a — deterministic 32-bit hash for identicon hue + cells. */
export function hashStr(s: string): number {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type IconName =
  | 'passkey'
  | 'key'
  | 'shield'
  | 'copy'
  | 'check'
  | 'checkCircle'
  | 'alert'
  | 'external'
  | 'refresh'
  | 'plus'
  | 'chevron'
  | 'help'
  | 'arrowLeft';

// Thin-line (1.75) 24px-grid icon inner markup — verbatim from the design's icons.jsx.
const ICON_PATHS: Record<IconName, string> = {
  passkey:
    '<path d="M12 10a2 2 0 0 1 2 2c0 2.5-.4 5-1.2 7"/><path d="M8.5 6.6A6 6 0 0 1 18 12c0 1.2-.1 2.4-.3 3.5"/><path d="M6 12a6 6 0 0 1 .8-3"/><path d="M6.2 16.5c.4-1.3.6-2.8.6-4.5a5 5 0 0 1 .3-1.7"/><path d="M9 19c.7-1.4 1-3.3 1-5.5a2 2 0 0 1 .2-1"/><path d="M15.4 17.8c.2-.9.3-1.9.4-2.8"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 19 4"/><path d="M16 7l2.5 2.5"/><path d="M14 9l2.5 2.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 11.5l2 2 4-4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.6 2.6L16 9.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16.2v.1"/>',
  external:
    '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"/>',
  refresh:
    '<path d="M19 8a7 7 0 0 0-12-2L5 8"/><path d="M5 4v4h4"/><path d="M5 16a7 7 0 0 0 12 2l2-2"/><path d="M19 20v-4h-4"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1.9-1.1 1.8"/><path d="M12 16.5v.1"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
};

/** Build an `<svg>` icon element (currentColor, thin line). */
export function icon(name: IconName, size = 24): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML =
    `<svg viewBox="0 0 24 24" width="${String(size)}" height="${String(size)}" fill="none" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
  return tpl.content.firstChild as SVGElement;
}

/**
 * Deterministic 5×5 symmetric identicon, brand-hued from the address hash — so
 * users can visually tell accounts apart. Returns an inline `<svg>`.
 */
export function identicon(seed: string, size = 28): SVGElement {
  const hash = hashStr(seed);
  const hue = hash % 360;
  const fg = `oklch(0.6 0.15 ${String(hue)})`;
  const bg = `oklch(0.94 0.02 ${String(hue)})`;
  const cell = size / 5;
  let rects = `<rect width="${String(size)}" height="${String(size)}" fill="${bg}"/>`;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (((hash >> (y * 3 + x)) & 1) === 0) continue;
      const xs = x === 2 ? [2] : [x, 4 - x];
      for (const cx of xs) {
        rects +=
          `<rect x="${String(cx * cell)}" y="${String(y * cell)}" ` +
          `width="${String(cell)}" height="${String(cell)}" fill="${fg}"/>`;
      }
    }
  }
  const tpl = document.createElement('template');
  tpl.innerHTML =
    `<svg class="pk-identicon" viewBox="0 0 ${String(size)} ${String(size)}" ` +
    `width="${String(size)}" height="${String(size)}" aria-hidden="true">${rects}</svg>`;
  return tpl.content.firstChild as SVGElement;
}
