import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import { useMenuPlacement } from './useMenuPlacement';
import { pushEscapeLayer } from './escapeLayerStack';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Optional string used for filtering when `searchable` is true.
   * Falls back to `label` if it is a plain string. */
  searchLabel?: string;
  disabled?: boolean;
}

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'outline' | 'filled' | 'ghost';
export type SelectValidation = 'error' | 'success' | 'warning';

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
  /** Error state. Kept for backward compatibility; prefer `state="error"`. */
  error?: boolean;
  /** Visual size of the trigger. */
  size?: SelectSize;
  /** Visual variant of the trigger. */
  variant?: SelectVariant;
  /** Validation state of the trigger. */
  state?: SelectValidation;
  /** Called with the new value when selection changes. */
  onChange?: (value: string) => void;
  /** Optional class name. */
  className?: string;
  /** Max height of the dropdown menu in pixels. */
  menuMaxHeight?: number;
  /** Horizontal alignment of the dropdown menu relative to the trigger.
   *  - 'left'  (default): menu's left edge aligns with trigger's left edge.
   *  - 'right': menu's right edge aligns with trigger's right edge.
   *  - 'auto': pick the side with more viewport room.
   * The menu will still flip to the opposite side if it does not fit. */
  menuAlign?: 'left' | 'right' | 'auto';
  /** Whether the menu has a search input to filter long option lists. */
  searchable?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Optional data-cell-id for the root element. */
  'data-cell-id'?: string;
  /** Accessible label for the trigger button. */
  'aria-label'?: string;
}

/**
 * Select — custom single-select dropdown with a styled scrollable menu.
 *
 * Uses a button trigger + listbox menu instead of a native `<select>` so the
 * dropdown scrollbar can be themed with the design-system tokens (same as
 * Dialog and SearchableSelect).
 */
export function Select({
  id,
  name,
  value,
  options,
  placeholder,
  disabled,
  error,
  size = 'md',
  variant = 'filled',
  state,
  onChange,
  className,
  menuMaxHeight,
  menuAlign = 'left',
  searchable = false,
  searchPlaceholder = 'Search...',
  'data-cell-id': dataTestId,
  'aria-label': ariaLabel,
}: SelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex !== -1 ? options[selectedIndex] : null;

  const validationState = state ?? (error ? 'error' : undefined);

  const { placement, style: menuStyle } = useMenuPlacement({
    isOpen,
    menuAlign,
    menuMaxHeight,
    triggerRef,
    menuRef,
  });

  const optionSearchLabel = useCallback((opt: SelectOption): string => {
    if (opt.searchLabel !== undefined) return opt.searchLabel;
    if (typeof opt.label === 'string') return opt.label;
    return '';
  }, []);

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) => optionSearchLabel(opt).toLowerCase().includes(q));
  }, [options, query, searchable, optionSearchLabel]);

  const openMenu = useCallback((): void => {
    if (disabled) return;
    setQuery('');
    setHighlightedIndex(selectedIndex !== -1 ? selectedIndex : 0);
    setIsOpen(true);
  }, [disabled, selectedIndex]);

  const closeMenu = useCallback((): void => {
    setIsOpen(false);
    setQuery('');
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
  // ponytail: use `composedPath()` instead of `e.target` — inside shadow DOM,
  // `e.target` is retargeted to the shadow host, so `menuRef.contains(e.target)`
  // returns false even when clicking an option inside the menu, causing the
  // menu to close before the option's onClick fires. `composedPath()` crosses
  // shadow boundaries and includes the real clicked element. The menu is
  // rendered in a portal, so we also check the menu element itself.
  useEffect(() => {
    if (!isOpen) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    const handleClickOutside = (e: Event): void => {
      if (!rootRef.current || !triggerRef.current || !menuRef.current) return;
      const path = e.composedPath();
      if (
        !path.includes(rootRef.current) &&
        !path.includes(triggerRef.current) &&
        !path.includes(menuRef.current)
      ) {
        closeMenu();
      }
    };
    const handleScroll = (): void => closeMenu();
    doc.addEventListener('mousedown', handleClickOutside);
    win.addEventListener('scroll', handleScroll, true);
    return () => {
      doc.removeEventListener('mousedown', handleClickOutside);
      win.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, closeMenu]);

  // Close on Esc and focus stays inside. Registered on the shared Escape
  // stack (capture phase) so a nested overlay like this menu consumes the key
  // before ancestor surfaces (e.g. UniversalPanel) can react to it.
  useEffect(() => {
    if (!isOpen) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    return pushEscapeLayer((e) => {
      e.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    }, doc);
  }, [isOpen, closeMenu]);

  // Move focus to the listbox (or search input) when the menu opens.
  useEffect(() => {
    if (isOpen) {
      if (searchable) {
        searchRef.current?.focus();
      } else {
        listboxRef.current?.focus();
      }
    }
  }, [isOpen, searchable]);

  const handleListboxKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Tab') {
      closeMenu();
      return;
    }
    handleMenuKeyDown(e);
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      closeMenu();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, visibleOptions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && visibleOptions.length > 0) {
      e.preventDefault();
      const highlighted = visibleOptions[highlightedIndex];
      if (highlighted && !highlighted.disabled) {
        selectOption(highlighted.value);
      }
    }
  };

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
      } else if (searchable) {
        searchRef.current?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (searchable) {
        searchRef.current?.focus();
      }
    } else if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(visibleOptions.length - 1);
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement | HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        if (next >= visibleOptions.length) return prev;
        // Skip disabled options.
        if (visibleOptions[next]?.disabled) {
          const after = next + 1;
          return after < visibleOptions.length ? after : prev;
        }
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        if (next < 0) return prev;
        if (visibleOptions[next]?.disabled) {
          const before = next - 1;
          return before >= 0 ? before : prev;
        }
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const highlighted = visibleOptions[highlightedIndex];
      if (highlighted && !highlighted.disabled) {
        selectOption(highlighted.value);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(visibleOptions.length - 1);
    }
  };

  const handleOptionClick = (e: MouseEvent<HTMLDivElement>, optionValue: string, optionDisabled?: boolean): void => {
    e.stopPropagation();
    if (optionDisabled) return;
    selectOption(optionValue);
  };

  const handleMouseEnter = (index: number): void => {
    if (!visibleOptions[index]?.disabled) {
      setHighlightedIndex(index);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setQuery(e.target.value);
    setHighlightedIndex(0);
  };

  const rootClass = [styles.root, className ?? ''].filter(Boolean).join(' ');

  const triggerClass = [
    styles.trigger,
    styles[`trigger${(variant ?? 'filled').charAt(0).toUpperCase()}${(variant ?? 'filled').slice(1)}` as keyof typeof styles],
    styles[`trigger${(size ?? 'md').charAt(0).toUpperCase()}${(size ?? 'md').slice(1)}` as keyof typeof styles],
    isOpen ? styles.triggerOpen : '',
    validationState
      ? styles[`trigger${validationState.charAt(0).toUpperCase()}${validationState.slice(1)}` as keyof typeof styles]
      : '',
  ].filter(Boolean).join(' ');

  const triggerLabel = selectedOption ? selectedOption.label : (placeholder ?? '');

  const menuAlignClass = styles[`menuAlign${placement.align.charAt(0).toUpperCase()}${placement.align.slice(1)}` as keyof typeof styles] ?? '';

  const menuClass = [styles.menu, menuAlignClass].filter(Boolean).join(' ');

  // Render the menu in a portal so it escapes clipping ancestors (overflow:auto
  // dialogs, bottom sheets, scroll containers). The position is fixed and
  // computed from the trigger's viewport rect by useMenuPlacement.
  const menu = isOpen ? (
    <div
      ref={menuRef}
      className={menuClass}
      style={menuStyle}
    >
      {searchable && (
        <div className={styles.searchWrap}>
          <Icon name="search" className={styles.searchIcon} />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            aria-label="Search options"
            value={query}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      )}
      <div
        ref={listboxRef}
        tabIndex={-1}
        className={[styles.options, menuAlignClass].filter(Boolean).join(' ')}
        role="listbox"
        aria-activedescendant={highlightedIndex >= 0 ? `select-option-${visibleOptions[highlightedIndex]?.value}` : undefined}
        onKeyDown={!searchable ? handleListboxKeyDown : undefined}
      >
        {visibleOptions.length > 0 ? (
          visibleOptions.map((opt, index) => (
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
          ))
        ) : (
          <div className={styles.emptyState} role="presentation">
            No matching options
          </div>
        )}
      </div>
    </div>
  ) : null;

  // Portal target: stay inside the same document / shadow root so the menu
  // keeps its CSS and z-index context. If the trigger is inside a ShadowRoot,
  // find the topmost rendered element (the React root container) to keep event
  // delegation working; otherwise fall back to the document body.
  const getPortalContainer = (): Element | DocumentFragment => {
    const node = rootRef.current;
    if (!node) return document.body;
    const root = node.getRootNode();
    if (root instanceof ShadowRoot) {
      let el = node as Node;
      while (el.parentNode && el.parentNode !== root) {
        el = el.parentNode;
      }
      return el instanceof Element ? el : root;
    }
    return (root as Document).body ?? document.body;
  };
  const portalContainer = getPortalContainer();

  return (
    <div className={rootClass} ref={rootRef} data-cell-id={dataTestId}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <Button variant="secondary"
        ref={triggerRef}
        id={id}
        className={triggerClass}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={validationState === 'error' || undefined}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        trailingIcon={
          <Icon
            name="chevronDown"
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          />
        }
      >
        <span className={styles.value}>{triggerLabel}</span>
      </Button>

      {menu && createPortal(menu, portalContainer)}
    </div>
  );
}
