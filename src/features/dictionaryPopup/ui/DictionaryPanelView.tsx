import { useCallback, useEffect, useRef, useState } from 'react';
import { useDictionaryPanel } from './useDictionaryPanel';
import { SearchField } from '@/shared/ui/SearchField';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Icon } from '@/shared/icons/Icon';
import { rankToBand } from '@/shared/lib/frequencyBand';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { nextStatus } from '../services/wordStatusStore';
import {
  addSearchHistoryTerm,
  loadSearchHistory,
  persistSearchHistory,
  removeSearchHistoryTerm,
} from '@/features/universalPanel/searchHistory';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import type { LookupResult, DefinitionEntry, PopupTab, ExternalDictLink, AudioItem, ImageItem } from '../types';
import styles from './DictionaryPanelView.module.css';
import componentsCss from '@/shared/styles/components.css?raw';

const SEARCH_INPUT_ID = 'dictionary-panel-search-input';

type IconName = React.ComponentProps<typeof Icon>['name'];

const TABS: { key: PopupTab; icon: IconName; label: string }[] = [
  { key: 'audio', icon: 'audioWave', label: 'Audio' },
  { key: 'image', icon: 'image', label: 'Image' },
  { key: 'translate', icon: 'languages', label: 'Translate' },
  { key: 'links', icon: 'link', label: 'Links' },
];

interface DictionaryPanelViewProps {
  readonly langCode: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly initialTerm?: string;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  /** True when this view is inside an open panel — used for auto-focus after animation. */
  readonly isOpen?: boolean;
}

function formatReading(reading: string, readingKind: LookupResult['readingKind']): string {
  if (!reading) return '';
  if (readingKind === 'ipa' && !(reading.startsWith('/') && reading.endsWith('/'))) {
    return `/${reading}/`;
  }
  return reading;
}

function fillExternalDictLinks(
  templates: readonly { readonly id: string; readonly name: string; readonly urlTemplate: string; readonly langCodes: readonly string[] }[],
  term: string,
  langCode: string,
): ExternalDictLink[] {
  const encodedTerm = encodeURIComponent(term);
  return templates
    .filter((t) => t.langCodes.length === 0 || t.langCodes.includes(langCode))
    .map((t) => ({
      id: t.id,
      name: t.name,
      url: t.urlTemplate.replaceAll('{term}', encodedTerm).replaceAll('{lang}', langCode),
    }));
}

export function DictionaryPanelView({
  langCode,
  sourceLang,
  targetLang,
  initialTerm,
  onSendToCard,
  onQuickAdd,
  isOpen = true,
}: DictionaryPanelViewProps): React.JSX.Element {
  const panel = useDictionaryPanel({
    langCode,
    sourceLang,
    targetLang,
    initialTerm,
    onSendToCard,
    onQuickAdd,
  });

  const [audioLoading, setAudioLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<readonly string[]>([]);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSearchFocusRef = useRef(false);
  const userTypedRef = useRef(false);

  const { searchTerm, setSearchTerm, search } = panel;

  useEffect(() => {
    let cancelled = false;
    void loadSearchHistory().then((history) => {
      if (!cancelled && history.length > 0) setSearchHistory(history);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = panel.currentResult?.term;
    if (!term || panel.isLoading) return;
    setSearchHistory((previous) => {
      const next = addSearchHistoryTerm(previous, term);
      if (next.length !== previous.length || next.some((entry, index) => entry !== previous[index])) {
        void persistSearchHistory(next);
      }
      return next;
    });
  }, [panel.currentResult?.term, panel.isLoading]);

  const handleRemoveHistory = useCallback((term: string): void => {
    setSearchHistory((previous) => {
      const next = removeSearchHistoryTerm(previous, term);
      void persistSearchHistory(next);
      return next;
    });
  }, []);

  const handleClearHistory = useCallback((): void => {
    setSearchHistory([]);
    void persistSearchHistory([]);
  }, []);

  const handleSearchChange = useCallback((value: string): void => {
    userTypedRef.current = true;
    pendingSearchFocusRef.current = true;
    setSearchTerm(value);
  }, [setSearchTerm]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      userTypedRef.current = false;
      pendingSearchFocusRef.current = true;
      const trimmed = searchTerm.trim();
      if (trimmed) {
        search(trimmed);
      }
    }
  }, [search, searchTerm]);

  useEffect(() => {
    if (!userTypedRef.current) return;
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    pendingSearchFocusRef.current = true;
    searchDebounceRef.current = setTimeout(() => {
      userTypedRef.current = false;
      search(trimmed);
    }, 500);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm, search]);

  useEffect(() => {
    if (panel.isLoading || !panel.currentResult || !pendingSearchFocusRef.current) return;
    pendingSearchFocusRef.current = false;
    const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [panel.isLoading, panel.currentResult]);

  const handlePlayTerm = useCallback((): void => {
    if (!panel.currentResult) return;
    setAudioLoading(true);
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: panel.currentResult.term, langCode: panel.currentResult.langCode },
    }).finally(() => { setAudioLoading(false); });
  }, [panel.currentResult]);

  const handlePlaySentence = useCallback((): void => {
    const sentence = panel.searchTerm.trim() || panel.currentResult?.term;
    if (!sentence || !panel.currentResult) return;
    setAudioLoading(true);
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: sentence, langCode: panel.currentResult.langCode },
    }).finally(() => { setAudioLoading(false); });
  }, [panel.currentResult, panel.searchTerm]);

  const handleTranslate = useCallback((): void => {
    panel.translate();
  }, [panel]);

  // Lazy-load media panels when a tab is opened and data is still empty.
  useEffect(() => {
    if (panel.activeTab === 'audio' && panel.audioItems.length === 0 && !panel.audioLoading) {
      panel.fetchAudio();
    }
    if (panel.activeTab === 'image' && panel.imageItems.length === 0 && !panel.imageLoading) {
      panel.fetchImages();
    }
  }, [panel.activeTab, panel.audioItems.length, panel.audioLoading, panel.fetchAudio, panel.imageItems.length, panel.imageLoading, panel.fetchImages]);

  // Inject shared .btn / .icon-btn classes so popup-style markup can reuse
  // the same global class names without duplication. Idempotent across mounts.
  useEffect(() => {
    const id = 'cell-dictionary-components';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = componentsCss;
      document.head.appendChild(style);
    }
  }, []);

  // Focus the search input after the panel enter animation completes.
  // If the input already has a term, move the caret to the end.
  useEffect(() => {
    if (!isOpen) return;
    focusTimerRef.current = setTimeout(() => {
      const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
      if (!input) return;
      input.focus();
      if (input.value) {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }, 250);
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const frequencyBand = panel.currentResult?.frequency ? rankToBand(panel.currentResult.frequency.rank) : 'none';
  const links = panel.currentResult
    ? fillExternalDictLinks(DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks, panel.currentResult.term, panel.currentResult.langCode)
    : [];

  return (
    <div className={styles.dictionaryPanel} data-testid="dictionary-panel">
      <div className={styles.searchRow}>
        <SearchField
          id={SEARCH_INPUT_ID}
          data-testid="dictionary-search-input"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Type a word"
          disabled={panel.isLoading}
          className={styles.searchField}
        />
      </div>

      {searchHistory.length > 0 && (
        <section className={styles.searchHistory} aria-label="Recent searches" data-testid="dictionary-search-history">
          <ul className={styles.searchHistoryList}>
            {searchHistory.map((term) => (
              <li key={term} className={styles.searchHistoryItem}>
                <button
                  type="button"
                  className={styles.searchHistoryTerm}
                  onClick={() => {
                    setSearchTerm(term);
                    search(term);
                  }}
                >
                  {term}
                </button>
                <button
                  type="button"
                  className={styles.searchHistoryRemove}
                  aria-label={`Remove ${term} from recent searches`}
                  title={`Remove ${term}`}
                  onClick={() => handleRemoveHistory(term)}
                >
                  <Icon name="x" size={10} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`icon-btn icon-btn--xs ${styles.searchHistoryClear}`}
            aria-label="Clear recent searches"
            title="Clear recent searches"
            onClick={handleClearHistory}
            data-testid="dictionary-search-history-clear"
          >
            <Icon name="trash" size={16} />
          </button>
        </section>
      )}

      {panel.isLoading && !panel.currentResult && (
        <div className={styles.loading} data-testid="dictionary-loading">
          <Spinner size="md" />
          <span>Looking up {panel.searchTerm}…</span>
        </div>
      )}

      {panel.error && (
        <div className={styles.error} role="alert" data-testid="dictionary-error">
          <Icon name="alertCircle" size={20} />
          <span>{panel.error}</span>
        </div>
      )}

      {!panel.isLoading && !panel.error && !panel.currentResult && (
        <div className={styles.dictionaryEmpty} role="status" data-testid="dictionary-empty">
          <div className={styles.dictionaryEmptyIcon} aria-hidden="true">
            <Icon name="bookOpen" size={36} />
          </div>
          <div className={styles.dictionaryEmptyTitle}>Ready when you are</div>
          <div className={styles.dictionaryEmptyDescription}>Search for a word to explore its meaning.</div>
        </div>
      )}

      {panel.currentResult && (
        <>
          <header className={styles.cellHeader} data-testid="dictionary-header">
            <div className={styles.cellHeaderRow}>
              <div className={styles.cellHeaderMain}>
                <div className={styles.cellHeaderWordRow}>
                  <h2 className={styles.cellHeaderWord} data-testid="dictionary-term">{panel.currentResult.term}</h2>
                </div>
                <div className={styles.cellHeaderReading}>
                  {panel.currentResult.reading && (
                    <span className={styles.cellHeaderIpa} data-testid="dictionary-reading">
                      {formatReading(panel.currentResult.reading, panel.currentResult.readingKind)}
                    </span>
                  )}
                  <span className={styles.cellHeaderAudioGroup}>
                    <button
                      type="button"
                      className={`icon-btn icon-btn--xs ${styles.cellHeaderAudio}`}
                      aria-label="Play word audio"
                      title="Play word audio"
                      onClick={handlePlayTerm}
                      disabled={audioLoading}
                      data-testid="dictionary-play-term"
                    >
                      <Icon name="audioWave" size={16} />
                    </button>
                    <button
                      type="button"
                      className={`icon-btn icon-btn--xs ${styles.cellHeaderAudio}`}
                      aria-label="Play sentence audio"
                      title="Play sentence audio"
                      onClick={handlePlaySentence}
                      disabled={audioLoading}
                    >
                      <Icon name="messageSquare" size={16} />
                    </button>
                  </span>
                </div>
              </div>
              <div className={styles.cellHeaderActions}>
                <button
                  type="button"
                  className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellHeaderSend}`}
                  aria-label="Send to Card Creator"
                  title="Send to Card Creator"
                  onClick={panel.sendToCard}
                  data-testid="dictionary-send-to-card"
                >
                  <Icon name="pencil" size={18} />
                </button>
                {onQuickAdd && (
                  <button
                    type="button"
                    className={`icon-btn icon-btn--sm icon-btn--filled ${styles.cellHeaderQuickAdd}`}
                    aria-label="Quick Add to Anki"
                    title="Quick Add to Anki"
                    onClick={panel.quickAdd}
                    data-testid="dictionary-quick-add"
                  >
                    <Icon name="zap" size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className={styles.cellHeaderSecond}>
              <button
                type="button"
                className={`${styles.cellHeaderStatus} ${styles[`cellHeaderStatus--${panel.status}`]}`}
                onClick={panel.cycleStatus}
                title={`Click to cycle: ${panel.status} → ${nextStatus(panel.status)}`}
                data-testid="dictionary-status-cycle"
              >
                {panel.status}
              </button>
              {panel.currentResult.frequency && (
                <span className={`${styles.cellHeaderFrequency} ${styles[`cellHeaderFrequency--${frequencyBand}`]}`} data-testid="dictionary-frequency">
                  <span className={styles.cellHeaderFrequencySource}>{panel.currentResult.frequency.source}</span>
                  <span className={styles.cellHeaderFrequencyRank}>{panel.currentResult.frequency.rank.toLocaleString()}</span>
                </span>
              )}
            </div>
          </header>

          <div className={styles.cellToolbar} role="tablist" aria-label="Dictionary materials">
            {TABS.map((tab) => {
              const active = panel.activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-pressed={active}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`btn ${active ? 'btn--primary' : 'btn--ghost'} ${styles.cellToolbarTab}`}
                  onClick={() => panel.setActiveTab(active ? null : tab.key)}
                  data-testid={`dictionary-tab-${tab.key}`}
                >
                  <Icon name={tab.icon} size={20} />
                  <span className={`${styles.cellToolbarLabel} ${styles.cellLabel}`}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {panel.activeTab === 'audio' && (
            <AudioPanel
              items={panel.audioItems}
              loading={panel.audioLoading}
              error={panel.audioError}
              selection={panel.audioSelection}
              onToggle={panel.toggleAudio}
              onTts={handlePlayTerm}
            />
          )}
          {panel.activeTab === 'image' && (
            <ImagePanel
              items={panel.imageItems}
              loading={panel.imageLoading}
              error={panel.imageError}
              selection={panel.imageSelection}
              onToggle={panel.toggleImage}
              onImageError={panel.removeImageItem}
              term={panel.currentResult.term}
            />
          )}
          {panel.activeTab === 'translate' && (
            <TranslatePanel
              term={panel.currentResult.term}
              sentence={panel.searchTerm}
              targetLang={targetLang}
              translation={panel.translation}
              error={panel.translationError}
              loading={panel.isTranslating}
              onTranslate={handleTranslate}
            />
          )}
          {panel.activeTab === 'links' && <LinksPanel links={links} />}

          <section className={styles.cellDef} aria-label="Definitions" data-testid="dictionary-definitions" data-allow-lookup>
            {panel.currentResult.definitions.length === 0 ? (
              <div className={styles.cellDefEmpty}>
                <Icon name="info" size={24} />
                <span>No definitions found. Import a dictionary in Settings → Resources.</span>
              </div>
            ) : (
              panel.currentResult.definitions.map((def) => (
                <DefinitionItem
                  key={def.id}
                  definition={def}
                  selected={panel.definitionSelection.get(def.id) ?? def.defaultSelected}
                  onToggle={panel.toggleDefinition}
                />
              ))
            )}
          </section>

          {panel.candidates.length > 0 && (
            <div className={styles.cellCandidatesChips}>
              <div className={styles.cellCandidatesChipsScroll}>
                {[panel.currentResult, ...panel.candidates].map((c, idx) => (
                  <button
                    key={`${c.term}-${idx}`}
                    type="button"
                    className={`btn ${idx === panel.activeCandidateIndex ? 'btn--primary' : 'btn--outline'} ${styles.cellChip}`}
                    aria-current={idx === panel.activeCandidateIndex ? 'true' : undefined}
                    onClick={() => panel.setActiveCandidate(idx)}
                    data-testid={`dictionary-candidate-${idx}`}
                  >
                    {c.term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DefinitionItem({
  definition,
  selected,
  onToggle,
}: {
  readonly definition: DefinitionEntry;
  readonly selected: boolean;
  readonly onToggle: (id: string, selected: boolean) => void;
}): React.JSX.Element {
  const checked = selected ?? definition.defaultSelected;
  return (
    <div
      className={styles.cellDefItem}
      data-testid="dictionary-definition"
    >
      <label className={`${styles.cellDefCheck} ${checked ? styles['cellDefCheck--checked'] : ''}`}>
        <input
          type="checkbox"
          className={styles.cellDefCheckInput}
          checked={checked}
          onChange={(e) => onToggle(definition.id, e.target.checked)}
          aria-label={`Select definition: ${definition.text}`}
        />
        <span className={styles.cellDefCheckDot} aria-hidden="true" />
        <span className={styles.cellDefCheckBox} aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
      </label>
      <div className={styles.cellDefText}>
        <span>
          {definition.pos ? `${definition.pos} ${definition.text}` : definition.text}
        </span>
        {definition.examples.length > 0 && (
          <div className={styles.cellDefExamples}>
            {definition.examples.map((ex, i) => (
              <div key={i}>• {ex}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AudioSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellAudioSkeleton} aria-hidden="true">
      <div className={styles.cellAudioSkeletonSubtabs}>
        <Skeleton width="72px" height="var(--space-4-5)" />
        <Skeleton width="96px" height="var(--space-4-5)" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.cellAudioSkeletonRow}>
          <Skeleton width="var(--touch-target-mobile)" height="var(--touch-target-mobile)" shape="circle" className={styles.cellAudioSkeletonPlay} />
          <div className={styles.cellAudioSkeletonLabel}>
            <Skeleton width="100%" height="calc(var(--space-5) + var(--border-width-hairline))" />
            <Skeleton width="100%" height="var(--space-4-5)" />
          </div>
          <Skeleton width="var(--space-4)" height="var(--space-4)" />
        </div>
      ))}
    </div>
  );
}

function AudioPanel({
  items,
  loading,
  error,
  selection,
  onToggle,
  onTts,
}: {
  readonly items: readonly AudioItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onTts: () => void;
}): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeGroup, setActiveGroup] = useState<'word' | 'sentence'>('word');

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.cellAudio} data-testid="dictionary-audio-panel">
        <AudioSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.cellAudio} data-testid="dictionary-audio-panel">
        <div className={styles.cellAudioError}>{error}</div>
        <div className={styles.cellAudioEmpty}>
          <span className={styles.cellAudioEmptyIcon}><Icon name="audioWave" size={24} /></span>
          <span className={styles.cellAudioEmptyTitle}>No audio available</span>
          <Button variant="outline" size="sm" onClick={onTts} leadingIcon={<Icon name="play" size={16} />}>
            Use system TTS
          </Button>
        </div>
      </div>
    );
  }

  const filteredItems = items.filter((item) => item.kind === activeGroup).slice(0, 3);
  const groupLabel = activeGroup === 'word' ? 'word' : 'sentence';

  return (
    <div className={styles.cellAudio} data-testid="dictionary-audio-panel">
      <div className={styles.cellAudioSubtabs} role="tablist" aria-label="Audio groups">
        {(['word', 'sentence'] as const).map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={activeGroup === group}
            className={`${styles.cellAudioSubtab} ${activeGroup === group ? styles['cellAudioSubtab--active'] : ''}`}
            onClick={(): void => setActiveGroup(group)}
          >
            Play {group}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className={styles.cellAudioEmpty}>
          <span className={styles.cellAudioEmptyIcon}><Icon name="audioWave" size={24} /></span>
          <span className={styles.cellAudioEmptyTitle}>No {groupLabel} audio available</span>
          <Button variant="outline" size="sm" onClick={onTts} leadingIcon={<Icon name="play" size={16} />}>
            Use system TTS
          </Button>
        </div>
      ) : (
        filteredItems.map((item) => {
          const selected = selection.get(item.id) ?? item.defaultSelected;
          const parts = item.label.split(' · ');
          return (
            <div key={item.id} className={styles.cellAudioItem}>
              <button
                type="button"
                className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellAudioPlay}`}
                aria-label={item.state === 'error' || !item.url ? `Audio unavailable for ${item.label}` : `Play ${item.label}`}
                disabled={item.state === 'error' || !item.url}
                onClick={(): void => {
                  if (!item.url) return;
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                  }
                  const audio = new Audio(item.url);
                  audioRef.current = audio;
                  audio.addEventListener('ended', () => { audioRef.current = null; }, { once: true });
                  audio.addEventListener('pause', () => { if (audioRef.current === audio) audioRef.current = null; }, { once: true });
                  void audio.play().catch(() => { /* best-effort */ });
                }}
              >
                <Icon name="play" size={16} />
              </button>
              <button
                type="button"
                className={styles.cellAudioLabel}
                aria-pressed={selected}
                onClick={(): void => onToggle(item.id, !selected)}
              >
                <span className={styles.cellAudioLabelName}>{parts[0] ?? item.label}</span>
                {parts.length > 1 && (
                  <span className={styles.cellAudioLabelMeta}>{parts.slice(1).join(' · ')}</span>
                )}
              </button>
              <span className={`${styles.cellAudioCheck} ${selected ? styles['cellAudioCheck--checked'] : ''}`} aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function ImageSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellImageSkeleton} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width="84px" height="84px" shape="rounded" className={styles.cellImageSkeletonCard} />
      ))}
    </div>
  );
}

function ImagePanel({
  items,
  loading,
  error,
  selection,
  onToggle,
  onImageError,
  term,
}: {
  readonly items: readonly ImageItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onImageError: (id: string) => void;
  readonly term: string;
}): React.JSX.Element {
  if (loading) {
    return (
      <div className={styles.cellImage} data-testid="dictionary-image-panel">
        <ImageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.cellImage} data-testid="dictionary-image-panel">
        <div className={styles.cellImageError}>{error}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.cellImage} data-testid="dictionary-image-panel">
        <div className={styles.cellImageEmpty}>
          <span className={styles.cellImageEmptyIcon}><Icon name="image" size={24} /></span>
          <span className={styles.cellImageEmptyTitle}>No images</span>
          <a
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cellImageEmptyAction}
          >
            Search Google Images →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cellImage} data-testid="dictionary-image-panel">
      <div className={styles.cellImageStrip}>
        {items.map((item) => {
          const selected = selection.get(item.id) ?? item.defaultSelected;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.cellImageCard} ${selected ? styles['cellImageCard--selected'] : ''}`}
              role="checkbox"
              aria-checked={selected}
              onClick={(): void => onToggle(item.id, !selected)}
            >
              <img
                src={item.src}
                alt={item.alt}
                className={styles.cellImageThumb}
                onError={(): void => onImageError(item.id)}
              />
              <span className={styles.cellImageCheck} aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TranslateSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellTranslateSkeleton} aria-hidden="true">
      <div className={styles.cellTranslateSkeletonBlock}>
        <div className={styles.cellTranslateSkeletonText}>
          <Skeleton width="100%" height="calc(var(--space-5) + var(--border-width-hairline))" className={styles.cellTranslateSkeletonLine} />
          <Skeleton width="80%" height="var(--space-4-5)" className={styles.cellTranslateSkeletonLine} />
        </div>
        <Skeleton width="var(--space-4)" height="var(--space-4)" />
      </div>
    </div>
  );
}

function TranslatePanel({
  term,
  sentence,
  targetLang,
  translation,
  error,
  loading,
  onTranslate,
}: {
  readonly term: string;
  readonly sentence: string;
  readonly targetLang: string;
  readonly translation: string;
  readonly error: string | null;
  readonly loading: boolean;
  readonly onTranslate: () => void;
}): React.JSX.Element {
  if (loading && !translation) {
    return (
      <div className={styles.cellTranslate} data-testid="dictionary-translate-panel">
        <TranslateSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.cellTranslate} data-testid="dictionary-translate-panel">
        <div className={styles.cellTranslateError}>{error}</div>
        <div className={styles.cellTranslateEmpty}>
          <span className={styles.cellTranslateEmptyIcon}><Icon name="languages" size={24} /></span>
          <span className={styles.cellTranslateEmptyTitle}>No translation</span>
          <Button variant="outline" size="sm" onClick={onTranslate}>
            Translate to {targetLang}
          </Button>
        </div>
      </div>
    );
  }

  if (translation) {
    return (
      <div className={styles.cellTranslate} data-testid="dictionary-translate-panel">
        <div className={styles.cellTranslateBlock}>
          <div className={styles.cellTranslateText}>
            <div className={styles.cellTranslateTarget}>{translation}</div>
            <div className={styles.cellTranslateNative}>{sentence || term}</div>
          </div>
          <span className={`${styles.cellTranslateCheck} ${styles['cellTranslateCheck--checked']}`}>
            {loading ? <Spinner size="sm" /> : <Icon name="check" size={16} />}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cellTranslate} data-testid="dictionary-translate-panel">
      <div className={styles.cellTranslateEmpty}>
        <span className={styles.cellTranslateEmptyIcon}><Icon name="languages" size={24} /></span>
        <span className={styles.cellTranslateEmptyTitle}>No translation</span>
        <Button variant="outline" size="sm" loading={loading} onClick={onTranslate}>
          Translate to {targetLang}
        </Button>
      </div>
    </div>
  );
}

function LinksPanel({ links }: { readonly links: readonly ExternalDictLink[] }): React.JSX.Element {
  return (
    <div className={styles.cellLinks} data-testid="dictionary-links-panel">
      {links.length === 0 ? (
        <div className={styles.cellLinksEmpty}>
          <span className={styles.cellLinksEmptyIcon}><Icon name="link" size={24} /></span>
          <span className={styles.cellLinksEmptyTitle}>No external links</span>
          <Button variant="outline" size="sm" onClick={() => { /* open settings */ }}>
            Open settings
          </Button>
        </div>
      ) : (
        links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cellLinksItem}
            data-testid={`dictionary-link-${link.id}`}
          >
            <Icon name="link" size={16} />
            <span>{link.name}</span>
          </a>
        ))
      )}
    </div>
  );
}
