import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/shared/ui';
import { Toggle } from '@/shared/ui/Toggle';
import { Icon } from '@/shared/icons/Icon';
import { useTokenize } from './useTokenize';
import type { TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import styles from './TokenizeFab.module.css';

type TokenizeKey = 'enabled' | 'showStatus' | 'showFrequency';

interface ToggleItem {
  readonly key: TokenizeKey;
  readonly label: string;
  readonly ariaLabel: string;
}

const TOGGLE_ITEMS: readonly ToggleItem[] = [
  { key: 'enabled', label: 'Tokenize', ariaLabel: 'Toggle tokenize page' },
  { key: 'showStatus', label: 'Status', ariaLabel: 'Toggle status badges' },
  { key: 'showFrequency', label: 'Frequency', ariaLabel: 'Toggle frequency bands' },
];

export interface TokenizeFabProps {
  /** Optional external tokenize store to sync with. */
  readonly store?: TokenizeStateStore;
  /** Optional callback to open the dictionary panel. */
  readonly onOpenDictionary?: () => void;
  /** Optional additional class name. */
  readonly className?: string;
}

/**
 * Floating tokenize action button (FAB) with a small settings panel.
 *
 * - Sits on the right viewport edge, offset below the orbital badge to avoid overlap.
 * - Clicking the FAB opens a panel with toggles for tokenize, status, and frequency.
 * - Clicking outside the panel closes it.
 */
export function TokenizeFab({ store, onOpenDictionary, className }: TokenizeFabProps): React.JSX.Element {
  const { state, onToggle } = useTokenize({ store });
  const [isOpen, setIsOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent): void {
      if (!hostRef.current) return;
      const path = e.composedPath();
      if (path.some((el) => el === hostRef.current)) return;
      setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isOpen]);

  return (
    <div
      ref={hostRef}
      className={`${styles.host} ${className ?? ''}`}
      data-testid="tokenize-fab"
    >
      <Button
        variant="primary"
        size="sm"
        className={styles.fab}
        aria-label="Tokenize"
        aria-expanded={isOpen}
        data-testid="tokenize-fab-button"
        onClick={handleToggle}
        leadingIcon={<Icon name="settings" size={18} />}
      />

      {isOpen && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Tokenize settings"
          data-testid="tokenize-fab-panel"
        >
          <div className={styles.panelBody}>
            {TOGGLE_ITEMS.map((item) => {
              const checked = state[item.key];
              const disabled = item.key !== 'enabled' && !state.enabled;
              return (
                <label key={item.key} className={styles.toggleRow}>
                  <span className={styles.toggleLabel}>{item.label}</span>
                  <Toggle
                    checked={checked}
                    onChange={() => onToggle(item.key)}
                    ariaLabel={item.ariaLabel}
                    disabled={disabled}
                    dataTestId={`tokenize-fab-toggle-${item.key}`}
                    title={item.ariaLabel}
                  />
                </label>
              );
            })}
          </div>

          {onOpenDictionary && (
            <div className={styles.panelFooter}>
              <Button
                variant="outline"
                size="sm"
                className={styles.dictButton}
                data-testid="tokenize-fab-dictionary"
                onClick={onOpenDictionary}
                leadingIcon={<Icon name="bookOpen" size={16} />}
              >
                Dictionary
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
