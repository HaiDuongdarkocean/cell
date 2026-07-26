import { useCallback, useEffect, useRef, useState } from 'react';
import { useDictionaryPanel } from './useDictionaryPanel';
import { SearchField } from '@/shared/ui/SearchField';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Badge } from '@/shared/ui/Badge';
import { Spinner } from '@/shared/ui/Spinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Tabs } from '@/shared/ui/Tabs';
import { Icon } from '@/shared/icons/Icon';
import { rankToBand } from '@/shared/lib/frequencyBand';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import type { LookupResult, DefinitionEntry, PopupTab, WordStatus, ExternalDictLink } from '../types';
import styles from './DictionaryPanelView.module.css';

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

function statusVariant(status: WordStatus): 'default' | 'secondary' | 'warning' | 'success' | 'destructive' | 'outline' {
  switch (status) {
    case 'known': return 'success';
    case 'tracking': return 'warning';
    case 'ignore': return 'destructive';
    default: return 'secondary';
  }
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
  isOpen = true,
}: DictionaryPanelViewProps): React.JSX.Element {
  const panel = useDictionaryPanel({
    langCode,
    sourceLang,
    targetLang,
    initialTerm,
    onSendToCard,
  });

  const [audioLoading, setAudioLoading] = useState(false);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      panel.search(panel.searchTerm);
    }
  }, [panel]);

  const handleSearchButton = useCallback((): void => {
    panel.search(panel.searchTerm);
  }, [panel]);

  const handlePlayTerm = useCallback((): void => {
    if (!panel.currentResult) return;
    setAudioLoading(true);
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: panel.currentResult.term, langCode: panel.currentResult.langCode },
    }).finally(() => { setAudioLoading(false); });
  }, [panel.currentResult]);

  const handleTranslate = useCallback((): void => {
    panel.translate();
  }, [panel]);

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
          value={panel.searchTerm}
          onChange={panel.setSearchTerm}
          onKeyDown={handleSearchKeyDown}
          placeholder="Type a word and press Enter"
          disabled={panel.isLoading}
          className={styles.searchField}
        />
        <Button
          variant="primary"
          size="md"
          loading={panel.isLoading}
          onClick={handleSearchButton}
          leadingIcon={<Icon name="search" size={16} />}
          className={styles.searchButton}
        >
          Search
        </Button>
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
        <EmptyState
          icon={<Icon name="bookOpen" size={32} />}
          title="No word searched yet"
          description="Type a word above and press Enter to look it up."
          data-testid="dictionary-empty"
        />
      )}

      {panel.currentResult && (
        <>
          <header className={styles.header} data-testid="dictionary-header">
            <div className={styles.headerMain}>
              <h2 className={styles.term} data-testid="dictionary-term">{panel.currentResult.term}</h2>
              {panel.currentResult.reading && (
                <span className={styles.reading} data-testid="dictionary-reading">
                  {formatReading(panel.currentResult.reading, panel.currentResult.readingKind)}
                </span>
              )}
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Play word audio"
                onClick={handlePlayTerm}
                disabled={audioLoading}
                data-testid="dictionary-play-term"
              >
                <Icon name="play" size={18} />
              </IconButton>
            </div>
            <div className={styles.headerBadges}>
              {panel.currentResult.frequency && (
                <span className={`${styles.frequency} ${styles[`frequency--${frequencyBand}`]}`} data-testid="dictionary-frequency">
                  <span className={styles.frequencySource}>{panel.currentResult.frequency.source}</span>
                  <span className={styles.frequencyRank}>{panel.currentResult.frequency.rank.toLocaleString()}</span>
                </span>
              )}
            </div>
          </header>

          {panel.candidates.length > 0 && (
            <div className={styles.candidates} role="list" aria-label="Dictionary candidates">
              {[panel.currentResult, ...panel.candidates].map((c, idx) => (
                <Button
                  key={`${c.term}-${idx}`}
                  variant={idx === panel.activeCandidateIndex ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => panel.setActiveCandidate(idx)}
                  data-testid={`dictionary-candidate-${idx}`}
                >
                  {c.term}
                </Button>
              ))}
            </div>
          )}

          <section className={styles.definitions} aria-label="Definitions" data-testid="dictionary-definitions">
            {panel.currentResult.definitions.length === 0 ? (
              <EmptyState
                icon={<Icon name="info" size={24} />}
                title="No definitions found"
                description="Import a dictionary in Settings → Resources."
              />
            ) : (
              panel.currentResult.definitions.map((def) => (
                <DefinitionItem key={def.id} definition={def} />
              ))
            )}
          </section>

          <div className={styles.tabs}>
            <Tabs value={panel.activeTab ?? ''} onValueChange={(v) => panel.setActiveTab(v as PopupTab)}>
              <Tabs.List className={styles.tabList}>
                {TABS.map((tab) => (
                  <Tabs.Trigger key={tab.key} value={tab.key} className={styles.tabTrigger} data-testid={`dictionary-tab-${tab.key}`}>
                    <Icon name={tab.icon} size={16} />
                    <span>{tab.label}</span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value="audio" className={styles.tabContent}>
                <AudioPanel loading={audioLoading} onPlay={handlePlayTerm} />
              </Tabs.Content>
              <Tabs.Content value="image" className={styles.tabContent}>
                <ImagePanel term={panel.currentResult.term} />
              </Tabs.Content>
              <Tabs.Content value="translate" className={styles.tabContent}>
                <TranslatePanel
                  term={panel.currentResult.term}
                  sentence={panel.searchTerm}
                  targetLang={targetLang}
                  translation={panel.translation}
                  loading={panel.isTranslating}
                  onTranslate={handleTranslate}
                />
              </Tabs.Content>
              <Tabs.Content value="links" className={styles.tabContent}>
                <LinksPanel links={links} />
              </Tabs.Content>
            </Tabs>
          </div>

          <footer className={styles.footer} data-testid="dictionary-footer">
            <Button
              variant="ghost"
              size="sm"
              onClick={panel.cycleStatus}
              data-testid="dictionary-status-cycle"
            >
              <Badge variant={statusVariant(panel.status)}>{panel.status}</Badge>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={panel.sendToCard}
              leadingIcon={<Icon name="pencil" size={16} />}
              data-testid="dictionary-send-to-card"
            >
              Send to Card
            </Button>
          </footer>
        </>
      )}
    </div>
  );
}

function DefinitionItem({ definition }: { readonly definition: DefinitionEntry }): React.JSX.Element {
  return (
    <div className={styles.definition} data-testid="dictionary-definition">
      <div className={styles.definitionText}>
        {definition.pos && <Badge variant="secondary" size="sm" className={styles.definitionPos}>{definition.pos}</Badge>}
        <span className={styles.definitionBody}>{definition.text}</span>
      </div>
      {definition.examples.length > 0 && (
        <ul className={styles.examples}>
          {definition.examples.map((ex, i) => (
            <li key={i} className={styles.example}>• {ex}</li>
          ))}
        </ul>
      )}
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
    <div className={styles.tabPanel} data-testid="dictionary-audio-panel">
      <EmptyState
        icon={<Icon name="audioWave" size={24} />}
        title="No audio loaded"
        description="Play the word using system TTS or fetch audio in Settings."
        action={
          <Button variant="outline" size="sm" loading={loading} onClick={onPlay} leadingIcon={<Icon name="play" size={16} />}>
            Play word
          </Button>
        }
      />
    </div>
  );
}

function ImagePanel({ term }: { readonly term: string }): React.JSX.Element {
  const query = encodeURIComponent(term);
  return (
    <div className={styles.tabPanel} data-testid="dictionary-image-panel">
      <EmptyState
        icon={<Icon name="image" size={24} />}
        title="No images loaded"
        description="Open Google Images to find pictures for this word."
        action={
          <a
            href={`https://www.google.com/search?tbm=isch&q=${query}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
          >
            Search Google Images →
          </a>
        }
      />
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
    <div className={styles.tabPanel} data-testid="dictionary-translate-panel">
      {translation ? (
        <div className={styles.translationBlock}>
          <div className={styles.translationTarget}>{translation}</div>
          <div className={styles.translationSource}>{sentence || term}</div>
        </div>
      ) : (
        <EmptyState
          icon={<Icon name="languages" size={24} />}
          title="No translation"
          description={`Translate the current sentence to ${targetLang}.`}
          action={
            <Button variant="outline" size="sm" loading={loading} onClick={onTranslate}>
              Translate to {targetLang}
            </Button>
          }
        />
      )}
    </div>
  );
}

function LinksPanel({ links }: { readonly links: readonly ExternalDictLink[] }): React.JSX.Element {
  return (
    <div className={styles.tabPanel} data-testid="dictionary-links-panel">
      {links.length === 0 ? (
        <EmptyState icon={<Icon name="link" size={24} />} title="No external links" description="Add dictionary links in Settings → Dictionary Popup." />
      ) : (
        <div className={styles.linksList}>
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkItem}
              data-testid={`dictionary-link-${link.id}`}
            >
              <Icon name="link" size={16} />
              <span>{link.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
