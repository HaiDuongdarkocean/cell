import { useEffect, useRef, useState, type ReactElement, type KeyboardEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import { Heading } from '@/shared/ui/Heading';
import { useFocusTrap } from '@/shared/ui/useFocusTrap';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { t } from '@/shared/i18n';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { CardCreatorSettingsPanel } from '@/features/settings/ui/CardCreatorSettingsPanel';
import type { Settings } from '@/entities/media';
import type { CardCreatorSettings, SrsDestination } from '@/entities/settings';
import styles from './CardCreatorSettingsSidePanel.module.css';

const EXIT_DURATION_MS = 250;

interface CardCreatorSettingsSidePanelProps {
  /** Whether the panel is open. */
  readonly open: boolean;
  /** Called when the panel should close. */
  readonly onClose: () => void;
  /** Current app settings. */
  readonly settings: Settings;
  /** Called when settings change. */
  readonly onChange: (settings: Settings) => void;
}

/**
 * CardCreatorSettingsSidePanel — scoped slide-in settings panel for the
 * integrated Card Creator (Dictionary tab right pane).
 *
 * Slides in from the left, fills the Card Creator container, and slides back
 * left on close. Header has a back button (left) and a centered title.
 */
export function CardCreatorSettingsSidePanel({
  open,
  onClose,
  settings,
  onChange,
}: CardCreatorSettingsSidePanelProps): ReactElement | null {
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

  const handleUpdateCardCreator = (partial: Partial<CardCreatorSettings>): void => {
    onChange({
      ...settings,
      cardCreator: { ...settings.cardCreator, ...partial },
    });
  };

  const handleUpdateSrsDestination = (srsDestination: SrsDestination): void => {
    onChange({
      ...settings,
      dictionaryPopup: {
        ...(settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS),
        srsDestination,
      },
    });
  };

  const animationClass = open && !exiting ? styles.enter : styles.exit;

  return (
    <div
      ref={panelRef}
      className={[styles.panel, animationClass].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      onKeyDown={handleKeyDown}
      data-cell-id="card-creator-settings-layer"
      data-section="cardCreator"
    >
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label={t('ui.back')}
          title={t('ui.back')}
          data-cell-id="cc-settings-back"
        >
          <Icon name="chevronLeft" />
        </Button>
        <Heading level={2} size={3} className={styles.title}>
          {t('settings.title')}
        </Heading>
        <div className={styles.spacer} aria-hidden="true" />
      </div>
      <div className={styles.content}>
        <CardCreatorSettingsPanel
          settings={settings.cardCreator}
          srsDestination={settings.dictionaryPopup?.srsDestination ?? 'anki'}
          onChange={handleUpdateCardCreator}
          onDestinationChange={handleUpdateSrsDestination}
        />
      </div>
    </div>
  );
}
