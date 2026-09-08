import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/shared/ui/Spinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { t } from '@/shared/i18n';
import { CardCreatorDialogContent } from '@/features/cardCreator/ui/CardCreatorDialogContent';
import { useCardCreatorState, type OpenContext } from '@/features/cardCreator/ui/useCardCreatorState';
import type { CardCreatorSettings } from '@/entities/settings';
import type { Settings } from '@/entities/media';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';
import type { DictionaryPanelPrefill } from '@/features/universalPanel/types';
import { formatDefinitions } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import styles from './CardCreatorPanel.module.css';

export interface CardCreatorPanelProps {
  /** Source language for the term and sentence. */
  readonly sourceLang: string;
  /** User's native language for translation. */
  readonly targetLang: string;
  /** Card-creator context pushed from an external popup or subtitle cluster. */
  readonly context?: DictionaryPanelPrefill | null;
}

function buildOpenContext(
  sourceLang: string,
  targetLang: string,
  context: DictionaryPanelPrefill | null | undefined,
): OpenContext {
  return {
    video: context?.video,
    cue: context?.cue,
    sourceLang: context?.langCode ?? sourceLang,
    targetLang,
    initialMedia: context?.initialMedia,
    prefill: context
      ? {
          targetWord: context.term,
          definitions: formatDefinitions(context.definitions),
          sentence: context.contextSentence,
          sentenceTranslation: context.translation,
          wordAudioUrls: context.wordAudioUrls,
          sentenceAudioUrls: context.sentenceAudioUrls,
          imageUrls: context.imageUrls,
        }
      : undefined,
    queue: context?.queue,
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
  /** Card-creator context. */
  readonly context?: DictionaryPanelPrefill | null;
}

function CardCreatorPanelCore({
  settings,
  sourceLang,
  targetLang,
  context,
}: CardCreatorPanelCoreProps): React.JSX.Element {
  const openContext = useMemo(
    () => buildOpenContext(sourceLang, targetLang, context),
    [sourceLang, targetLang, context],
  );

  const initialAction = context?.initialAction;
  const state = useCardCreatorState(settings, openContext, initialAction);
  const { loadStatus, submitting, submit } = state;

  // Quick Add from the dictionary header: auto-submit the prefilled card as soon
  // as the form data is loaded. This mirrors the popup dictionary Quick Add
  // behavior (bypass dialog, add note directly).
  const quickAddContextRef = useRef<DictionaryPanelPrefill | null>(null);
  useEffect(() => {
    if (initialAction !== 'quick-add' || !context || context === quickAddContextRef.current) return;
    if (loadStatus === 'idle' || submitting) return;
    quickAddContextRef.current = context;
    void submit('add');
  }, [initialAction, context, loadStatus, submitting, submit]);

  // The Cancel button is part of the shared CardCreatorDialogContent. In a
  // right-side panel there is no dialog to close; pressing it intentionally
  // does nothing rather than resetting the form.
  return (
    <div className={styles.cardCreatorPanel} data-cell-id="card-creator-panel">
      <div className={styles.scrollArea}>
        <CardCreatorDialogContent
          state={state}
          variant="desktop"
          onCancel={() => {}}
          className={styles.panelBody}
          layout="panel"
        />
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
  context,
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
      <div className={styles.cardCreatorPanel} data-cell-id="card-creator-panel">
        <EmptyState
          icon={<Spinner size="md" />}
          title={t('cardCreator.loading.title')}
          description={t('cardCreator.loading.description')}
        />
      </div>
    );
  }

  return (
    <CardCreatorPanelCore
      settings={settings.cardCreator ?? DEFAULT_SETTINGS.cardCreator}
      sourceLang={sourceLang}
      targetLang={targetLang}
      context={context}
    />
  );
}
