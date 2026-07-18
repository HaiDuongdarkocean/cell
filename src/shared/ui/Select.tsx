import { useState, useRef, useEffect, useCallback, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  /** HTML id. */
  id?: string;
  /** HTML name. */
  name?: string;
  /** Current value. */
  value?: string;
  /** Options list. */
  options: SelectOption[];
  /** Placeholder shown when value is empty. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Error state. */
  error?: boolean;
  /** Called with the new value when selection changes. */
  onChange?: (value: string) => void;
  /** Optional class name. */
  className?: string;
  /** Max height of the dropdown menu in pixels. */
  menuMaxHeight?: number;
  /** Horizontal alignment of the dropdown menu relative to the trigger.
   *  - 'left'  (default): menu's left edge aligns with trigger's left edge (opens rightward).
   *  - 'right': menu's right edge aligns with trigger's right edge (opens leftward).
   *  Use 'right' when the select sits on the right side of a row so the
   *  menu doesn't overflow the card/container. */
  menuAlign?: 'left' | 'right';
  /** Optional data-testid for the root element. */
  'data-testid'?: string;
}

/**
 * Select — custom single-select dropdown with a styled scrollable menu.
 *
 * Uses a button trigger + listbox menu instead of a native `<select>` so the
 * dropdown scrollbar can be themed with the design-system tokens (same as
 * Dialog and SearchableSelect). Native `<select>` dropdowns are rendered by the
 * OS and cannot be styled reliably.
 */
export function Select({
  id,
  name,
  value,
  options,
  placeholder,
  disabled,
  error,
  onChange,
  className,
  menuMaxHeight = 220,
  menuAlign = 'left',
  'data-testid': dataTestId,
}: SelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex !== -1 ? options[selectedIndex] : null;

  const openMenu = useCallback((): void => {
    if (disabled) return;
    setHighlightedIndex(selectedIndex !== -1 ? selectedIndex : 0);
    setIsOpen(true);
  }, [disabled, selectedIndex]);

  const closeMenu = useCallback((): void => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const selectOption = useCallback(
    (optionValue: string): void => {
      if (optionValue !== value) {
        onChange?.(optionValue);
      }
      closeMenu();
      triggerRef.current?.focus();
    },
    [onChange, value, closeMenu]
  );

  // Close on click outside.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: Event): void => {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeMenu]);

  // Close on Esc and focus stays inside.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  const handleTriggerClick = (): void => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      }
    } else if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(options.length - 1);
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        if (next >= options.length) return prev;
        // Skip disabled options.
        if (options[next]?.disabled) {
          const after = next + 1;
          return after < options.length ? after : prev;
        }
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        if (next < 0) return prev;
        if (options[next]?.disabled) {
          const before = next - 1;
          return before >= 0 ? before : prev;
        }
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const highlighted = options[highlightedIndex];
      if (highlighted && !highlighted.disabled) {
        selectOption(highlighted.value);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(options.length - 1);
    }
  };

  const handleOptionClick = (e: MouseEvent<HTMLDivElement>, optionValue: string, optionDisabled?: boolean): void => {
    e.stopPropagation();
    if (optionDisabled) return;
    selectOption(optionValue);
  };

  const handleMouseEnter = (index: number): void => {
    if (!options[index]?.disabled) {
      setHighlightedIndex(index);
    }
  };

  const rootClass = [styles.root, error ? styles.error : '', disabled ? styles.disabled : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const triggerLabel = selectedOption ? selectedOption.label : (placeholder ?? '');

  return (
    <div className={rootClass} ref={menuRef} data-testid={dataTestId}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={error || undefined}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.value}>{triggerLabel}</span>
        <Icon
          name="chevronDown"
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`${styles.menu} ${menuAlign === 'right' ? styles.menuAlignRight : styles.menuAlignLeft}`}
          role="listbox"
          aria-activedescendant={highlightedIndex >= 0 ? `select-option-${options[highlightedIndex]?.value}` : undefined}
          style={{ maxHeight: menuMaxHeight }}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((opt, index) => (
            <div
              key={opt.value}
              id={`select-option-${opt.value}`}
              className={[
                styles.option,
                opt.value === value ? styles.optionSelected : '',
                index === highlightedIndex ? styles.optionHighlighted : '',
                opt.disabled ? styles.optionDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="option"
              aria-selected={opt.value === value}
              onClick={(e) => handleOptionClick(e, opt.value, opt.disabled)}
              onMouseEnter={() => handleMouseEnter(index)}
            >
              <span className={styles.optionLabel}>{opt.label}</span>
              {opt.value === value && (
                <Icon name="check" className={styles.checkMark} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
