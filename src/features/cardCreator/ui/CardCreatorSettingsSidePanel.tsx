import type { ReactElement } from 'react';
import { CardCreatorSidePanel } from './CardCreatorSidePanel';
import { t } from '@/shared/i18n';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { CardCreatorSettingsPanel } from './CardCreatorSettingsPanel';
import type { Settings } from '@/entities/media';
import type { CardCreatorSettings, SrsDestination } from '@/entities/settings';

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
 * integrated Card Creator (Dictionary tab right pane). Slides in from the
 * left via the shared CardCreatorSidePanel shell.
 */
export function CardCreatorSettingsSidePanel({
  open,
  onClose,
  settings,
  onChange,
}: CardCreatorSettingsSidePanelProps): ReactElement | null {
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

  const handleSrsSelectionChange = (selection: { deckId?: string; notetypeId?: string }): void => {
    onChange({
      ...settings,
      srs: {
        ...settings.srs,
        ...(selection.deckId !== undefined ? { activeDeckId: selection.deckId } : {}),
        ...(selection.notetypeId !== undefined ? { activeNotetypeId: selection.notetypeId } : {}),
      },
    });
  };

  return (
    <CardCreatorSidePanel
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      side="left"
      ariaLabel={t('settings.title')}
      dataCellId="card-creator-settings-layer"
      backDataCellId="cc-settings-back"
      dataSection="cardCreator"
    >
      <CardCreatorSettingsPanel
        settings={settings.cardCreator}
        srsDestination={settings.dictionaryPopup?.srsDestination ?? 'anki'}
        onChange={handleUpdateCardCreator}
        onDestinationChange={handleUpdateSrsDestination}
        srsDeckId={settings.srs?.activeDeckId}
        srsNotetypeId={settings.srs?.activeNotetypeId}
        onSrsSelectionChange={handleSrsSelectionChange}
      />
    </CardCreatorSidePanel>
  );
}
