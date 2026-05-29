/**
 * Accessibility prop-getters. Framework-agnostic plain objects — spread onto any
 * element (React/Vue/vanilla). No styling, ever.
 */
export interface StatusProps {
  /** Live region announcing flow status to screen readers. */
  role: 'status';
  'aria-live': 'polite' | 'assertive';
  'aria-atomic': true;
  /** Focusable so a consumer can move focus to it on completion/error. */
  tabIndex: -1;
  /** The translated status string. */
  children: string;
}

export interface TriggerProps {
  type: 'button';
  disabled: boolean;
  'aria-busy': boolean;
  'aria-label': string;
  onClick: () => void;
}

export interface ListProps {
  role: 'listbox';
  'aria-label': string;
}

export interface OptionProps {
  role: 'option';
  'aria-selected': boolean;
  id: string;
  tabIndex: number;
  onClick: () => void;
}
