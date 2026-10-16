import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { onDictionaryChangedVisible, onWordStatusChanged } from '@/features/dictionary';
import { getSrsCardTermSet, invalidateSrsCardTermSet, onSrsCardsChanged } from '@/features/srs';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  applyTokenListCardFlags,
  applyTokenListStatus,
  bindTokenBlock,
  createTokenList,
  restyleTokenBlock,
  resolveTokenListMetadata,
  unbindTokenBlock,
} from '@/features/tokenize';
import type { Token, TokenBlock, TokenSpanBindOptions } from '@/features/tokenize';
import type { AnnotationDisplayMode } from '@/entities/settings';
import styles from './PreviewBlock.module.css';

export interface PreviewBlockProps {
  readonly targetWord: string;
  readonly sentence: string;
  readonly langCode?: string;
  readonly onTokenClick?: (term: string, contextSentence: string) => void;
  readonly dataId?: string;
  /** Profile `readingDisplay`. Undefined → loaded from settings once. */
  readonly readingDisplay?: AnnotationDisplayMode;
}

export function PreviewBlock({
  targetWord,
  sentence,
  langCode = 'en',
  onTokenClick,
  dataId,
  readingDisplay: readingDisplayProp,
}: PreviewBlockProps): ReactElement {
  const baseTokens = useMemo(() => createTokenList(sentence, langCode), [sentence, langCode]);
  const [tokens, setTokens] = useState<readonly Token[]>(baseTokens);
  const [resolving, setResolving] = useState(false);
  const [loadedReadingDisplay, setLoadedReadingDisplay] = useState<AnnotationDisplayMode>('off');
  const readingDisplay = readingDisplayProp ?? loadedReadingDisplay;
  // Dictionary-changed bumps re-run resolution so caps/bands refresh.
  const [dictEpoch, setDictEpoch] = useState(0);

  useEffect(() => {
    if (readingDisplayProp !== undefined) return;
    let active = true;
    void loadSettings()
      .then((settings) => { if (active) setLoadedReadingDisplay(settings.readingDisplay); })
      .catch(() => {});
    return () => { active = false; };
  }, [readingDisplayProp]);

  useEffect(() => {
    setTokens(baseTokens);
    setResolving(true);
    let active = true;
    void resolveTokenListMetadata(baseTokens, langCode, { includeReadings: readingDisplay !== 'off' }).then((resolved) => {
      if (!active) return;
      setResolving(false);
      setTokens(resolved);
    });
    const unsubscribe = onWordStatusChanged((detail) => {
      if (detail.langCode !== langCode) return;
      setTokens((current) => applyTokenListStatus(current, detail.term, detail.status));
    });
    const unsubscribeCards = onSrsCardsChanged((changed) => {
      if (changed !== langCode) return;
      invalidateSrsCardTermSet(changed);
      void getSrsCardTermSet(changed)
        .then((cardTerms) => {
          setTokens((current) => applyTokenListCardFlags(current, cardTerms));
        })
        .catch(() => {});
    });
    return () => {
      active = false;
      unsubscribe();
      unsubscribeCards();
    };
  }, [baseTokens, langCode, readingDisplay, dictEpoch]);

  useEffect(() => {
    return onDictionaryChangedVisible(({ langCode: changed }) => {
      if (changed && changed !== langCode) return;
      setDictEpoch((n) => n + 1);
    });
  }, [langCode]);

  const targetTerms = useMemo(
    () => targetWord.toLowerCase().trim().split(/\s+/).filter((term) => term.length > 0),
    [targetWord],
  );

  const sentenceRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<TokenBlock | null>(null);
  const clickRef = useRef(onTokenClick);
  clickRef.current = onTokenClick;

  // Render the sentence through the canonical tokenize binder so the preview
  // shares markup + class logic with web tokenize (SSOT). Status/metadata
  // updates restyle in place; a new sentence rebuilds the block.
  useEffect(() => {
    const el = sentenceRef.current;
    if (!el) return;
    const options: TokenSpanBindOptions = {
      showStatus: true,
      showFrequency: false,
      readingDisplay,
      glossDisplay: 'off',
      onTokenClick: (term) => clickRef.current?.(term, sentence),
    };
    let block = blockRef.current;
    if (block && block.originalText !== sentence) {
      if (block.isBound) unbindTokenBlock(block);
      block = null;
      blockRef.current = null;
    }
    if (!block) {
      el.replaceChildren(document.createTextNode(sentence));
      const sourceNode = el.firstChild;
      if (!(sourceNode instanceof Text)) return;
      block = {
        id: 'cc-preview',
        element: el,
        sourceNodes: [sourceNode],
        originalText: sentence,
        tokens: [...tokens],
        isBound: false,
        lastAccessedAt: Date.now(),
      };
      blockRef.current = block;
    } else {
      block.tokens = [...tokens];
    }
    if (block.isBound && !restyleTokenBlock(block, options)) unbindTokenBlock(block);
    if (!block.isBound) bindTokenBlock(block, options);
    markTargetTokens(el, tokens, targetTerms);
    for (const span of el.querySelectorAll('.js-Tihoka-token--word')) {
      span.classList.toggle('js-Tihoka-token--resolving', resolving);
    }
  }, [tokens, sentence, langCode, readingDisplay, targetTerms, resolving]);

  return (
    <div
      className={styles['cc-preview']}
      aria-label={t('cardCreator.preview.aria')}
      role="region"
      data-tihoka-id={dataId}
      data-allow-tokenize
      data-allow-lookup
    >
      <div className={styles['cc-preview__target']}>{targetWord}</div>
      <div className={styles['cc-preview__sentence']} ref={sentenceRef} />
    </div>
  );
}

function matchesTargetPhrase(
  tokens: readonly Token[],
  startIndex: number,
  targetTerms: readonly string[],
): boolean {
  for (let i = 0; i < targetTerms.length; i += 1) {
    const token = tokens[startIndex + i];
    if (token?.term !== targetTerms[i]) return false;
  }
  return true;
}

/** The binder has no target-phrase concept — tag matching word spans with the
 *  preview's emphasis class after every (re)bind/restyle. */
function markTargetTokens(
  container: HTMLElement,
  tokens: readonly Token[],
  targetTerms: readonly string[],
): void {
  if (targetTerms.length === 0) return;
  const words = tokens.filter((token) => !token.isSeparator);
  for (let i = 0; i + targetTerms.length <= words.length; i += 1) {
    if (!matchesTargetPhrase(words, i, targetTerms)) continue;
    for (const token of words.slice(i, i + targetTerms.length)) {
      container
        .querySelector(`.js-Tihoka-token--word[data-tihoka-start="${token.start}"]`)
        ?.classList.add(styles['cc-preview__target-word']);
    }
    i += targetTerms.length - 1;
  }
}
