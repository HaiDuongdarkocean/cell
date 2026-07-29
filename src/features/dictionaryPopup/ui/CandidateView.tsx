import { useRef, useState } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import { rankToBand } from '@/shared/lib/frequencyBand';
import { nextStatus } from '../services/wordStatusStore';
import { useCandidate } from './useCandidate';
import styles from './DictionaryPanelView.module.css';
import type { LookupResult, DefinitionEntry, PopupTab, ExternalDictLink, AudioItem, ImageItem } from '../types';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';

type IconName = React.ComponentProps<typeof Icon>['name'];

const TABS: { key: PopupTab; icon: IconName; label: string }[] = [
  { key: 'audio', icon: 'audioWave', label: 'Audio' },
  { key: 'image', icon: 'image', label: 'Image' },
  { key: 'translate', icon: 'languages', label: 'Translate' },
  { key: 'links', icon: 'link', label: 'Links' },
];

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
}

export function CandidateView({
  candidate,
  index,
  contextSentence,
  sourceLang,
  targetLang,
  onSendToCard,
  onQuickAdd,
}: CandidateViewProps): React.JSX.Element {
  const panel = useCandidate({
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
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

      <div className={styles.cellToolbar} role="tablist" aria-label="Dictionary materials">
        {TABS.map((tab) => {
          const active = panel.activeTab === tab.key;
          const count = tab.key === 'audio' ? panel.selectedAudioCount
            : tab.key === 'image' ? panel.selectedImageCount
            : tab.key === 'translate' ? panel.selectedTranslationCount
            : tab.key === 'links' ? panel.selectedLinkCount
            : 0;
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
              {count > 0 && <span className={styles.cellToolbarBadge}>{count}</span>}
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

  return (
    <div className={styles.cellAudio} data-testid="dictionary-audio-panel">
      {loading ? (
        <AudioSkeleton />
      ) : error ? (
        <>
          <div className={styles.cellAudioError}>{error}</div>
          <div className={styles.cellAudioEmpty}>
            <span className={styles.cellAudioEmptyIcon}><Icon name="audioWave" size={24} /></span>
            <span className={styles.cellAudioEmptyTitle}>No audio available</span>
            <Button variant="outline" size="sm" onClick={onTts} leadingIcon={<Icon name="play" size={16} />}>
              Use system TTS
            </Button>
          </div>
        </>
      ) : (
        <AudioPanelContent
          items={items}
          selection={selection}
          onToggle={onToggle}
          onTts={onTts}
          activeGroup={activeGroup}
          setActiveGroup={setActiveGroup}
          audioRef={audioRef}
        />
      )}
    </div>
  );
}

function AudioPanelContent({
  items,
  selection,
  onToggle,
  onTts,
  activeGroup,
  setActiveGroup,
  audioRef,
}: {
  readonly items: readonly AudioItem[];
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onTts: () => void;
  readonly activeGroup: 'word' | 'sentence';
  readonly setActiveGroup: (group: 'word' | 'sentence') => void;
  readonly audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}): React.JSX.Element {
  const filteredItems = items.filter((item) => item.kind === activeGroup).slice(0, 3);
  const groupLabel = activeGroup === 'word' ? 'word' : 'sentence';

  return (
    <>
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
                <Icon name="play" size={20} />
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
    </>
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
  selected,
  onToggle,
  onTranslate,
}: {
  readonly term: string;
  readonly sentence: string;
  readonly targetLang: string;
  readonly translation: string;
  readonly error: string | null;
  readonly loading: boolean;
  readonly selected: boolean;
  readonly onToggle: () => void;
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
        <div
          className={`${styles.cellTranslateBlock} ${selected ? styles['cellTranslateBlock--selected'] : ''}`}
          onClick={onToggle}
          role="button"
          aria-pressed={selected}
          tabIndex={0}
        >
          <div className={styles.cellTranslateText}>
            <div className={styles.cellTranslateTarget}>{translation}</div>
            <div className={styles.cellTranslateNative}>{sentence || term}</div>
          </div>
          <span className={`${styles.cellTranslateCheck} ${selected ? styles['cellTranslateCheck--checked'] : ''}`}>
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
