import { useState, useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { rankToBand, DEFAULT_BAND_THRESHOLDS, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { usePronunciation } from '@/features/pronunciation/hooks/usePronunciation';
import { useAudioItemUrl } from '@/features/pronunciation/hooks/useAudioItemUrl';
import { PronunciationPanel } from '@/features/pronunciation/ui/PronunciationPanel';
import type { AudioEngineKind } from '@/features/pronunciation/types';
import { nextStatus } from '../services/wordStatusStore';
import { t } from '@/shared/i18n';
import { useCandidate } from './useCandidate';
import { AudioPanel } from './AudioPanel';
import { ImagePanel } from './ImagePanel';
import { TranslatePanel } from './TranslatePanel';
import { LinksPanel } from './LinksPanel';
import { DictionaryToolbar } from './DictionaryToolbar';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './CandidateView.module.css';
import type { LookupResult, DefinitionEntry, WordStatus, PopupCardCreatorPrefill, PopupTab, AudioItem, AudioSourceKind, PopupSelectionSnapshot } from '../types';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

function formatReading(reading: string, readingKind: LookupResult['readingKind']): string {
  if (!reading) return '';
  if (readingKind === 'ipa' && !(reading.startsWith('/') && reading.endsWith('/'))) {
    return `/${reading}/`;
  }
  return reading;
}

function toAudioEngineKind(source: AudioSourceKind): AudioEngineKind {
  switch (source) {
    case 'local':
      return 'localFile';
    case 'espeak':
      return 'espeak';
    case 'cloud-tts':
      return 'supertonic';
    case 'system-tts':
      return 'browserTts';
    case 'community':
    default:
      return 'native';
  }
}

function findSelectedWordAudio(
  items: readonly AudioItem[],
  selection: Map<string, boolean>,
): AudioItem | undefined {
  return items.find(
    (item) => item.kind === 'word' && selection.get(item.id) === true,
  );
}

export interface CandidateViewProps {
  readonly candidate: LookupResult;
  readonly index: number;
  readonly contextSentence: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Called from the empty-definitions state to open Settings → Resources. */
  readonly onOpenSettings?: () => void;
  /** Default media tab to open when this candidate first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** Optional popup selection snapshot used to clone checked state. */
  readonly selectionSnapshot?: PopupSelectionSnapshot;
}

export function CandidateView({
  candidate,
  index,
  contextSentence,
  sourceLang,
  targetLang,
  onSendToCard,
  onQuickAdd,
  onStatusChange,
  onOpenSettings,
  defaultActiveTab,
  selectionSnapshot,
}: CandidateViewProps): React.JSX.Element {
  const panel = useCandidate({
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
    onStatusChange,
    defaultActiveTab,
    selectionSnapshot,
  });

  const { pronunciation } = usePronunciation({
    term: candidate.term,
    langCode: candidate.langCode,
    enabled: panel.activeTab === 'pronunciation',
  });

  const selectedWordAudio = findSelectedWordAudio(panel.audioItems, panel.audioSelection);
  const selectedWordAudioUrl = useAudioItemUrl(selectedWordAudio);

  const [frequencyThresholds, setFrequencyThresholds] = useState<FrequencyBandThresholds>(DEFAULT_BAND_THRESHOLDS);
  const isMountedRef = useRef(false);
  const didLoadRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    withTimeout(loadSettings(), 5_000)
      .then((s) => {
        if (!isMountedRef.current || didLoadRef.current) return;
        const next = s.frequencyBands ?? DEFAULT_BAND_THRESHOLDS;
        didLoadRef.current = true;
        setFrequencyThresholds(next);
      })
      .catch(() => { /* keep defaults */ });
    return () => { isMountedRef.current = false; };
  }, []);

  const frequencyBand = candidate.frequency ? rankToBand(candidate.frequency.rank, frequencyThresholds) : 'none';

  return (
    <article
      className={styles.candidate}
      data-cell-id={`dictionary-candidate-${index}`}
    >
      <header className={styles.cellHeader} data-cell-id="dictionary-header">
        <div className={styles.cellHeaderRow}>
          <div className={styles.cellHeaderMain}>
            <div className={styles.cellHeaderWordRow}>
              <Heading level={2} size={2} className={styles.cellHeaderWord} data-cell-id="dictionary-term">{candidate.term}</Heading>
            </div>
          </div>
          <div className={styles.cellHeaderActions}>
            <Button
              shape="circle"
              size="sm"
              variant="outline"
              className={styles.cellHeaderSend}
              aria-label={t('dict.action.sendToCard')}
              title={t('dict.action.sendToCard')}
              onClick={panel.sendToCard}
              data-cell-id="dictionary-send-to-card"
            >
              <Icon name="pencil"  />
            </Button>
            {onQuickAdd && (
              <Button
                shape="circle"
                size="sm"
                variant="primary"
                className={styles.cellHeaderQuickAdd}
                aria-label={t('dict.action.quickAdd')}
                title={t('dict.action.quickAdd')}
                onClick={panel.quickAdd}
                data-cell-id="dictionary-quick-add"
              >
                <Icon name="zap"  />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className={styles.cellContent} data-cell-id="dictionary-content">
        <div className={styles.cellHeaderReading}>
          {candidate.reading && (
            <span className={styles.cellHeaderIpa} data-cell-id="dictionary-reading">
              {formatReading(candidate.reading, candidate.readingKind)}
            </span>
          )}
          <span className={styles.cellHeaderAudioGroup}>
            <Button
              shape="circle"
              size="xs"
              variant="ghost"
              className={styles.cellHeaderAudio}
              aria-label={t('dict.audio.playWord')}
              title={t('dict.audio.playWord')}
              onClick={panel.playTerm}
              data-cell-id="dictionary-play-term"
            >
              <Icon name="audioWave"  />
            </Button>
            <Button
              shape="circle"
              size="xs"
              variant="ghost"
              className={styles.cellHeaderAudio}
              aria-label={t('dict.audio.playSentence')}
              title={t('dict.audio.playSentence')}
              onClick={panel.playSentence}
              data-cell-id="dictionary-play-sentence"
            >
              <Icon name="messageSquare"  />
            </Button>
          </span>
        </div>
        <div className={styles.cellHeaderSecond}>
          <Button
            variant="transparent"
            className={`${styles.cellHeaderStatus} ${styles[`cellHeaderStatus--${panel.status}`]}`}
            onClick={panel.cycleStatus}
            title={t('dict.status.cycle', [panel.status, nextStatus(panel.status)])}
            data-cell-id="dictionary-status-cycle"
          >
            {panel.status}
          </Button>
          {candidate.frequency && (
            <span className={`${styles.cellHeaderFrequency} ${styles[`cellHeaderFrequency--${frequencyBand}`]}`} data-cell-id="dictionary-frequency">
              <span className={styles.cellHeaderFrequencySource}>{candidate.frequency.source}</span>
              <span className={styles.cellHeaderFrequencyRank}>{candidate.frequency.rank.toLocaleString()}</span>
            </span>
          )}
        </div>

        <DictionaryToolbar
          activeTab={panel.activeTab}
          onSelect={(tab) => panel.setActiveTab(panel.activeTab === tab ? null : tab)}
          counts={{
            audio: panel.selectedAudioCount,
            image: panel.selectedImageCount,
            translate: panel.selectedTranslationCount,
            links: panel.selectedLinkCount,
            pronunciation: pronunciation ? 1 : 0,
          }}
        />

        {/* key=activeTab remounts on tab switch so .cellTabContent replays
           its entrance — panels animate in instead of teleporting. */}
        <div key={panel.activeTab ?? 'none'} className={styles.cellTabContent}>
        {panel.activeTab === 'audio' && (
          <AudioPanel
            items={panel.audioItems}
            loading={panel.audioLoading}
            selection={panel.audioSelection}
            onToggle={panel.toggleAudio}
            onTtsWord={panel.playTerm}
            onTtsSentence={panel.playSentence}
            term={candidate.term}
            sentence={contextSentence}
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
            term={candidate.term}
          />
        )}
        {panel.activeTab === 'translate' && (
          <TranslatePanel
            term={candidate.term}
            sentence={contextSentence}
            targetLang={targetLang}
            translation={panel.translation}
            error={panel.translationError}
            loading={panel.isTranslating}
            selected={panel.translationSelected}
            onToggle={panel.toggleTranslation}
            onTranslate={panel.translate}
          />
        )}
        {panel.activeTab === 'links' && <LinksPanel links={panel.links} />}
        {panel.activeTab === 'pronunciation' && (
          <div data-cell-id="dictionary-pronunciation-panel">
            <PronunciationPanel
              pronunciation={pronunciation}
              audioUrl={selectedWordAudioUrl}
              audioSource={selectedWordAudio ? toAudioEngineKind(selectedWordAudio.source) : undefined}
            />
          </div>
        )}
        </div>

        <section className={panelStyles.cellDef} aria-label={t('dict.definitions.aria')} data-cell-id="dictionary-definitions" data-allow-lookup>
        {candidate.definitions.length === 0 ? (
          <EmptyState
            size="md"
            description={onOpenSettings ? (
              <>
                {t('dict.definitions.empty')}{' '}
                <button
                  type="button"
                  className={styles.cellEmptyLink}
                  onClick={onOpenSettings}
                  data-cell-id="dictionary-import-dictionary"
                >
                  {t('dict.definitions.import')}
                </button>
              </>
            ) : t('dict.definitions.emptyHint')}
            data-cell-id="dictionary-definitions-empty"
          />
        ) : (
          candidate.definitions.map((def) => (
            <DefinitionItem
              key={def.id}
              definition={def}
              selected={panel.definitionSelection.get(def.id) === true}
              onToggle={panel.toggleDefinition}
            />
          ))
        )}
      </section>
      </div>
    </article>
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
  const checked = selected;
  return (
    <div
      className={checkStyles.cellDefItem}
      data-cell-id="dictionary-definition"
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onToggle(definition.id, !checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle(definition.id, !checked);
        }
      }}
    >
      <div className={styles.cellDefRow}>
        <label
          className={`${checkStyles.cellDefCheck} ${checked ? checkStyles['cellDefCheck--checked'] : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className={checkStyles.cellDefCheckInput}
            checked={checked}
            onChange={(e) => onToggle(definition.id, e.target.checked)}
            tabIndex={-1}
            aria-hidden="true"
          />
          <span className={checkStyles.cellDefCheckBox} aria-hidden="true">
            <Icon name="check" size="md" />
          </span>
        </label>
        <span className={styles.cellDefText}>
          {definition.pos ? `${definition.pos} ${definition.text}` : definition.text}
        </span>
      </div>
      {definition.examples.length > 0 && (
        <div className={styles.cellDefExamples}>
          {definition.examples.map((ex, i) => (
            <div key={i}>• {ex}</div>
          ))}
        </div>
      )}
    </div>
  );
}



