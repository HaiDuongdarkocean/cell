import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/shared/ui/Spinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { CardCreatorDialogContent } from '@/features/cardCreator/ui/CardCreatorDialogContent';
import { useCardCreatorState, type OpenContext } from '@/features/cardCreator/ui/useCardCreatorState';
import type { CardCreatorSettings } from '@/entities/settings';
import type { Settings } from '@/entities/media';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';
import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/ui/popupDictionaryController';
import { formatDefinitions } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import styles from './CardCreatorPanel.module.css';

export interface CardCreatorPanelProps {
  /** Source language for the term and sentence. */
  readonly sourceLang: string;
  /** User's native language for translation. */
  readonly targetLang: string;
  /** Prefill data produced by the left dictionary panel. */
  readonly prefill?: PopupCardCreatorPrefill | null;
}

function buildOpenContext(
  sourceLang: string,
  targetLang: string,
  prefill: PopupCardCreatorPrefill | null | undefined,
): OpenContext {
  return {
    sourceLang,
    targetLang,
    prefill: prefill
      ? {
          targetWord: prefill.term,
          definitions: formatDefinitions(prefill.definitions),
          sentence: prefill.contextSentence,
          sentenceTranslation: prefill.translation,
          wordAudioUrls: prefill.wordAudioUrls,
          sentenceAudioUrls: prefill.sentenceAudioUrls,
          imageUrls: prefill.imageUrls,
        }
      : undefined,
  };
}

function hasCardCreatorSettingsChanged(change: chrome.storage.StorageChange): boolean {
  const oldSettings = change.oldValue as Settings | undefined;
  const newSettings = change.newValue as Settings | undefined;
  const oldSlice = oldSettings?.cardCreator;
  const newSlice = newSettings?.cardCreator;
  if (!oldSlice || !newSlice) return true;
  return (
    oldSlice.ankiConnectUrl !== newSlice.ankiConnectUrl ||
    oldSlice.defaultDeck !== newSlice.defaultDeck ||
    oldSlice.defaultNoteType !== newSlice.defaultNoteType ||
    oldSlice.defaultTags !== newSlice.defaultTags ||
    oldSlice.mediaUpdateMode !== newSlice.mediaUpdateMode ||
    JSON.stringify(oldSlice.autoCompleteToggles) !== JSON.stringify(newSlice.autoCompleteToggles)
  );
}

interface CardCreatorPanelCoreProps {
  /** Card Creator settings slice. */
  readonly settings: CardCreatorSettings;
  /** Source language. */
  readonly sourceLang: string;
  /** Target language. */
  readonly targetLang: string;
  readonly prefill?: PopupCardCreatorPrefill | null;
}

function CardCreatorPanelCore({
  settings,
  sourceLang,
  targetLang,
  prefill,
}: CardCreatorPanelCoreProps): React.JSX.Element {
  const openContext = useMemo(
    () => buildOpenContext(sourceLang, targetLang, prefill),
    [sourceLang, targetLang, prefill],
  );

  const state = useCardCreatorState(settings, openContext);

  // The Cancel button is part of the shared CardCreatorDialogContent. In a
  // right-side panel there is no dialog to close; pressing it intentionally
  // does nothing rather than resetting the form.
  return (
    <div className={styles.cardCreatorPanel} data-testid="card-creator-panel">
      <div className={styles.scrollArea}>
        <CardCreatorDialogContent state={state} variant="desktop" onCancel={() => {}} />
      </div>
    </div>
  );
}

/**
 * CardCreatorPanel — right pane of the Dictionary tab.
 *
 * Loads Card Creator settings from chrome.storage.local, keeps them in sync,
 * and renders the shared `CardCreatorDialogContent` directly (without the
 * standalone dialog shell) so it lives inside the universal panel.
 */
export function CardCreatorPanel({
  sourceLang,
  targetLang,
  prefill,
}: CardCreatorPanelProps): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      const settingsChange = changes[STORAGE_KEYS.SETTINGS];
      if (settingsChange && hasCardCreatorSettingsChanged(settingsChange)) {
        void loadSettings().then((s) => { setSettings(s); });
      }
    };
    onStorageChanged(handleStorageChange);
    return () => { removeOnStorageChangedListener(handleStorageChange); };
  }, []);

  if (!settings) {
    return (
      <div className={styles.cardCreatorPanel} data-testid="card-creator-panel">
        <EmptyState
          icon={<Spinner size="md" />}
          title="Loading Card Creator"
          description="Retrieving your card creator settings..."
        />
      </div>
    );
  }

  return (
    <CardCreatorPanelCore
      settings={settings.cardCreator ?? DEFAULT_SETTINGS.cardCreator}
      sourceLang={sourceLang}
      targetLang={targetLang}
      prefill={prefill}
    />
  );
}
