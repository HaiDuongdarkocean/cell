// === Atom Template — Rule of Three passed (≥3 behavior-sharing call sites) ===
// Copy to atoms/<Name>.tsx. Adapt to project framework (React shown).
//
// Rules:
// - Consume tokens only (no raw hex, no raw radius)
// - Variants via props, not CSS overrides
// - No `mode` prop that changes behavior (wrong abstraction signal)
// - Named export, typed props, JSDoc on every prop
// - Colocate test: <Name>.test.tsx

import type { ReactElement } from 'react';
// When copying this template into your project, create IconButton.module.css
// (CSS shown in comment block at bottom of this file) and uncomment the import:
// import styles from './IconButton.module.css';
const styles: Record<string, string> = new Proxy({}, { get: () => '' });

interface IconButtonProps {
  /** A11y label — required, no visible text in icon button. */
  'aria-label': string;
  /** Click handler. */
  onClick: () => void;
  /** Visual variant — same behavior, different styling. */
  variant?: 'default' | 'primary' | 'danger';
  /** Disabled state — no hover, no pointer. */
  disabled?: boolean;
  /** Active state (toggle pressed) — primary color + subtle bg. */
  active?: boolean;
  /** Tooltip text. */
  title?: string;
}

export function IconButton({
  'aria-label': ariaLabel,
  onClick,
  variant = 'default',
  disabled = false,
  active = false,
  title,
}: IconButtonProps): ReactElement {
  const className = [
    styles.iconBtn,
    variant === 'primary' && styles.primary,
    variant === 'danger' && styles.danger,
    active && styles.active,
    disabled && styles.disabled,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={title}
      disabled={disabled}
    >
      {/* icon passed as children or render prop — keep atom agnostic */}
    </button>
  );
}

// === IconButton.module.css — tokens only, no raw values ===
// .iconBtn {
//   width: 32px; height: 32px;
//   border: none;
//   border-radius: var(--radius-sm);
//   background: transparent;
//   color: var(--color-text-muted);
//   cursor: pointer;
//   transition: all var(--transition);
// }
// .iconBtn:hover { background: var(--color-surface-hover); color: var(--color-text); }
// .iconBtn:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 1px; }
// .primary { color: var(--color-primary); }
// .primary.active { background: var(--color-primary-subtle); }
// .danger { color: var(--color-error); }
// .danger:hover { background: var(--color-error-subtle); color: var(--color-error); }
// .disabled { opacity: 0.5; cursor: default; }
// .disabled:hover { background: transparent; color: var(--color-text-muted); }
