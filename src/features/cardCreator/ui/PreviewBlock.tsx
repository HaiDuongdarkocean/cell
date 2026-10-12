import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { onDictionaryChangedVisible, onWordStatusChanged } from '@/features/dictionary';
import { getSrsCardTermSet, invalidateSrsCardTermSet, onSrsCardsChanged } from '@/features/srs';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  applyTokenListCardFlags,
  applyTokenListStatus,
  createTokenList,
  resolveTokenListMetadata,
} from '@/features/tokenize';
import type { Token } from '@/features/tokenize';
import styles from './PreviewBlock.module.css';

export interface PreviewBlockProps {
  readonly targetWord: string;
  readonly sentence: string;
  readonly langCode?: string;
  readonly onTokenClick?: (term: string, contextSentence: string) => void;
  readonly dataId?: string;
  /** Profile `showReadings`. Undefined → loaded from settings once. */
  readonly showReadings?: boolean;
}

export function PreviewBlock({
  targetWord,
  sentence,
  langCode = 'en',
  onTokenClick,
  dataId,
  showReadings: showReadingsProp,
}: PreviewBlockProps): ReactElement {
  const baseTokens = useMemo(() => createTokenList(sentence, langCode), [sentence, langCode]);
  const [tokens, setTokens] = useState<readonly Token[]>(baseTokens);
  const [resolving, setResolving] = useState(false);
  const [loadedShowReadings, setLoadedShowReadings] = useState(false);
  const showReadings = showReadingsProp ?? loadedShowReadings;
  // Dictionary-changed bumps re-run resolution so caps/bands refresh.
  const [dictEpoch, setDictEpoch] = useState(0);

  useEffect(() => {
    if (showReadingsProp !== undefined) return;
    let active = true;
    void loadSettings()
      .then((settings) => { if (active) setLoadedShowReadings(settings.showReadings); })
      .catch(() => {});
    return () => { active = false; };
  }, [showReadingsProp]);

  useEffect(() => {
    setTokens(baseTokens);
    setResolving(true);
    let active = true;
    void resolveTokenListMetadata(baseTokens, langCode, { includeReadings: showReadings }).then((resolved) => {
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
  }, [baseTokens, langCode, showReadings, dictEpoch]);

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

  const tokenSpans = buildTokenSpans(tokens, targetTerms, sentence, onTokenClick, resolving, showReadings);

  return (
    <div
      className={styles['cc-preview']}
      aria-label={t('cardCreator.preview.aria')}
      role="region"
      data-cell-id={dataId}
      data-allow-tokenize
      data-allow-lookup
    >
      <div className={styles['cc-preview__target']}>{targetWord}</div>
      <div className={styles['cc-preview__sentence']}>{tokenSpans}</div>
    </div>
  );
}

function tokenClassName(token: Token, resolving: boolean, showReadings: boolean): string {
  return [
    'js-cell-token',
    'js-cell-token--word',
    resolving ? 'js-cell-token--resolving' : '',
    `js-cell-token--status-${token.status ?? 'unknown'}`,
    token.frequencyBand && token.frequencyBand !== 'none'
      ? `js-cell-token--frequency-${token.frequencyBand}`
      : '',
    token.hasCard ? 'js-cell-token--has-card' : '',
    showReadings ? '' : 'js-cell-token--reading-off',
    // Glosses are subtitle-overlay only (spec word-translation).
    'js-cell-token--gloss-off',
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
  showReadings: boolean,
): React.ReactNode[] {
  const gapClass = `js-cell-token js-cell-token--separator ${styles['cc-preview__gap']}`;
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
      for (const phraseToken of phraseTokens) {
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
            className={tokenClassName(phraseToken, resolving, showReadings)}
            showReading={showReadings}
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
        className={tokenClassName(token, resolving, showReadings)}
        showReading={showReadings}
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
      data-cell-term={token.term}
      data-cell-start={token.start}
      data-cell-end={token.end}
      data-reading={showReading ? token.reading : undefined}
      onClick={onTokenClick ? () => onTokenClick(token.term, sentence) : undefined}
    >
      <span className="js-cell-token-word">{token.text}</span>
      <span className="js-cell-token-status" aria-hidden="true" />
    </span>
  );
}
