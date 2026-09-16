import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { onWordStatusChanged } from '@/features/dictionary/services/wordStatusEvents';
import {
  applyTokenListStatus,
  createTokenList,
  resolveTokenListMetadata,
} from '@/features/tokenize/logic/tokenListMetadata';
import type { Token } from '@/features/tokenize/types';
import styles from './PreviewBlock.module.css';

export interface PreviewBlockProps {
  readonly targetWord: string;
  readonly sentence: string;
  readonly langCode?: string;
  readonly onTokenClick?: (term: string, contextSentence: string) => void;
  readonly dataId?: string;
}

export function PreviewBlock({
  targetWord,
  sentence,
  langCode = 'en',
  onTokenClick,
  dataId,
}: PreviewBlockProps): ReactElement {
  const baseTokens = useMemo(() => createTokenList(sentence, langCode), [sentence, langCode]);
  const [tokens, setTokens] = useState<readonly Token[]>(baseTokens);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setTokens(baseTokens);
    setResolving(true);
    let active = true;
    void resolveTokenListMetadata(baseTokens, langCode).then((resolved) => {
      if (!active) return;
      setResolving(false);
      setTokens(resolved);
    });
    const unsubscribe = onWordStatusChanged((detail) => {
      if (detail.langCode !== langCode) return;
      setTokens((current) => applyTokenListStatus(current, detail.term, detail.status));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [baseTokens, langCode]);

  const targetTerms = useMemo(
    () => targetWord.toLowerCase().trim().split(/\s+/).filter((term) => term.length > 0),
    [targetWord],
  );

  const tokenSpans = buildTokenSpans(tokens, targetTerms, sentence, onTokenClick, resolving);

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

function tokenClassName(token: Token, resolving: boolean): string {
  return [
    'js-cell-token',
    'js-cell-token--word',
    resolving ? 'js-cell-token--resolving' : '',
    `js-cell-token--status-${token.status ?? 'unknown'}`,
    token.frequencyBand && token.frequencyBand !== 'none'
      ? `js-cell-token--frequency-${token.frequencyBand}`
      : '',
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
            className={tokenClassName(phraseToken, resolving)}
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
        className={tokenClassName(token, resolving)}
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
}

function TokenSpan({ token, sentence, onTokenClick, className }: TokenSpanProps): React.JSX.Element {
  return (
    <span
      className={className}
      data-cell-term={token.term}
      data-cell-start={token.start}
      data-cell-end={token.end}
      onClick={onTokenClick ? () => onTokenClick(token.term, sentence) : undefined}
    >
      <span className="js-cell-token-word">{token.text}</span>
      <span className="js-cell-token-status" aria-hidden="true" />
    </span>
  );
}
