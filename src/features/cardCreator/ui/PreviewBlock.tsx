import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { isNotKnown, onDictionaryChangedVisible, onWordStatusChanged } from '@/features/dictionary';
import { getSrsCardTermSet, invalidateSrsCardTermSet, onSrsCardsChanged } from '@/features/srs';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  applyTokenListCardFlags,
  applyTokenListStatus,
  createTokenList,
  markedTokenIndexes,
  resolveTokenListMetadata,
} from '@/features/tokenize';
import type { AnnotationDisplayMode } from '@/entities/settings';
import type { Token } from '@/features/tokenize';
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

  const tokenSpans = buildTokenSpans(tokens, targetTerms, sentence, onTokenClick, resolving, readingDisplay);

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
      <div className={styles['cc-preview__sentence']}>{tokenSpans}</div>
    </div>
  );
}

function readingClassName(mode: AnnotationDisplayMode, token: Token, marked: boolean): string {
  switch (mode) {
    case 'always': return '';
    case 'hover': return 'js-Tihoka-token--reading-hover';
    case 'off': return 'js-Tihoka-token--reading-off';
    case 'unknown': return isNotKnown(token.status ?? 'unknown') ? '' : 'js-Tihoka-token--reading-off';
    case 'i1': return marked ? '' : 'js-Tihoka-token--reading-off';
  }
}

function tokenClassName(token: Token, resolving: boolean, readingClass: string): string {
  return [
    'js-Tihoka-token',
    'js-Tihoka-token--word',
    resolving ? 'js-Tihoka-token--resolving' : '',
    `js-Tihoka-token--status-${token.status ?? 'unknown'}`,
    token.frequencyBand && token.frequencyBand !== 'none'
      ? `js-Tihoka-token--frequency-${token.frequencyBand}`
      : '',
    token.hasCard ? 'js-Tihoka-token--has-card' : '',
    readingClass,
    // Glosses are subtitle-overlay only (spec word-translation).
    'js-Tihoka-token--gloss-off',
    styles['cc-preview__token'],
  ]
    .filter(Boolean)
    .join(' ');
}

function buildTokenSpans(
  tokens: readonly Token[],
  targetTerms: readonly string[],
  sentence: string,
  onTokenClick: ((term: string, contextSentence: string) => void) | undefined,
  resolving: boolean,
  readingDisplay: AnnotationDisplayMode,
): React.ReactNode[] {
  const gapClass = `js-Tihoka-token js-Tihoka-token--separator ${styles['cc-preview__gap']}`;
  const marked = markedTokenIndexes(tokens);
  const hasReading = readingDisplay !== 'off';
  const children: React.ReactNode[] = [];
  let lastEnd = 0;
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index]!;

    if (token.isSeparator) {
      index += 1;
      continue;
    }

    if (token.start > lastEnd) {
      children.push(
        <span key={`gap-${token.start}`} className={gapClass}>
          {sentence.slice(lastEnd, token.start)}
        </span>,
      );
    }

    if (targetTerms.length > 0 && matchesTargetPhrase(tokens, index, targetTerms)) {
      const phraseTokens = tokens.slice(index, index + targetTerms.length);
      let phraseLastEnd = token.start;
      const phraseChildren: React.ReactNode[] = [];
      for (let pi = 0; pi < phraseTokens.length; pi += 1) {
        const phraseToken = phraseTokens[pi]!;
        if (phraseToken.start > phraseLastEnd) {
          phraseChildren.push(
            <span key={`phrasegap-${phraseToken.start}`} className={gapClass}>
              {sentence.slice(phraseLastEnd, phraseToken.start)}
            </span>,
          );
        }
        phraseChildren.push(
          <TokenSpan
            key={phraseToken.start}
            token={phraseToken}
            sentence={sentence}
            onTokenClick={onTokenClick}
            className={tokenClassName(phraseToken, resolving, readingClassName(readingDisplay, phraseToken, marked.has(index + pi)))}
            showReading={hasReading}
          />,
        );
        phraseLastEnd = phraseToken.end;
      }
      children.push(
        <strong key={`target-${token.start}`} className={styles['cc-preview__target-word']}>
          {phraseChildren}
        </strong>,
      );
      lastEnd = phraseLastEnd;
      index += targetTerms.length;
      continue;
    }

    children.push(
      <TokenSpan
        key={token.start}
        token={token}
        sentence={sentence}
        onTokenClick={onTokenClick}
        className={tokenClassName(token, resolving, readingClassName(readingDisplay, token, marked.has(index)))}
        showReading={hasReading}
      />,
    );
    lastEnd = token.end;
    index += 1;
  }

  if (lastEnd < sentence.length) {
    children.push(
      <span key="tail" className={gapClass}>
        {sentence.slice(lastEnd)}
      </span>,
    );
  }

  return children;
}

function matchesTargetPhrase(
  tokens: readonly Token[],
  startIndex: number,
  targetTerms: readonly string[],
): boolean {
  if (startIndex + targetTerms.length > tokens.length) return false;
  for (let i = 0; i < targetTerms.length; i += 1) {
    const token = tokens[startIndex + i];
    if (token?.term !== targetTerms[i]) return false;
  }
  return true;
}

interface TokenSpanProps {
  readonly token: Token;
  readonly sentence: string;
  readonly onTokenClick: ((term: string, contextSentence: string) => void) | undefined;
  readonly className: string;
  readonly showReading: boolean;
}

function TokenSpan({ token, sentence, onTokenClick, className, showReading }: TokenSpanProps): React.JSX.Element {
  return (
    <span
      className={className}
      data-tihoka-term={token.term}
      data-tihoka-start={token.start}
      data-tihoka-end={token.end}
      data-reading={showReading ? token.reading : undefined}
      onClick={onTokenClick ? () => onTokenClick(token.term, sentence) : undefined}
    >
      <span className="js-Tihoka-token-word">{token.text}</span>
      <span className="js-Tihoka-token-status" aria-hidden="true" />
    </span>
  );
}
