import { useCallback, useEffect, useRef, useState } from 'react';
import { useDictionaryPanel } from './useDictionaryPanel';
import { SearchField } from '@/shared/ui/SearchField';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { Icon } from '@/shared/icons/Icon';
import { rankToBand } from '@/shared/lib/frequencyBand';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { nextStatus } from '../services/wordStatusStore';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import type { LookupResult, DefinitionEntry, PopupTab, ExternalDictLink } from '../types';
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
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTypedRef = useRef(false);

  const { searchTerm, setSearchTerm, search } = panel;

  const handleSearchChange = useCallback((value: string): void => {
    userTypedRef.current = true;
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
    searchDebounceRef.current = setTimeout(() => {
      userTypedRef.current = false;
      search(trimmed);
    }, 350);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm, search]);

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
        <div className={styles.cellDefEmpty} data-testid="dictionary-empty">
          <Icon name="bookOpen" size={24} />
          <span>Type a word above and press Enter to look it up.</span>
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

          {panel.activeTab === 'audio' && <AudioPanel loading={audioLoading} onPlay={handlePlayTerm} />}
          {panel.activeTab === 'image' && <ImagePanel term={panel.currentResult.term} />}
          {panel.activeTab === 'translate' && (
            <TranslatePanel
              term={panel.currentResult.term}
              sentence={panel.searchTerm}
              targetLang={targetLang}
              translation={panel.translation}
              loading={panel.isTranslating}
              onTranslate={handleTranslate}
            />
          )}
          {panel.activeTab === 'links' && <LinksPanel links={links} />}

          <section className={styles.cellDef} aria-label="Definitions" data-testid="dictionary-definitions">
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
            <div className={styles.cellCandidates} role="list" aria-label="Dictionary candidates">
              <div className={styles.cellCandidatesChips}>
                <div className={styles.cellCandidatesChipsScroll} role="list">
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
        <span className={styles.cellDefCheckTick} aria-hidden="true">
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

function AudioPanel({
  loading,
  onPlay,
}: {
  readonly loading: boolean;
  readonly onPlay: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.cellAudio} data-testid="dictionary-audio-panel">
      <div className={styles.cellAudioEmpty}>
        <span className={styles.cellAudioEmptyIcon}><Icon name="audioWave" size={24} /></span>
        <span className={styles.cellAudioEmptyTitle}>No audio available</span>
        <Button
          variant="outline"
          size="sm"
          loading={loading}
          onClick={onPlay}
          leadingIcon={<Icon name="play" size={16} />}
        >
          Use system TTS
        </Button>
      </div>
    </div>
  );
}

function ImagePanel({ term }: { readonly term: string }): React.JSX.Element {
  const query = encodeURIComponent(term);
  return (
    <div className={styles.cellImage} data-testid="dictionary-image-panel">
      <div className={styles.cellImageEmpty}>
        <span className={styles.cellImageEmptyIcon}><Icon name="image" size={24} /></span>
        <span className={styles.cellImageEmptyTitle}>No images</span>
        <a
          href={`https://www.google.com/search?tbm=isch&q=${query}`}
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

function TranslatePanel({
  term,
  sentence,
  targetLang,
  translation,
  loading,
  onTranslate,
}: {
  readonly term: string;
  readonly sentence: string;
  readonly targetLang: string;
  readonly translation: string;
  readonly loading: boolean;
  readonly onTranslate: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.cellTranslate} data-testid="dictionary-translate-panel">
      {translation ? (
        <div className={styles.cellTranslateBlock}>
          <div className={styles.cellTranslateText}>
            <div className={styles.cellTranslateTarget}>{translation}</div>
            <div className={styles.cellTranslateNative}>{sentence || term}</div>
          </div>
          <span className={`${styles.cellTranslateCheck} ${styles['cellTranslateCheck--checked']}`}>
            <Icon name="check" size={16} />
          </span>
        </div>
      ) : (
        <div className={styles.cellTranslateEmpty}>
          <span className={styles.cellTranslateEmptyIcon}><Icon name="languages" size={24} /></span>
          <span className={styles.cellTranslateEmptyTitle}>No translation</span>
          <Button variant="outline" size="sm" loading={loading} onClick={onTranslate}>
            Translate to {targetLang}
          </Button>
        </div>
      )}
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
