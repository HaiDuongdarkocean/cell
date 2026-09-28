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
import { nextStatus } from '@/features/dictionary/services/wordStatusStore';
import { t } from '@/shared/i18n';
import { useCandidate } from './useCandidate';
import { PronunciationAudioPanel } from './PronunciationAudioPanel';
import { ImagePanel } from './ImagePanel';
import { TranslatePanel } from './TranslatePanel';
import { LinksPanel } from './LinksPanel';
import { DictionaryToolbar } from './DictionaryToolbar';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './CandidateView.module.css';
import type { LookupResult, DefinitionEntry, WordStatus, PopupCardCreatorPrefill, PopupTab, AudioItem, AudioSourceKind, PopupSelectionSnapshot, SenseLine, RelatedEntry } from '@/entities/dictionary';

const EMPTY_EXAMPLE_SET: ReadonlySet<number> = new Set<number>();

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
  /** Preload media/translation in the integrated panel. */
  readonly preloadMedia?: boolean;
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
  preloadMedia,
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
    preloadMedia,
  });

  const { pronunciation } = usePronunciation({
    term: candidate.term,
    langCode: candidate.langCode,
    enabled: panel.activeTab === 'pronunciation',
  });

  const selectedWordAudio = findSelectedWordAudio(panel.audioItems, panel.audioSelection);
  const selectedWordAudioUrl = useAudioItemUrl(selectedWordAudio);

  const [frequencyThresholds, setFrequencyThresholds] = useState<FrequencyBandThresholds>(DEFAULT_BAND_THRESHOLDS);
  const [translationRevealed, setTranslationRevealed] = useState(false);
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
        setTranslationRevealed(s.dictionaryPopup?.translationVisibility === 'shown');
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
            {onSendToCard && (
              <Button
                shape="circle"
                size="sm"
                variant="outline"
                className={styles.cellHeaderSend}
                aria-label={t('dict.action.sendToCard')}
                title={t('dict.action.sendToCard')}
                onClick={() => { void panel.sendToCard(); }}
                data-cell-id="dictionary-send-to-card"
              >
                <Icon name="pencil"  />
              </Button>
            )}
            {onQuickAdd && (
              <Button
                shape="circle"
                size="sm"
                variant="primary"
                className={styles.cellHeaderQuickAdd}
                aria-label={t('dict.action.quickAdd')}
                title={t('dict.action.quickAdd')}
                onClick={() => { void panel.quickAdd(); }}
                data-cell-id="dictionary-quick-add"
              >
                <Icon name="zap"  />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className={styles.cellContent} data-cell-id="dictionary-content">
        {(candidate.reading || candidate.level || candidate.frequencyStars) && (
          <div className={styles.cellHeaderReading}>
            {candidate.reading && (
              <span className={styles.cellHeaderIpa} data-cell-id="dictionary-reading">
                {formatReading(candidate.reading, candidate.readingKind)}
              </span>
            )}
            {candidate.frequencyStars != null && candidate.frequencyStars > 0 && (
              <span className={styles.cellHeaderLevel} data-cell-id="dictionary-stars">
                {'●'.repeat(candidate.frequencyStars)}
              </span>
            )}
            {candidate.level && (
              <span className={styles.cellHeaderLevel} data-cell-id="dictionary-level">[{candidate.level}]</span>
            )}
          </div>
        )}
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
          <PronunciationAudioPanel
            items={panel.audioItems}
            loading={panel.audioLoading}
            localAudioNeedsRegrant={panel.localAudioNeedsRegrant}
            selection={panel.audioSelection}
            onToggle={panel.toggleAudio}
            onTtsWord={panel.playTerm}
            onTtsSentence={panel.playSentence}
            autoplayCount={panel.autoplayCount}
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
            onTranslate={() => { void panel.translate(); }}
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

        {candidate.inflections && candidate.inflections.length > 0 && (
          <div className={styles.cellMetaLine} data-cell-id="dictionary-word-forms">
            <span className={styles.cellMetaLabel}>word forms:</span>{' '}
            {candidate.inflections.map((g) => (g.type ? `${g.type} ` : '') + g.forms.join(', ')).join(' · ')}
          </div>
        )}

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
              checkedExamples={panel.exampleSelection.get(def.id) ?? EMPTY_EXAMPLE_SET}
              onToggle={panel.toggleDefinition}
              onToggleExample={panel.toggleExample}
              translationRevealed={translationRevealed}
            />
          ))
        )}
      </section>

      <EntryMeta candidate={candidate} />
      </div>
    </article>
  );
}

const RELATED_KIND_LABELS: Record<string, string> = {
  phrasal: 'phrasal verbs',
  idiom: 'idioms',
  collocation: 'collocations',
  expression: 'phrases',
  lemma: 'lemmas',
  derivative: 'derivatives',
  thesaurus: 'thesaurus',
};

function relatedKindLabel(kind: string): string {
  return RELATED_KIND_LABELS[kind] ?? `${kind}s`;
}

function groupRelated(related: readonly RelatedEntry[]): [string, RelatedEntry[]][] {
  const groups = new Map<string, RelatedEntry[]>();
  for (const r of related) {
    const list = groups.get(r.kind) ?? [];
    list.push(r);
    groups.set(r.kind, list);
  }
  return [...groups.entries()];
}

function EntryMeta({
  candidate,
}: {
  readonly candidate: LookupResult;
}): React.JSX.Element | null {
  const relatedGroups = candidate.related?.length ? groupRelated(candidate.related) : [];
  const nonEmpty = (p: readonly [string, readonly string[] | undefined]): p is [string, readonly string[]] =>
    Boolean(p[1] && p[1].length > 0);
  const wordFamilyParts = candidate.wordFamily
    ? ([
        ['noun', candidate.wordFamily.nouns],
        ['verb', candidate.wordFamily.verbs],
        ['adjective', candidate.wordFamily.adjectives],
        ['adverb', candidate.wordFamily.adverbs],
      ] as [string, readonly string[] | undefined][]).filter(nonEmpty)
    : [];
  const wordNetParts = candidate.wordNet
    ? ([
        ['synset', candidate.wordNet.synset],
        ['hypernyms', candidate.wordNet.hypernyms],
      ] as [string, readonly string[] | undefined][]).filter(nonEmpty)
    : [];
  if (relatedGroups.length === 0 && wordFamilyParts.length === 0 && wordNetParts.length === 0
    && !candidate.derivedTerms?.length) {
    return null;
  }
  return (
    <section className={styles.cellMeta} data-cell-id="dictionary-meta">
      {wordFamilyParts.length > 0 && (
        <div className={styles.cellMetaLine}>
          <span className={styles.cellMetaLabel}>word family:</span>{' '}
          {wordFamilyParts.map(([pos, forms]) => `${pos} ${forms.join(', ')}`).join(' · ')}
        </div>
      )}
      {wordNetParts.map(([label, terms]) => (
        <div key={label} className={styles.cellMetaLine}>
          <span className={styles.cellMetaLabel}>{label}:</span> {terms.join(', ')}
        </div>
      ))}
      {candidate.derivedTerms && candidate.derivedTerms.length > 0 && (
        <div className={styles.cellMetaLine}>
          <span className={styles.cellMetaLabel}>derived terms:</span> {candidate.derivedTerms.join(', ')}
        </div>
      )}
      {relatedGroups.map(([kind, items]) => (
        <div key={kind} className={styles.cellMetaLine}>
          <span className={styles.cellMetaLabel}>{relatedKindLabel(kind)}:</span>{' '}
          {items.map((r, i) => (
            <span key={r.term}>
              {i > 0 && ', '}
              <span
                className={styles.cellRelatedLink}
                title={r.preview}
                data-allow-lookup
                data-lookup-term={r.term}
                data-cell-id={`dictionary-related-${r.term}`}
              >
                {r.term}
              </span>
            </span>
          ))}
        </div>
      ))}
    </section>
  );
}

function SenseLineView({
  line,
  revealedByDefault,
  head,
}: {
  readonly line: SenseLine;
  readonly revealedByDefault: boolean;
  readonly head?: string;
}): React.JSX.Element {
  const [override, setOverride] = useState<boolean | null>(null);
  const revealed = override ?? revealedByDefault;
  const showTranslation = Boolean(line.translation) && revealed;
  return (
    <span className={styles.defLine} data-role={line.role}>
      <span className={styles.defLineMain}>
        {head ? <span className={styles.defLineHead}>{head} </span> : null}
        {line.text}
        {line.pattern ? <span className={styles.defLineMeta}> {line.pattern}</span> : null}
        {line.translation ? (
          <button
            type="button"
            className={styles.defLineReveal}
            aria-expanded={revealed}
            aria-label={revealed ? t('dict.definitions.hideTranslation') : t('dict.definitions.showTranslation')}
            title={revealed ? t('dict.definitions.hideTranslation') : t('dict.definitions.showTranslation')}
            onClick={(e) => {
              e.stopPropagation();
              setOverride(!revealed);
            }}
          >
            <Icon name="chevronDown" size="sm" className={revealed ? styles.defLineRevealOpen : undefined} />
          </button>
        ) : null}
        {line.citation ? <span className={styles.defLineCitation}> — {line.citation}</span> : null}
      </span>
      {showTranslation ? (
        <span className={styles.defLineTranslation}>{line.translation}</span>
      ) : null}
    </span>
  );
}

function defHead(definition: DefinitionEntry): string | undefined {
  const parts = [
    definition.pos ? `[${definition.pos}]` : '',
    ...(definition.labels ?? []).map((l) => `[${l}]`),
    definition.level ? `[${definition.level}]` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

function DefinitionItem({
  definition,
  selected,
  checkedExamples,
  onToggle,
  onToggleExample,
  translationRevealed,
}: {
  readonly definition: DefinitionEntry;
  readonly selected: boolean;
  readonly checkedExamples: ReadonlySet<number>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onToggleExample: (defId: string, index: number, selected: boolean) => void;
  readonly translationRevealed: boolean;
}): React.JSX.Element {
  const checked = selected;
  const head = defHead(definition);
  const hasLines = Boolean(definition.lines?.length);
  const hasSubsenses = Boolean(definition.subsenses?.length);
  const headOnlyLine = !hasLines && Boolean(head) && (hasSubsenses || definition.examples.length > 0);
  const showRow = hasLines || hasSubsenses || headOnlyLine || Boolean(!definition.lines && definition.text.trim());
  return (
    <div className={styles.cellDefGroup} title={definition.source || undefined}>
      {showRow && (
      <div
        className={checkStyles.cellDefItem}
        data-cell-id="dictionary-definition"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest(`.${styles.cellDefText}`) !== null) return;
          if (window.getSelection()?.toString()) return;
          onToggle(definition.id, !checked);
        }}
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
          {definition.lines ? (
            <>
              {hasLines ? (
                definition.lines.map((l, i) => (
                  <SenseLineView
                    key={i}
                    line={l}
                    revealedByDefault={translationRevealed}
                    head={i === 0 ? head : undefined}
                  />
                ))
              ) : headOnlyLine ? (
                <SenseLineView
                  line={{ role: 'note', text: '' }}
                  revealedByDefault={translationRevealed}
                  head={head}
                />
              ) : null}
              {definition.subsenses?.map((s) => (
                <span key={s.num} className={styles.defSubsense}>{s.num}. {s.text}</span>
              ))}
              {definition.synonyms && definition.synonyms.length > 0 && (
                <span className={styles.defLine} data-role="note">Synonyms: {definition.synonyms.join(', ')}</span>
              )}
              {definition.antonyms && definition.antonyms.length > 0 && (
                <span className={styles.defLine} data-role="note">Opposite: {definition.antonyms.join(', ')}</span>
              )}
            </>
          ) : (
            definition.pos ? `[${definition.pos}] ${definition.text}` : definition.text
          )}
        </span>
      </div>
      </div>
      )}
      {definition.examples.length > 0 && (
        <div className={styles.cellDefExamples}>
          {definition.examples.map((ex, i) => {
            const exChecked = checkedExamples.has(i);
            return (
              <div
                key={i}
                className={checkStyles.cellDefExampleItem}
                data-cell-id="dictionary-example"
                role="checkbox"
                aria-checked={exChecked}
                tabIndex={0}
                onClick={(e) => {
                  const el = e.target as HTMLElement;
                  if (el.closest(`.${styles.cellDefExampleText}`) !== null) return;
                  if (window.getSelection()?.toString()) return;
                  onToggleExample(definition.id, i, !exChecked);
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleExample(definition.id, i, !exChecked);
                  }
                }}
              >
                <label
                  className={`${checkStyles.cellDefCheck} ${exChecked ? checkStyles['cellDefCheck--checked'] : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className={checkStyles.cellDefCheckInput}
                    checked={exChecked}
                    onChange={(e) => onToggleExample(definition.id, i, e.target.checked)}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <span className={checkStyles.cellDefCheckBox} aria-hidden="true">
                    <Icon name="check" size="md" />
                  </span>
                </label>
                <span className={styles.cellDefExampleText}>
                  <SenseLineView line={ex} revealedByDefault={translationRevealed} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



