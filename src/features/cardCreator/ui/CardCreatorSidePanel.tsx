import { useEffect, useRef, useState, type ReactElement, type ReactNode, type KeyboardEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import { Heading } from '@/shared/ui/Heading';
import { useFocusTrap } from '@/shared/ui/useFocusTrap';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { t } from '@/shared/i18n';
import styles from './CardCreatorSidePanel.module.css';

const EXIT_DURATION_MS = 250;

interface CardCreatorSidePanelProps {
  /** Whether the panel is open. */
  readonly open: boolean;
  /** Called when the panel should close. */
  readonly onClose: () => void;
  /** Header title. */
  readonly title: string;
  /** Slide direction — which edge the panel enters from. */
  readonly side?: 'left' | 'right';
  /** Accessible name for the dialog layer. */
  readonly ariaLabel: string;
  readonly dataCellId: string;
  /** data-cell-id for the header back button. */
  readonly backDataCellId: string;
  readonly dataSection?: string;
  /** Remove content padding — the child owns its own padding + scroll. */
  readonly flushContent?: boolean;
  readonly children: ReactNode;
}

/**
 * CardCreatorSidePanel — scoped slide-in overlay layer for the integrated
 * Card Creator (Dictionary tab right pane). Covers the whole container,
 * slides in from `side`, slides back on close. Header has a back button
 * (left) and a centered title.
 *
 * Shared shell for CardCreatorSettingsSidePanel and QueueSidePanel.
 */
export function CardCreatorSidePanel({
  open,
  onClose,
  title,
  side = 'left',
  ariaLabel,
  dataCellId,
  backDataCellId,
  dataSection,
  flushContent,
  children,
}: CardCreatorSidePanelProps): ReactElement | null {
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track visibility lifecycle: mount immediately on open, delay unmount until
  // the exit animation finishes.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
    } else if (mounted) {
      setExiting(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, EXIT_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  const visible = mounted;
  useFocusTrap(panelRef, open && visible);

  // Escape closes the topmost layer without bubbling to ancestor surfaces.
  useEffect(() => {
    if (!open || !visible) return;
    return pushEscapeLayer(() => { onClose(); });
  }, [open, visible, onClose]);

  if (!visible) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
    }
  };

  const animationClass =
    open && !exiting
      ? styles[side === 'left' ? 'enterFromLeft' : 'enterFromRight']
      : styles[side === 'left' ? 'exitToLeft' : 'exitToRight'];

  return (
    <div
      ref={panelRef}
      className={[styles.panel, styles[side === 'left' ? 'panel--left' : 'panel--right'], animationClass].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      data-cell-id={dataCellId}
      data-section={dataSection}
    >
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label={t('ui.back')}
          title={t('ui.back')}
          data-cell-id={backDataCellId}
        >
          <Icon name="chevronLeft" />
        </Button>
        <Heading level={2} size={3} className={styles.title}>
          {title}
        </Heading>
        <div className={styles.spacer} aria-hidden="true" />
      </div>
      <div className={[styles.content, flushContent && styles['content--flush']].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>
  );
}
