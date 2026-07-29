import { Icon } from '@/shared/icons/Icon';
import { rankToBand } from '@/shared/lib/frequencyBand';
import { nextStatus } from '../services/wordStatusStore';
import { useCandidate } from './useCandidate';
import { AudioPanel } from './AudioPanel';
import { ImagePanel } from './ImagePanel';
import { TranslatePanel } from './TranslatePanel';
import { LinksPanel } from './LinksPanel';
import { DictionaryToolbar } from './DictionaryToolbar';
import styles from './DictionaryPanelView.module.css';
import type { LookupResult, DefinitionEntry, WordStatus, PopupCardCreatorPrefill } from '../types';

function formatReading(reading: string, readingKind: LookupResult['readingKind']): string {
  if (!reading) return '';
  if (readingKind === 'ipa' && !(reading.startsWith('/') && reading.endsWith('/'))) {
    return `/${reading}/`;
  }
  return reading;
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
}: CandidateViewProps): React.JSX.Element {
  const panel = useCandidate({
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
    onStatusChange,
  });

  const frequencyBand = candidate.frequency ? rankToBand(candidate.frequency.rank) : 'none';

  return (
    <article
      className={styles.candidate}
      id={`dictionary-candidate-${index}`}
      data-testid={`dictionary-candidate-${index}`}
    >
      <header className={styles.cellHeader} data-testid="dictionary-header">
        <div className={styles.cellHeaderRow}>
          <div className={styles.cellHeaderMain}>
            <div className={styles.cellHeaderWordRow}>
              <h2 className={styles.cellHeaderWord} data-testid="dictionary-term">{candidate.term}</h2>
            </div>
            <div className={styles.cellHeaderReading}>
              {candidate.reading && (
                <span className={styles.cellHeaderIpa} data-testid="dictionary-reading">
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
                  data-testid="dictionary-play-term"
                >
                  <Icon name="audioWave" size={16} />
                </button>
                <button
                  type="button"
                  className={`icon-btn icon-btn--xs ${styles.cellHeaderAudio}`}
                  aria-label="Play sentence audio"
                  title="Play sentence audio"
                  onClick={panel.playSentence}
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
              <Icon name="pencil" size={20} />
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
                <Icon name="zap" size={20} />
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
          {candidate.frequency && (
            <span className={`${styles.cellHeaderFrequency} ${styles[`cellHeaderFrequency--${frequencyBand}`]}`} data-testid="dictionary-frequency">
              <span className={styles.cellHeaderFrequencySource}>{candidate.frequency.source}</span>
              <span className={styles.cellHeaderFrequencyRank}>{candidate.frequency.rank.toLocaleString()}</span>
            </span>
          )}
        </div>
      </header>

      <DictionaryToolbar
        activeTab={panel.activeTab}
        onSelect={(tab) => panel.setActiveTab(panel.activeTab === tab ? null : tab)}
        counts={{
          audio: panel.selectedAudioCount,
          image: panel.selectedImageCount,
          translate: panel.selectedTranslationCount,
          links: panel.selectedLinkCount,
        }}
      />

      {panel.activeTab === 'audio' && (
        <AudioPanel
          items={panel.audioItems}
          loading={panel.audioLoading}
          error={panel.audioError}
          selection={panel.audioSelection}
          onToggle={panel.toggleAudio}
          onTts={panel.playTerm}
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

      <section className={styles.cellDef} aria-label="Definitions" data-testid="dictionary-definitions" data-allow-lookup>
        {candidate.definitions.length === 0 ? (
          <div className={styles.cellDefEmpty}>
            <Icon name="info" size={24} />
            <span>No definitions found. Import a dictionary in Settings → Resources.</span>
          </div>
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
      data-testid="dictionary-definition"
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



