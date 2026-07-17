import { useState, useRef, useEffect, type ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './HintIcon.module.css';

/** Props for the HintIcon component. */
export interface HintIconProps {
  /** Hint text to display in popover. */
  hint: string;
  /** Accessible label for the hint button. */
  ariaLabel: string;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-testid for the button. */
  dataTestId?: string;
}

/**
 * HintIcon — info-circle button + floating popover with boundary detection
 * (settings-controls-restyle spec F6).
 *
 * Click icon → popover floats above icon with boundary detection:
 * - flip-top: if near top viewport edge, popover appears below icon
 * - align-right: if near left edge, popover right-aligned
 * - align-center: if both sides insufficient, popover centered
 *
 * Dismiss: click outside, Esc key, or click icon again.
 * Accessible: button + aria-expanded + aria-label, popover role="tooltip".
 */
export function HintIcon({
  hint,
  ariaLabel,
  id,
  dataTestId,
}: HintIconProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [positionClass, setPositionClass] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggle = (): void => {
    setIsOpen(!isOpen);
  };

  // Calculate position after popover is shown
  useEffect(() => {
    if (isOpen && buttonRef.current && popoverRef.current) {
      // Defer to next frame to ensure popover is rendered
      const rafId = requestAnimationFrame(() => {
        const btnRect = buttonRef.current?.getBoundingClientRect();
        const popoverRect = popoverRef.current?.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        if (!btnRect || !popoverRect) return;

        const padding = 8;
        const popoverHeight = popoverRect.height;
        const popoverWidth = popoverRect.width;

        let classes = '';

        // Vertical: check if popover would overflow top edge
        if (btnRect.top < popoverHeight + padding) {
          classes += ' flip-top';
        }

        // Horizontal: check alignment based on available space
        const spaceLeft = btnRect.left;
        const spaceRight = viewportWidth - btnRect.right;

        if (spaceLeft < popoverWidth / 2 && spaceRight < popoverWidth / 2) {
          classes += ' align-center';
        } else if (spaceLeft < popoverWidth) {
          classes += ' align-right';
        }

        setPositionClass(classes.trim());
      });

      return () => cancelAnimationFrame(rafId);
    } else {
      setPositionClass('');
    }
  }, [isOpen]);

  // Click outside dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (
        buttonRef.current &&
        popoverRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Esc key dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <span className={styles.hintWrap} ref={buttonRef}>
      <button
        type="button"
        id={id}
        data-testid={dataTestId}
        className={styles.hintBtn}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        <Icon name="info" />
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          className={`${styles.hintText} ${positionClass}`}
          role="tooltip"
        >
          {hint}
        </div>
      )}
    </span>
  );
}
