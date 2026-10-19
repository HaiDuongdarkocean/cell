import { useState, useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { CollapsibleLine } from '@/shared/ui/CollapsibleLine';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { usePronunciation } from '@/features/pronunciation';
import { supportsEspeakIpa } from '@/features/pronunciation';
import { PhonemeList, normalizeAccent, parseIPA } from '@/features/pronunciation';
import { t, type MessageKey } from '@/shared/i18n';
import { openSrsStudyPage } from '@/features/srs';
import { useCandidate } from './useCandidate';
import { StatusRow } from './StatusRow';
import { PosVariantNav } from './PosVariantNav';
import { PronunciationAudioPanel } from './PronunciationAudioPanel';
import { ImagePanel } from './ImagePanel';
import { TranslatePanel } from './TranslatePanel';
import { AiAnswerPanel } from './AiAnswerPanel';
import { aiStateForFeature, type AiAnswer } from '../logic/useAiAsk';
import { parseBreakdown } from '@/features/aiBridge';
import type { AiProviderId } from '@/entities/settings';
import { LinksPanel } from './LinksPanel';
import { DictionaryToolbar } from './DictionaryToolbar';
import { Tooltip } from '@/shared/ui/Tooltip';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './CandidateView.module.css';
import { makeSubsenseId } from '../logic/definitionSelection';
import type { LookupResult, DefinitionEntry, SubsenseBlock, RelationGroup, WordStatus, PopupCardCreatorPrefill, PopupTab, PopupSelectionSnapshot, SenseLine, RelatedEntry } from '@/entities/dictionary';

const EMPTY_EXAMPLE_SET: ReadonlySet<number> = new Set<number>();
const SWIPE_MIN_PX = 56;
const SWIPE_DOMINANCE = 1.4;
const SWIPE_SLOP_PX = 10;
const SWIPE_RUBBER_PX = 80;

function rubberBand(dx: number, atEdge: boolean): number {
  const pull = Math.abs(dx) / (atEdge ? 4 : 1.6);
  return Math.sign(dx) * Math.min(pull, SWIPE_RUBBER_PX);
}

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
  /** Pushes the updated AI answer set after a send so an open card dialog can
   *  merge late blocks into the note field (spec ai-bridge-dictionary REQ-5). */
  readonly onAiNoteUpdate?: (answers: readonly AiAnswer[]) => void;
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Called from the empty-definitions state to open Settings → Resources. */
  readonly onOpenSettings?: () => void;
  /** Default media tab to open when this candidate first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** Optional popup selection snapshot used to clone checked state. */
  readonly selectionSnapshot?: PopupSelectionSnapshot;
  /** Preload media/translation in the integrated panel. */
  readonly preloadMedia?: boolean;
  /** Popup variant only: drag-to-move session started from the header row. */
  readonly onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function CandidateView({
  candidate,
  index,
  contextSentence,
  sourceLang,
  targetLang,
  onSendToCard,
  onQuickAdd,
  onAiNoteUpdate,
  onStatusChange,
  onOpenSettings,
  defaultActiveTab,
  selectionSnapshot,
  preloadMedia,
  onHeaderPointerDown,
}: CandidateViewProps): React.JSX.Element {
  const panel = useCandidate({
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
    onAiNoteUpdate,
    onStatusChange,
    defaultActiveTab,
    selectionSnapshot,
    preloadMedia,
  });

  const [pronunciationDisplay, setPronunciationDisplay] = useState<'ipa' | 'phonemes'>('phonemes');
  const langSupportsIpa = supportsEspeakIpa(candidate.langCode);
  const accentLabel = panel.variant?.prons[panel.accentIndex]?.accent;
  const phonemeLangCode =
    langSupportsIpa && normalizeAccent(accentLabel) === 'us'
      ? 'en-us'
      : candidate.langCode;
  const { pronunciation } = usePronunciation({
    term: candidate.term,
    langCode: phonemeLangCode,
    enabled: !panel.displayReading && langSupportsIpa,
  });
  // Single reading resolution — the dictionary IPA wins and eSpeak fills the
  // gap. Both render modes (IPA text, phoneme chips) derive from this string.
  const reading = panel.displayReading || pronunciation?.ipa || '';
  const readingKind = panel.displayReading ? candidate.readingKind : 'ipa';
  // Strip /…/ […] delimiters dictionaries wrap readings in.
  const phonemes = langSupportsIpa && reading ? parseIPA(reading.replace(/[/[\]]/g, '')) : [];
  const showPhonemes =
    pronunciationDisplay === 'phonemes' &&
    phonemes.some((p) => p.type !== 'separator');

  const variants = candidate.variants;
  const swipeRef = useRef<{ pointerId: number; moved: boolean; cleanup: () => void } | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const swipeDirRef = useRef<'next' | 'prev' | null>(null);

  const selectVariant = (i: number): void => {
    if (i === panel.variantIndex) return;
    swipeDirRef.current = i > panel.variantIndex ? 'next' : 'prev';
    panel.selectVariant(i);
  };

  const restArticle = (): void => {
    const article = articleRef.current;
    if (!article) return;
    article.style.transform = '';
    article.style.transition = '';
    article.style.opacity = '';
  };

  useEffect(() => {
    const el = articleRef.current;
    const dir = swipeDirRef.current;
    if (!el || !dir) return;
    restArticle();
    el.classList.remove(styles.swipeNext, styles.swipePrev);
    void el.offsetWidth;
    el.classList.add(dir === 'next' ? styles.swipeNext : styles.swipePrev);
  }, [panel.variantIndex]);

  useEffect(() => () => swipeRef.current?.cleanup(), []);

  const onSwipePointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    if ((variants?.length ?? 0) < 2 || e.button !== 0) return;
    if (e.target instanceof HTMLElement
      && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (onHeaderPointerDown
      && e.target instanceof HTMLElement
      && e.target.closest('[class*=TihokaHeaderRowDraggable]')) return;
    const article = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const scrollers: [HTMLElement, number][] = [];
    for (const node of e.nativeEvent.composedPath()) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === article) break;
      if (node.scrollWidth <= node.clientWidth) continue;
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') scrollers.push([node, node.scrollLeft]);
    }
    const snapBack = (): void => {
      article.style.transition = 'transform var(--duration-normal) var(--ease-spring)';
      article.style.transform = 'translateX(0)';
      setTimeout(restArticle, 220);
    };
    const onMove = (ev: globalThis.PointerEvent): void => {
      const sess = swipeRef.current;
      if (!sess || ev.pointerId !== sess.pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!sess.moved) {
        if (Math.abs(dx) > SWIPE_SLOP_PX && Math.abs(dx) > Math.abs(dy)) sess.moved = true;
        else return;
      }
      const last = (variants?.length ?? 1) - 1;
      const atEdge = (dx < 0 && panel.variantIndex >= last) || (dx > 0 && panel.variantIndex <= 0);
      article.style.transition = 'none';
      article.style.transform = `translateX(${rubberBand(dx, atEdge)}px)`;
    };
    const onUp = (ev: globalThis.PointerEvent): void => {
      const sess = swipeRef.current;
      if (!sess || ev.pointerId !== sess.pointerId) return;
      cleanup();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!sess.moved) return;
      const commit = Math.abs(dx) >= SWIPE_MIN_PX
        && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE
        && !scrollers.some(([el, left]) => el.scrollLeft !== left);
      const last = (variants?.length ?? 1) - 1;
      const next = Math.max(0, Math.min(panel.variantIndex + (dx < 0 ? 1 : -1), last));
      if (!commit || next === panel.variantIndex) {
        snapBack();
        return;
      }
      article.style.transition = 'transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)';
      article.style.transform = `translateX(${dx < 0 ? -60 : 60}%)`;
      article.style.opacity = '0';
      setTimeout(() => selectVariant(next), 120);
    };
    const onCancel = (): void => {
      const sess = swipeRef.current;
      cleanup();
      if (sess?.moved) snapBack();
    };
    const onTouchMove = (ev: TouchEvent): void => {
      const t = ev.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > SWIPE_SLOP_PX && Math.abs(dx) > Math.abs(dy)) ev.preventDefault();
    };
    const cleanup = (): void => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onCancel, true);
      document.removeEventListener('touchmove', onTouchMove, { capture: true });
      swipeRef.current = null;
    };
    swipeRef.current = { pointerId: e.pointerId, moved: false, cleanup };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
  };

  const wordRowRef = useRef<HTMLDivElement | null>(null);
  const [termTruncated, setTermTruncated] = useState(false);

  useEffect(() => {
    const row = wordRowRef.current;
    if (!row) return;
    const check = (): void => {
      const el = row.querySelector<HTMLElement>('[data-tihoka-id="dictionary-term"]');
      if (el) setTermTruncated(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(row);
    return () => ro.disconnect();
  }, [candidate.term]);

  const [frequencyThresholds, setFrequencyThresholds] = useState<FrequencyBandThresholds>(DEFAULT_BAND_THRESHOLDS);
  const [frequencyDisplay, setFrequencyDisplay] = useState<'stars' | 'rank'>('stars');
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
        setFrequencyDisplay(s.dictionaryPopup?.frequencyDisplay ?? 'stars');
        setPronunciationDisplay(s.dictionaryPopup?.pronunciationDisplay ?? 'phonemes');
        setTranslationRevealed(s.dictionaryPopup?.translationVisibility === 'shown');
      })
      .catch(() => { /* keep defaults */ });
    return () => { isMountedRef.current = false; };
  }, []);

  const breakdownAnswer =
    panel.aiState.feature === 'sentenceBreakdown'
      ? panel.aiState.answer
      : panel.aiAnswers.find((a) => a.feature === 'sentenceBreakdown');
  const breakdownLoading =
    panel.aiState.feature === 'sentenceBreakdown' && panel.aiState.phase === 'loading';
  const breakdownChunks = breakdownAnswer
    ? parseBreakdown(breakdownAnswer.text, breakdownLoading ? 1 : 2)
    : undefined;

  return (
    <article
      ref={articleRef}
      className={styles.candidate}
      data-tihoka-id={`dictionary-candidate-${index}`}
      onPointerDown={onSwipePointerDown}
    >
      {candidate.variants && candidate.variants.length > 1 && (
        <PosVariantNav
          variants={candidate.variants}
          selectedIndex={panel.variantIndex}
          onSelect={selectVariant}
        />
      )}
      <header className={styles.TihokaHeader} data-tihoka-id="dictionary-header">
        <div
          className={onHeaderPointerDown ? `${styles.TihokaHeaderRow} ${styles.TihokaHeaderRowDraggable}` : styles.TihokaHeaderRow}
          title={onHeaderPointerDown ? t('dict.badge.drag') : undefined}
          onPointerDown={onHeaderPointerDown}
        >
          <div className={styles.TihokaHeaderMain}>
            <div className={styles.TihokaHeaderWordRow} ref={wordRowRef}>
              {termTruncated ? (
                <Tooltip content={candidate.term} placement="bottom" activateOnClick className={styles.TihokaHeaderWordTooltip}>
                  <Heading level={2} size={2} className={styles.TihokaHeaderWord} data-tihoka-id="dictionary-term">{candidate.term}</Heading>
                </Tooltip>
              ) : (
                <Heading level={2} size={2} className={styles.TihokaHeaderWord} data-tihoka-id="dictionary-term">{candidate.term}</Heading>
              )}
            </div>
          </div>
          <div className={styles.TihokaHeaderActions}>
            {onSendToCard && (
              <Button
                shape="circle"
                size="md"
                variant="outline"
                className={styles.TihokaHeaderSend}
                aria-label={t('dict.action.sendToCard')}
                title={t('dict.action.sendToCard')}
                onClick={() => { void panel.sendToCard(); }}
                data-tihoka-id="dictionary-send-to-card"
              >
                <Icon name="pencil"  />
              </Button>
            )}
            {onQuickAdd && (
              <Button
                shape="circle"
                size="md"
                variant="primary"
                className={styles.TihokaHeaderQuickAdd}
                aria-label={t('dict.action.quickAdd')}
                title={t('dict.action.quickAdd')}
                onClick={() => { void panel.quickAdd(); }}
                data-tihoka-id="dictionary-quick-add"
              >
                <Icon name="zap"  />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className={styles.TihokaContent} data-tihoka-id="dictionary-content">
        {showPhonemes ? (
          <PhonemeList phonemes={phonemes} language={phonemeLangCode} accent={accentLabel} align="start" />
        ) : (
          reading && (
            <CollapsibleLine
              dataTihokaId="dictionary-reading"
              className={styles.TihokaHeaderIpaWrap}
              contentClassName={styles.TihokaHeaderIpa}
            >
              {formatReading(reading, readingKind)}
            </CollapsibleLine>
          )
        )}
        {candidate.level && (
          <div className={styles.TihokaHeaderReading}>
            <span className={styles.TihokaHeaderLevel} data-tihoka-id="dictionary-level">[{candidate.level}]</span>
          </div>
        )}
        <StatusRow
          status={panel.status}
          onCycle={panel.cycleStatus}
          onToggleTracking={panel.toggleTracking}
          srsCardCount={panel.srsCardCount}
          onOpenSrsCards={() => { void openSrsStudyPage({ term: candidate.term }); }}
          frequencies={panel.displayFrequencies}
          stars={panel.displayStars}
          thresholds={frequencyThresholds}
          frequencyDisplay={frequencyDisplay}
        />

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

        {/* key=activeTab remounts on tab switch so .TihokaTabContent replays
           its entrance — panels animate in instead of teleporting. */}
        {panel.activeTab && (
        <div key={panel.activeTab} className={styles.TihokaTabContent}>
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
            loading={panel.isTranslating || (panel.translateEngine === 'ai' && panel.aiState.phase === 'loading' && panel.aiState.feature === 'sentenceTranslate')}
            selected={panel.translationSelected}
            onToggle={panel.toggleTranslation}
            onTranslate={() => { void panel.translate(); }}
            onRetry={() => { void panel.translate(true); }}
            aiStreamText={panel.translateEngine === 'ai' && panel.aiState.feature === 'sentenceTranslate' && panel.aiState.phase === 'loading'
              ? panel.aiState.answer?.text
              : undefined}
            engine={panel.translationSource ?? panel.translateEngine}
            aiProviderLabel={(panel.translationSource ?? panel.translateEngine) === 'ai'
              ? t(`dict.ai.provider.${panel.aiState.feature === 'sentenceTranslate' && panel.aiState.provider ? panel.aiState.provider : (panel.aiAnswers.find((a) => a.feature === 'sentenceTranslate')?.provider ?? 'chatgpt')}`)
              : undefined}
            sourceMenu={{
              providerOrder: panel.aiProviders,
              activeSource: panel.translateEngine === 'ai'
                ? (panel.aiPicks.sentenceTranslate ?? panel.aiProviders[0] ?? 'chatgpt')
                : 'google',
              onPickSource: panel.pickTranslateSource,
            }}
          />
        )}
        {panel.activeTab === 'ai' && (
          <AiAnswerPanel
            state={aiStateForFeature(panel.aiState, panel.aiAnswers, 'wordExplain')}
            providerOrder={panel.aiProviders}
            selectedProvider={panel.aiPicks.wordExplain ?? panel.aiProviders[0] ?? 'chatgpt'}
            answerLanguage={panel.aiLanguage}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onPickProvider={(p: AiProviderId) => {
              panel.pickAiProvider('wordExplain', p);
              panel.askAi('wordExplain');
            }}
            onPickLanguage={(lang) => {
              panel.pickAiLanguage(lang);
              panel.askAi('wordExplain', true);
            }}
            onRetry={() => panel.askAi('wordExplain', true)}
            checked={panel.checkedAiFeatures.has('wordExplain')}
            onToggle={() => panel.toggleAiFeature('wordExplain')}
          />
        )}
        {panel.activeTab === 'breakdown' && (
          <AiAnswerPanel
            state={aiStateForFeature(panel.aiState, panel.aiAnswers, 'sentenceBreakdown')}
            providerOrder={panel.aiProviders}
            selectedProvider={panel.aiPicks.sentenceBreakdown ?? panel.aiProviders[0] ?? 'chatgpt'}
            answerLanguage={panel.aiLanguage}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onPickProvider={(p: AiProviderId) => {
              panel.pickAiProvider('sentenceBreakdown', p);
              panel.askAi('sentenceBreakdown');
            }}
            onPickLanguage={(lang) => {
              panel.pickAiLanguage(lang);
              panel.askAi('sentenceBreakdown', true);
            }}
            onRetry={() => panel.askAi('sentenceBreakdown', true)}
            chunks={breakdownChunks}
            checkedChunks={panel.checkedChunks}
            onToggleChunk={panel.toggleChunk}
          />
        )}
        {panel.activeTab === 'links' && <LinksPanel links={panel.links} />}
        </div>
        )}

        {panel.displayInflections && panel.displayInflections.length > 0 && (
          <div className={styles.TihokaMetaLine} data-tihoka-id="dictionary-word-forms">
            <span className={styles.TihokaMetaLabel}>{t('dict.meta.wordForms')}:</span>{' '}
            {panel.displayInflections.map((g, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {g.type && <span className={styles.TihokaMetaLabel}>{g.type} </span>}
                {g.forms.join(', ')}
              </span>
            ))}
          </div>
        )}

        <section className={panelStyles.TihokaDef} aria-label={t('dict.definitions.aria')} data-tihoka-id="dictionary-definitions" data-allow-lookup>
        {panel.displayDefinitions.length === 0 ? (
          <EmptyState
            size="md"
            description={onOpenSettings ? (
              <>
                {t('dict.definitions.empty')}{' '}
                <Button
                  variant="unstyled"
                  className={styles.TihokaEmptyLink}
                  onClick={onOpenSettings}
                  data-tihoka-id="dictionary-import-dictionary"
                  data-compact-hit
                >
                  {t('dict.definitions.import')}
                </Button>
              </>
            ) : t('dict.definitions.emptyHint')}
            data-tihoka-id="dictionary-definitions-empty"
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
    <section className={styles.TihokaMeta} data-tihoka-id="dictionary-meta">
      {wordFamilyParts.length > 0 && (
        <div className={styles.TihokaMetaLine}>
          <span className={styles.TihokaMetaLabel}>{t('dict.meta.wordFamily')}:</span>{' '}
          {wordFamilyParts.map(([pos, forms]) => `${pos} ${forms.join(', ')}`).join(' · ')}
        </div>
      )}
      {wordNetParts.map(([label, terms]) => (
        <div key={label} className={styles.TihokaMetaLine}>
          <span className={styles.TihokaMetaLabel}>{label}:</span> {terms.join(', ')}
        </div>
      ))}
      {candidate.derivedTerms && candidate.derivedTerms.length > 0 && (
        <div className={styles.TihokaMetaLine}>
          <span className={styles.TihokaMetaLabel}>{t('dict.meta.derivedTerms')}:</span> {candidate.derivedTerms.join(', ')}
        </div>
      )}
      {relatedGroups.map(([kind, items]) => (
        <div key={kind} className={styles.TihokaMetaLine}>
          <span className={styles.TihokaMetaLabel}>{relatedKindLabel(kind)}:</span>{' '}
          {items.map((r, i) => (
            <span key={r.term}>
              {i > 0 && ', '}
              <span
                className={styles.TihokaRelatedLink}
                title={r.preview}
                data-allow-lookup
                data-lookup-term={r.term}
                data-tihoka-id={`dictionary-related-${r.term}`}
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
          <Button
            variant="unstyled"
            className={styles.defLineReveal}
            aria-expanded={revealed}
            aria-label={revealed ? t('dict.definitions.hideTranslation') : t('dict.definitions.showTranslation')}
            title={revealed ? t('dict.definitions.hideTranslation') : t('dict.definitions.showTranslation')}
            data-compact-hit
            onClick={(e) => {
              e.stopPropagation();
              setOverride(!revealed);
            }}
          >
            <Icon name="chevronDown" size="sm" className={revealed ? styles.defLineRevealOpen : undefined} />
          </Button>
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
    <div className={styles.TihokaDefExamples}>
      {examples.map((ex, i) => {
        const exChecked = checkedExamples.has(i);
        return (
          <div
            key={i}
            className={checkStyles.TihokaDefExampleItem}
            data-tihoka-id="dictionary-example"
            role="checkbox"
            aria-checked={exChecked}
            tabIndex={0}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest(`.${styles.TihokaDefExampleText}`) !== null) return;
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
            <span
              className={`${checkStyles.TihokaDefCheck} ${exChecked ? checkStyles['TihokaDefCheck--checked'] : ''}`}
            >
              <span className={checkStyles.TihokaDefCheckBox} aria-hidden="true">
                <Icon name="check" size="md" />
              </span>
            </span>
            <span className={styles.TihokaDefExampleText}>
              <SenseLineView line={ex} revealedByDefault={translationRevealed} />
            </span>
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
}: {
  readonly synonymGroups?: readonly RelationGroup[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
}): React.JSX.Element | null {
  const groups = synonymGroups?.length
    ? synonymGroups
    : (synonyms?.length ? [{ words: synonyms }] : []);
  if (!groups.length && !antonyms?.length) return null;
  return (
    <div className={styles.defTail} data-tihoka-id="dictionary-relations">
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
    <div className={styles.defSubGroup} data-tihoka-id="dictionary-subsense-group">
      <div
        className={checkStyles.TihokaDefItem}
        data-tihoka-id="dictionary-subsense"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest(`.${styles.TihokaDefText}`) !== null) return;
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
        <div className={styles.TihokaDefRow}>
          <span
            className={`${checkStyles.TihokaDefCheck} ${checked ? checkStyles['TihokaDefCheck--checked'] : ''}`}
          >
            <span className={checkStyles.TihokaDefCheckBox} aria-hidden="true">
              <Icon name="check" size="md" />
            </span>
          </span>
          <span className={styles.TihokaDefText}>
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
      <RelationTail synonymGroups={sub.synonymGroups} synonyms={sub.synonyms} antonyms={sub.antonyms} />
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
    <div className={styles.TihokaDefGroup} title={definition.source || undefined}>
      {showRow && (
      <div
        className={checkStyles.TihokaDefItem}
        data-tihoka-id="dictionary-definition"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest(`.${styles.TihokaDefText}`) !== null) return;
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
      <div className={styles.TihokaDefRow}>
        <span
          className={`${checkStyles.TihokaDefCheck} ${checked ? checkStyles['TihokaDefCheck--checked'] : ''}`}
        >
          <span className={checkStyles.TihokaDefCheckBox} aria-hidden="true">
            <Icon name="check" size="md" />
          </span>
        </span>
        <span className={styles.TihokaDefText}>
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



