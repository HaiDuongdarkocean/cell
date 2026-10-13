import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/shared/ui/Spinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { MobileSheet, type MobileSheetSnap } from '@/shared/ui/MobileSheet';
import { useIsMobile } from '@/shared/ui/useIsMobile';
import { BREAKPOINTS } from '@/shared/lib/tokens';
import { t } from '@/shared/i18n';
import { CardCreatorDialogContent } from '@/features/cardCreator';
import { useCardCreatorState, type OpenContext } from '@/features/cardCreator';
import type { Settings } from '@/entities/media';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';
import type { DictionaryPanelPrefill } from '@/features/universalPanel/types';
import { formatDefinitions } from '@/features/dictionary';
import { cardLookupResult, formatDefEntry, formatDefFromLookup } from '@/features/srs';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import type { AudioItem, ImageItem } from '@/entities/dictionary';
import styles from './CardCreatorPanel.module.css';

export interface CardCreatorPanelProps {
  /** Source language for the term and sentence. */
  readonly sourceLang: string;
  /** User's native language for translation. */
  readonly targetLang: string;
  /** Card-creator context pushed from an external popup or subtitle cluster. */
  readonly context?: DictionaryPanelPrefill | null;
  /** Called after a successful Add or Update, e.g. to close the panel. */
  readonly onAfterSubmit?: () => void;
  /** Called when the user selects a queue item so the parent can drive
   *  a Dictionary lookup for that term. */
  readonly onQueueTermSelect?: (term: string) => void;
}

function selectedAudioItems(context: DictionaryPanelPrefill): readonly AudioItem[] {
  const wordItems = (context.audioItems ?? []).filter((item) => item.kind === 'word');
  const selectedIds = new Set(context.selectedAudioIds ?? []);
  if (selectedIds.size > 0) {
    return wordItems.filter((item) => selectedIds.has(item.id));
  }
  const defaults = wordItems.filter((item) => item.defaultSelected);
  return defaults.length > 0 ? defaults : wordItems.slice(0, 1);
}

function prefillDefinitions(
  context: DictionaryPanelPrefill,
  frequencyFormat: 'stars' | 'rank',
  frequencyThresholds?: FrequencyBandThresholds,
): string {
  const senses = formatDefinitions(context.definitions);
  const lookupResult = cardLookupResult(context);
  return lookupResult
    ? formatDefFromLookup(lookupResult, senses, context.term, frequencyFormat, frequencyThresholds)
    : formatDefEntry({
        term: context.term ?? '',
        reading: context.reading,
        readingKind: context.readingKind,
        frequencyStars: context.frequencyStars?.count,
        frequencies: context.frequencies,
        frequencyFormat,
        frequencyThresholds,
        senses,
      });
}

function selectedImageItems(context: DictionaryPanelPrefill): readonly ImageItem[] {
  const items = context.imageItems ?? [];
  const selectedIds = new Set(context.selectedImageIds ?? []);
  if (selectedIds.size > 0) {
    return items.filter((item) => selectedIds.has(item.id));
  }
  const defaults = items.filter((item) => item.defaultSelected);
  return defaults.length > 0 ? defaults : items.slice(0, 1);
}

function buildOpenContext(
  sourceLang: string,
  targetLang: string,
  context: DictionaryPanelPrefill | null | undefined,
  frequencyFormat: 'stars' | 'rank' = 'stars',
  frequencyThresholds?: FrequencyBandThresholds,
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
          definitions: prefillDefinitions(context, frequencyFormat, frequencyThresholds),
          sentence: context.contextSentence,
          sentenceTranslation: context.translation,
          wordAudioUrls: context.wordAudioUrls,
          sentenceAudioUrls: context.sentenceAudioUrls,
          imageUrls: context.imageUrls,
          wordAudioItems: selectedAudioItems(context),
          imageItems: selectedImageItems(context),
        }
      : undefined,
    queue: context?.queue,
    mediaPending: context?.mediaPending,
  };
}

function hasCardCreatorSettingsChanged(change: chrome.storage.StorageChange): boolean {
  const oldSettings = change.oldValue as Settings | undefined;
  const newSettings = change.newValue as Settings | undefined;
  const oldSlice = oldSettings?.cardCreator;
  const newSlice = newSettings?.cardCreator;
  if (!oldSlice || !newSlice) return true;
  if (
    (oldSettings?.dictionaryPopup?.srsDestination ?? 'anki') !==
    (newSettings?.dictionaryPopup?.srsDestination ?? 'anki')
  ) {
    return true;
  }
  if (
    oldSettings?.srs?.activeDeckId !== newSettings?.srs?.activeDeckId ||
    oldSettings?.srs?.activeNotetypeId !== newSettings?.srs?.activeNotetypeId
  ) {
    return true;
  }
  return (
    oldSlice.ankiConnectUrl !== newSlice.ankiConnectUrl ||
    oldSlice.defaultDeck !== newSlice.defaultDeck ||
    oldSlice.defaultNoteType !== newSlice.defaultNoteType ||
    oldSlice.defaultTags !== newSlice.defaultTags ||
    oldSlice.mediaUpdateMode !== newSlice.mediaUpdateMode ||
    JSON.stringify(oldSlice.autoCompleteToggles) !== JSON.stringify(newSlice.autoCompleteToggles) ||
    JSON.stringify(oldSlice.fieldMappings) !== JSON.stringify(newSlice.fieldMappings)
  );
}

interface CardCreatorPanelCoreProps {
  /** Full app settings. */
  readonly settings: Settings;
  /** Source language. */
  readonly sourceLang: string;
  /** Target language. */
  readonly targetLang: string;
  /** Card-creator context. */
  readonly context?: DictionaryPanelPrefill | null;
  /** Called after a successful Add or Update. */
  readonly onAfterSubmit?: () => void;
  /** Called when the user selects a queue item. */
  readonly onQueueTermSelect?: (term: string) => void;
  /** Whether the panel is in mobile (sheet) layout. */
  readonly isMobile?: boolean;
  /** Called when settings change. */
  readonly onSettingsChange?: (settings: Settings) => void;
}

function CardCreatorPanelCore({
  settings,
  sourceLang,
  targetLang,
  context,
  onAfterSubmit,
  onQueueTermSelect,
  isMobile = false,
  onSettingsChange,
}: CardCreatorPanelCoreProps): React.JSX.Element {
  const cardCreatorSettings = settings.cardCreator ?? DEFAULT_SETTINGS.cardCreator;
  const frequencyDisplay = settings.dictionaryPopup?.frequencyDisplay ?? 'stars';
  const frequencyBands = settings.frequencyBands;
  const openContext = useMemo(
    () => buildOpenContext(sourceLang, targetLang, context, frequencyDisplay, frequencyBands),
    [sourceLang, targetLang, context, frequencyDisplay, frequencyBands],
  );

  const initialAction = context?.initialAction;
  const state = useCardCreatorState(cardCreatorSettings, openContext, initialAction, {
    onSubmitSuccess: onAfterSubmit,
    onQueueTermSelect,
    srsDestination: settings.dictionaryPopup?.srsDestination ?? 'anki',
    srsDeckId: settings.srs?.activeDeckId,
    srsNotetypeId: settings.srs?.activeNotetypeId,
  });
  const { loadStatus, submitting, submit } = state;

  // Quick Add from the dictionary header: auto-submit the prefilled card as soon
  // as the form data is loaded. This mirrors the popup dictionary Quick Add
  // behavior (bypass dialog, add note directly).
  // Guard: a queue-only context (no definitions, no lookup result) must not
  // auto-submit — the user first has to pick a queue term and look it up.
  const quickAddContextRef = useRef<DictionaryPanelPrefill | null>(null);
  useEffect(() => {
    if (initialAction !== 'quick-add' || !context || context === quickAddContextRef.current) return;
    if (loadStatus === 'idle' || submitting) return;
    if (!context.definitions?.length && !context.lookupResult) return;
    quickAddContextRef.current = context;
    void submit('add');
  }, [initialAction, context, loadStatus, submitting, submit]);

  const [sheetSnap, setSheetSnap] = useState<MobileSheetSnap>(context ? 'half' : 'collapsed');
  const prevContextRef = useRef(context);
  useEffect(() => {
    if (context === prevContextRef.current) return;
    prevContextRef.current = context;
    if (context) setSheetSnap('half');
  }, [context]);

  const content = (
    <CardCreatorDialogContent
      state={state}
      variant={isMobile ? 'mobile' : 'desktop'}
      className={styles.panelBody}
      layout="panel"
      appSettings={settings}
      onSettingsChange={onSettingsChange}
    />
  );

  if (isMobile) {
    return (
      <div className={`${styles.cardCreatorPanel} ${styles.cardCreatorPanelMobile}`} data-tihoka-id="card-creator-panel">
        <MobileSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          aria-label={t('cardCreator.title')}
          contentClassName={styles.sheetContent}
          className={styles.sheet}
          data-tihoka-id="card-creator-mobile-sheet"
        >
          {content}
        </MobileSheet>
      </div>
    );
  }

  return (
    <div className={styles.cardCreatorPanel} data-tihoka-id="card-creator-panel">
      <div className={styles.scrollArea}>
        {content}
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
  onAfterSubmit,
  onQueueTermSelect,
}: CardCreatorPanelProps): React.JSX.Element {
  const isMobile = useIsMobile(BREAKPOINTS.expanded);
  const [appSettings, setAppSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (!cancelled) setAppSettings(s);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      const settingsChange = changes[STORAGE_KEYS.SETTINGS];
      if (settingsChange && hasCardCreatorSettingsChanged(settingsChange)) {
        void loadSettings().then((s) => { setAppSettings(s); });
      }
    };
    onStorageChanged(handleStorageChange);
    return () => { removeOnStorageChangedListener(handleStorageChange); };
  }, []);

  const handleSettingsChange = (updated: Settings): void => {
    setAppSettings(updated);
    void saveSettings(updated);
  };

  if (!appSettings) {
    return (
      <div className={styles.cardCreatorPanel} data-tihoka-id="card-creator-panel">
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
      settings={appSettings}
      sourceLang={sourceLang}
      targetLang={targetLang}
      context={context}
      onAfterSubmit={onAfterSubmit}
      onQueueTermSelect={onQueueTermSelect}
      isMobile={isMobile}
      onSettingsChange={handleSettingsChange}
    />
  );
}
