import { useState, useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { rankToBand, DEFAULT_BAND_THRESHOLDS, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { usePronunciation } from '@/features/pronunciation';
import { useAudioItemUrl } from '@/features/pronunciation';
import { PronunciationPanel } from '@/features/pronunciation';
import type { AudioEngineKind } from '@/features/pronunciation';
import { nextStatus } from '@/features/dictionary';
import { t, type MessageKey } from '@/shared/i18n';
import { useCandidate } from './useCandidate';
import { PosVariantNav } from './PosVariantNav';
import { PronunciationAudioPanel } from './PronunciationAudioPanel';
import { ImagePanel } from './ImagePanel';
import { TranslatePanel } from './TranslatePanel';
import { LinksPanel } from './LinksPanel';
import { DictionaryToolbar } from './DictionaryToolbar';
import { useDragScroll } from '@/shared/ui/useDragScroll';
import { Tooltip } from '@/shared/ui/Tooltip';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './CandidateView.module.css';
import { makeSubsenseId } from '../logic/definitionSelection';
import type { LookupResult, DefinitionEntry, SubsenseBlock, RelationGroup, WordStatus, PopupCardCreatorPrefill, PopupTab, AudioItem, AudioSourceKind, PopupSelectionSnapshot, SenseLine, RelatedEntry, VariantFrequency } from '@/entities/dictionary';

const EMPTY_EXAMPLE_SET: ReadonlySet<number> = new Set<number>();

const STATUS_KEYS: Record<WordStatus, MessageKey> = {
  unknown: 'vocabulary.status.unknown',
  tracking: 'vocabulary.status.tracking',
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

// ponytail: Firefox lacks ShadowRoot.getSelection — falls back to window.getSelection(), at worst vacuous (selection-guard off)
function selectionText(el: HTMLElement): string {
  const root = el.getRootNode();
  const sel =
    root instanceof ShadowRoot
      ? (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.()
      : window.getSelection();
  return sel?.toString() ?? '';
}

function freqTitle(freq: VariantFrequency): string | undefined {
  const parts: string[] = [];
  if (freq.total != null) parts.push(`total ${freq.total.toLocaleString()}`);
  if (freq.genres) {
    const g = freq.genres;
    for (const [k, v] of [['spoken', g.spoken], ['fiction', g.fiction], ['magazine', g.magazine], ['newspaper', g.newspaper], ['academic', g.academic]] as const) {
      if (v != null) parts.push(`${k} ${v.toLocaleString()}`);
    }
  }
  return parts.length ? parts.join(' · ') : undefined;
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

  const freqScrollRef = useDragScroll<HTMLDivElement>();
  const wordRowRef = useRef<HTMLDivElement | null>(null);
  const [termTruncated, setTermTruncated] = useState(false);

  useEffect(() => {
    const row = wordRowRef.current;
    if (!row) return;
    const check = (): void => {
      const el = row.querySelector<HTMLElement>('[data-cell-id="dictionary-term"]');
      if (el) setTermTruncated(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(row);
    return () => ro.disconnect();
  }, [candidate.term]);

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

  return (
    <article
      className={styles.candidate}
      data-cell-id={`dictionary-candidate-${index}`}
    >
      {candidate.variants && candidate.variants.length > 1 && (
        <PosVariantNav
          variants={candidate.variants}
          selectedIndex={panel.variantIndex}
          onSelect={panel.selectVariant}
        />
      )}
      <header className={styles.cellHeader} data-cell-id="dictionary-header">
        <div className={styles.cellHeaderRow}>
          <div className={styles.cellHeaderMain}>
            <div className={styles.cellHeaderWordRow} ref={wordRowRef}>
              {termTruncated ? (
                <Tooltip content={candidate.term} placement="bottom" activateOnClick className={styles.cellHeaderWordTooltip}>
                  <Heading level={2} size={2} className={styles.cellHeaderWord} data-cell-id="dictionary-term">{candidate.term}</Heading>
                </Tooltip>
              ) : (
                <Heading level={2} size={2} className={styles.cellHeaderWord} data-cell-id="dictionary-term">{candidate.term}</Heading>
              )}
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
        {(panel.displayReading || candidate.level) && (
          <div className={styles.cellHeaderReading}>
            {panel.variant && panel.variant.prons.length > 0 && (
              <button
                type="button"
                className={styles.cellAccentLabel}
                disabled={panel.variant.prons.length < 2}
                title={panel.variant.prons.length > 1 ? t('dict.accent.toggle', [panel.variant.prons[panel.accentIndex]?.accent ?? '']) : undefined}
                onClick={panel.cycleAccent}
                data-cell-id="dictionary-accent-toggle"
              >
                {panel.variant.prons[panel.accentIndex]?.accent ?? ''}
              </button>
            )}
            {panel.displayReading && (
              <span className={styles.cellHeaderIpa} data-cell-id="dictionary-reading">
                {formatReading(panel.displayReading, candidate.readingKind)}
              </span>
            )}
            {candidate.level && (
              <span className={styles.cellHeaderLevel} data-cell-id="dictionary-level">[{candidate.level}]</span>
            )}
          </div>
        )}
        <div className={styles.cellHeaderSecond} ref={freqScrollRef} data-cell-id="dictionary-freq-row">
          <Button
            variant="transparent"
            className={`${styles.cellHeaderStatus} ${styles[`cellHeaderStatus--${panel.status}`]}`}
            onClick={panel.cycleStatus}
            title={t('dict.status.cycle', [t(STATUS_KEYS[panel.status]), t(STATUS_KEYS[nextStatus(panel.status)])])}
            data-cell-id="dictionary-status-cycle"
          >
            {t(STATUS_KEYS[panel.status])}
          </Button>
          {panel.displayFrequencies.map((freq, i) => (
            <span key={`${freq.source}-${i}`} className={`${styles.cellHeaderFrequency} ${styles[`cellHeaderFrequency--${rankToBand(freq.rank, frequencyThresholds)}`]}`} title={freqTitle(freq)} data-cell-id="dictionary-frequency">
              <span className={styles.cellHeaderFrequencySource}>{freq.source}</span>
              <span className={styles.cellHeaderFrequencyRank}>{freq.rank.toLocaleString()}</span>
            </span>
          ))}
          {panel.displayStars && (
            <span className={styles.cellHeaderFrequency} title={t('resources.component.frequencyStars')} data-cell-id="dictionary-stars">
              <span className={styles.cellHeaderFrequencySource}>{panel.displayStars.source}</span>
              <span className={styles.cellHeaderFrequencyRank}>{'★'.repeat(panel.displayStars.count)}</span>
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
            autoplayCount={index === 0 ? panel.autoplayCount : 0}
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
            term={panel.imageQueryTerm}
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

        {panel.displayInflections && panel.displayInflections.length > 0 && (
          <div className={styles.cellMetaLine} data-cell-id="dictionary-word-forms">
            <span className={styles.cellMetaLabel}>{t('dict.meta.wordForms')}:</span>{' '}
            {panel.displayInflections.map((g, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {g.type && <span className={styles.cellMetaLabel}>{g.type} </span>}
                {g.forms.join(', ')}
              </span>
            ))}
          </div>
        )}

        <section className={panelStyles.cellDef} aria-label={t('dict.definitions.aria')} data-cell-id="dictionary-definitions" data-allow-lookup>
        {panel.displayDefinitions.length === 0 ? (
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
          panel.displayDefinitions.map((def) => (
            <DefinitionItem
              key={def.id}
              definition={def}
              selected={panel.definitionSelection.get(def.id) === true}
              checkedExamples={panel.exampleSelection.get(def.id) ?? EMPTY_EXAMPLE_SET}
              definitionSelection={panel.definitionSelection}
              exampleSelection={panel.exampleSelection}
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

const RELATED_KIND_LABELS: Record<string, MessageKey> = {
  phrasal: 'dict.meta.related.phrasal',
  'see-also': 'dict.meta.related.seeAlso',
  idiom: 'dict.meta.related.idiom',
  collocation: 'dict.meta.related.collocation',
  expression: 'dict.meta.related.expression',
  lemma: 'dict.meta.related.lemma',
  derivative: 'dict.meta.related.derivative',
  thesaurus: 'dict.meta.related.thesaurus',
};

function relatedKindLabel(kind: string): string {
  const key = RELATED_KIND_LABELS[kind];
  return key !== undefined ? t(key) : `${kind}s`;
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
        [t('dict.meta.pos.noun'), candidate.wordFamily.nouns],
        [t('dict.meta.pos.verb'), candidate.wordFamily.verbs],
        [t('dict.meta.pos.adjective'), candidate.wordFamily.adjectives],
        [t('dict.meta.pos.adverb'), candidate.wordFamily.adverbs],
      ] as [string, readonly string[] | undefined][]).filter(nonEmpty)
    : [];
  const wordNetParts = candidate.wordNet
    ? ([
        [t('dict.meta.synset'), candidate.wordNet.synset],
        [t('dict.meta.hypernyms'), candidate.wordNet.hypernyms],
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
          <span className={styles.cellMetaLabel}>{t('dict.meta.wordFamily')}:</span>{' '}
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
          <span className={styles.cellMetaLabel}>{t('dict.meta.derivedTerms')}:</span> {candidate.derivedTerms.join(', ')}
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
  hidePattern,
}: {
  readonly line: SenseLine;
  readonly revealedByDefault: boolean;
  readonly head?: string;
  readonly hidePattern?: boolean;
}): React.JSX.Element {
  const [override, setOverride] = useState<boolean | null>(null);
  const revealed = override ?? revealedByDefault;
  const showTranslation = Boolean(line.translation) && revealed;
  return (
    <span className={styles.defLine} data-role={line.role}>
      <span className={styles.defLineMain}>
        {head ? <span className={styles.defLineHead}>{head} </span> : null}
        {line.text}
        {!hidePattern && line.pattern ? <span className={styles.defLineMeta}> {line.pattern}</span> : null}
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

function ExampleRows({
  ownerId,
  examples,
  checkedExamples,
  onToggleExample,
  translationRevealed,
}: {
  readonly ownerId: string;
  readonly examples: readonly SenseLine[];
  readonly checkedExamples: ReadonlySet<number>;
  readonly onToggleExample: (ownerId: string, index: number, selected: boolean) => void;
  readonly translationRevealed: boolean;
}): React.JSX.Element | null {
  if (!examples.length) return null;
  return (
    <div className={styles.cellDefExamples}>
      {examples.map((ex, i) => {
        const exChecked = checkedExamples.has(i);
        let runStart = i;
        while (runStart > 0 && ex.pattern && examples[runStart - 1]?.pattern === ex.pattern) runStart -= 1;
        let runEnd = i;
        while (runEnd + 1 < examples.length && ex.pattern && examples[runEnd + 1]?.pattern === ex.pattern) runEnd += 1;
        const runSize = runEnd - runStart + 1;
        const patternHead = ex.pattern && i === runStart && runSize >= 2 ? ex.pattern : null;
        const inlinePattern = Boolean(ex.pattern) && runSize === 1;
        return (
          <div key={i} className={styles.exampleRun}>
            {patternHead ? (
              <div className={styles.defExamplePattern} data-cell-id="dictionary-example-pattern">
                {patternHead}
              </div>
            ) : null}
          <div
            className={checkStyles.cellDefExampleItem}
            data-cell-id="dictionary-example"
            role="checkbox"
            aria-checked={exChecked}
            tabIndex={0}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest(`.${styles.cellDefExampleText}`) !== null) return;
              if (selectionText(el)) return;
              onToggleExample(ownerId, i, !exChecked);
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onToggleExample(ownerId, i, !exChecked);
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
                onChange={(e) => onToggleExample(ownerId, i, e.target.checked)}
                tabIndex={-1}
                aria-hidden="true"
              />
              <span className={checkStyles.cellDefCheckBox} aria-hidden="true">
                <Icon name="check" size="md" />
              </span>
            </label>
            <span className={styles.cellDefExampleText}>
              <SenseLineView line={ex} revealedByDefault={translationRevealed} hidePattern={!inlinePattern} />
            </span>
          </div>
          </div>
        );
      })}
    </div>
  );
}

function RelationTail({
  synonymGroups,
  synonyms,
  antonyms,
  nested,
}: {
  readonly synonymGroups?: readonly RelationGroup[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
  readonly nested?: boolean;
}): React.JSX.Element | null {
  const groups = synonymGroups?.length
    ? synonymGroups
    : (synonyms?.length ? [{ words: synonyms }] : []);
  if (!groups.length && !antonyms?.length) return null;
  return (
    <div className={`${styles.defTail}${nested ? ` ${styles.defTailNested}` : ''}`} data-cell-id="dictionary-relations">
      {groups.map((g, i) => (
        <span key={i} className={styles.defLine} data-role="note">
          <span className={styles.defLineMeta}>synonyms and related words: </span>
          {g.label ? <span className={styles.defLineMeta}>{`${g.label}: `}</span> : null}
          {g.words.join(', ')}
        </span>
      ))}
      {antonyms?.length ? (
        <span className={styles.defLine} data-role="note">
          <span className={styles.defLineMeta}>antonyms: </span>
          {antonyms.join(', ')}
        </span>
      ) : null}
    </div>
  );
}

function SubsenseRow({
  defId,
  sub,
  index,
  definitionSelection,
  exampleSelection,
  onToggle,
  onToggleExample,
  translationRevealed,
}: {
  readonly defId: string;
  readonly sub: SubsenseBlock;
  readonly index: number;
  readonly definitionSelection: ReadonlyMap<string, boolean>;
  readonly exampleSelection: ReadonlyMap<string, ReadonlySet<number>>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onToggleExample: (ownerId: string, index: number, selected: boolean) => void;
  readonly translationRevealed: boolean;
}): React.JSX.Element {
  const subId = makeSubsenseId(defId, index);
  const checked = definitionSelection.get(subId) === true;
  return (
    <div className={styles.defSubGroup} data-cell-id="dictionary-subsense-group">
      <div
        className={checkStyles.cellDefItem}
        data-cell-id="dictionary-subsense"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest(`.${styles.cellDefText}`) !== null) return;
          if (selectionText(el)) return;
          onToggle(subId, !checked);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onToggle(subId, !checked);
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
              onChange={(e) => onToggle(subId, e.target.checked)}
              tabIndex={-1}
              aria-hidden="true"
            />
            <span className={checkStyles.cellDefCheckBox} aria-hidden="true">
              <Icon name="check" size="md" />
            </span>
          </label>
          <span className={styles.cellDefText}>
            {sub.num ? <span className={styles.defSubsenseNum}>{sub.num}. </span> : null}
            {(sub.labels ?? []).map((l) => `[${l}] `)}
            {sub.text}
          </span>
        </div>
      </div>
      <ExampleRows
        ownerId={subId}
        examples={sub.examples ?? []}
        checkedExamples={exampleSelection.get(subId) ?? EMPTY_EXAMPLE_SET}
        onToggleExample={onToggleExample}
        translationRevealed={translationRevealed}
      />
      <RelationTail synonymGroups={sub.synonymGroups} synonyms={sub.synonyms} antonyms={sub.antonyms} nested />
    </div>
  );
}

function DefinitionItem({
  definition,
  selected,
  checkedExamples,
  definitionSelection,
  exampleSelection,
  onToggle,
  onToggleExample,
  translationRevealed,
}: {
  readonly definition: DefinitionEntry;
  readonly selected: boolean;
  readonly checkedExamples: ReadonlySet<number>;
  readonly definitionSelection: ReadonlyMap<string, boolean>;
  readonly exampleSelection: ReadonlyMap<string, ReadonlySet<number>>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onToggleExample: (ownerId: string, index: number, selected: boolean) => void;
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
          if (selectionText(el)) return;
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
            </>
          ) : (
            definition.pos ? `[${definition.pos}] ${definition.text}` : definition.text
          )}
        </span>
      </div>
      </div>
      )}
      <ExampleRows
        ownerId={definition.id}
        examples={definition.examples}
        checkedExamples={checkedExamples}
        onToggleExample={onToggleExample}
        translationRevealed={translationRevealed}
      />
      <RelationTail
        synonymGroups={definition.synonymGroups}
        synonyms={definition.synonyms}
        antonyms={definition.antonyms}
      />
      {definition.subsenses?.map((sub, i) => (
        <SubsenseRow
          key={i}
          defId={definition.id}
          sub={sub}
          index={i}
          definitionSelection={definitionSelection}
          exampleSelection={exampleSelection}
          onToggle={onToggle}
          onToggleExample={onToggleExample}
          translationRevealed={translationRevealed}
        />
      ))}
    </div>
  );
}



