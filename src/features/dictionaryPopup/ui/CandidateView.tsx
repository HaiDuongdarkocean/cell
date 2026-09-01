import { Icon } from '@/shared/icons/Icon';
import { EmptyState } from '@/shared/ui/EmptyState';
import { rankToBand } from '@/shared/lib/frequencyBand';
import { usePronunciation } from '@/features/pronunciation/hooks/usePronunciation';
import { useAudioItemUrl } from '@/features/pronunciation/hooks/useAudioItemUrl';
import { PronunciationPanel } from '@/features/pronunciation/ui/PronunciationPanel';
import type { AudioEngineKind } from '@/features/pronunciation/types';
import { nextStatus } from '../services/wordStatusStore';
import { useCandidate } from './useCandidate';
import { AudioPanel } from './AudioPanel';
import { ImagePanel } from './ImagePanel';
import { TranslatePanel } from './TranslatePanel';
import { LinksPanel } from './LinksPanel';
import { DictionaryToolbar } from './DictionaryToolbar';
import styles from './DictionaryPanelView.module.css';
import type { LookupResult, DefinitionEntry, WordStatus, PopupCardCreatorPrefill, PopupTab, AudioItem, AudioSourceKind } from '../types';

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
    (item) => item.kind === 'word' && (selection.get(item.id) ?? item.defaultSelected),
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
  /** Called when the user adds this word to Ocean SRS. */
  readonly onAddToSrs?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Default media tab to open when this candidate first appears. */
  readonly defaultActiveTab?: PopupTab | null;
}

export function CandidateView({
  candidate,
  index,
  contextSentence,
  sourceLang,
  targetLang,
  onSendToCard,
  onQuickAdd,
  onAddToSrs,
  onStatusChange,
  defaultActiveTab,
}: CandidateViewProps): React.JSX.Element {
  const panel = useCandidate({
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
    onAddToSrs,
    onStatusChange,
    defaultActiveTab,
  });

  const { pronunciation } = usePronunciation({
    term: candidate.term,
    langCode: candidate.langCode,
    enabled: panel.activeTab === 'pronunciation',
  });

  const selectedWordAudio = findSelectedWordAudio(panel.audioItems, panel.audioSelection);
  const selectedWordAudioUrl = useAudioItemUrl(selectedWordAudio);

  const frequencyBand = candidate.frequency ? rankToBand(candidate.frequency.rank) : 'none';

  return (
    <article
      className={styles.candidate}
      id={`dictionary-candidate-${index}`}
      data-cell-id={`dictionary-candidate-${index}`}
    >
      <header className={styles.cellHeader} data-cell-id="dictionary-header">
        <div className={styles.cellHeaderRow}>
          <div className={styles.cellHeaderMain}>
            <div className={styles.cellHeaderWordRow}>
              <h2 className={styles.cellHeaderWord} data-cell-id="dictionary-term">{candidate.term}</h2>
            </div>
          </div>
          <div className={styles.cellHeaderActions}>
            <button
              type="button"
              className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellHeaderSend}`}
              aria-label="Send to Card Creator"
              title="Send to Card Creator"
              onClick={panel.sendToCard}
              data-cell-id="dictionary-send-to-card"
            >
              <Icon name="pencil"  />
            </button>
            {onQuickAdd && (
              <button
                type="button"
                className={`icon-btn icon-btn--sm icon-btn--filled ${styles.cellHeaderQuickAdd}`}
                aria-label="Quick Add to Anki"
                title="Quick Add to Anki"
                onClick={panel.quickAdd}
                data-cell-id="dictionary-quick-add"
              >
                <Icon name="zap"  />
              </button>
            )}
            {onAddToSrs && (
              <button
                type="button"
                className={`icon-btn icon-btn--sm icon-btn--outlined ${styles.cellHeaderSrs}`}
                aria-label="Add to Ocean SRS"
                title="Add to Ocean SRS"
                onClick={panel.addToSrs}
                data-cell-id="dictionary-add-to-srs"
              >
                <Icon name="plus"  />
              </button>
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
            <button
              type="button"
              className={`icon-btn icon-btn--xs ${styles.cellHeaderAudio}`}
              aria-label="Play word audio"
              title="Play word audio"
              onClick={panel.playTerm}
              data-cell-id="dictionary-play-term"
            >
              <Icon name="audioWave"  />
            </button>
            <button
              type="button"
              className={`icon-btn icon-btn--xs ${styles.cellHeaderAudio}`}
              aria-label="Play sentence audio"
              title="Play sentence audio"
              onClick={panel.playSentence}
            >
              <Icon name="messageSquare"  />
            </button>
          </span>
        </div>
        <div className={styles.cellHeaderSecond}>
          <button
            type="button"
            className={`${styles.cellHeaderStatus} ${styles[`cellHeaderStatus--${panel.status}`]}`}
            onClick={panel.cycleStatus}
            title={`Click to cycle: ${panel.status} → ${nextStatus(panel.status)}`}
            data-cell-id="dictionary-status-cycle"
          >
            {panel.status}
          </button>
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
          <PronunciationPanel
            pronunciation={pronunciation}
            audioUrl={selectedWordAudioUrl}
            audioSource={selectedWordAudio ? toAudioEngineKind(selectedWordAudio.source) : undefined}
          />
        )}

        <section className={styles.cellDef} aria-label="Definitions" data-cell-id="dictionary-definitions" data-allow-lookup>
        {candidate.definitions.length === 0 ? (
          <EmptyState
            size="md"
            icon={<Icon name="info"  />}
            description="No definitions found. Import a dictionary in Settings → Resources."
            data-cell-id="dictionary-definitions-empty"
          />
        ) : (
          candidate.definitions.map((def) => (
            <DefinitionItem
              key={def.id}
              definition={def}
              selected={panel.definitionSelection.get(def.id) ?? def.defaultSelected}
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
  const checked = selected ?? definition.defaultSelected;
  return (
    <div
      className={styles.cellDefItem}
      data-cell-id="dictionary-definition"
      onClick={() => onToggle(definition.id, !checked)}
    >
      <label
        className={`${styles.cellDefCheck} ${checked ? styles['cellDefCheck--checked'] : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className={styles.cellDefCheckInput}
          checked={checked}
          onChange={(e) => onToggle(definition.id, e.target.checked)}
          aria-label={`Select definition: ${definition.text}`}
        />
        <span className={styles.cellDefCheckDot} aria-hidden="true" />
        <span className={styles.cellDefCheckBox} aria-hidden="true">
          <Icon name="check"  />
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



