import { useMemo } from 'react';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';
import type { Token } from '@/features/tokenize/types';
import styles from './TokenizedParagraph.module.css';

export interface TokenizedParagraphProps {
  readonly text: string;
  readonly langCode?: string;
  readonly paragraphIndex: number;
  readonly onTokenClick: (token: Token, tokenIndex: number) => void;
}

export function TokenizedParagraph({
  text,
  langCode = 'en',
  paragraphIndex,
  onTokenClick,
}: TokenizedParagraphProps): React.JSX.Element {
  const tokens = useMemo(() => tokenizeTextBlock(text, langCode), [text, langCode]);

  return (
    <p className={styles.paragraph} data-paragraph-index={paragraphIndex}>
      {tokens.map((token, index) =>
        token.isSeparator ? (
          <span key={index} className={styles.separator}>
            {token.text}
          </span>
        ) : (
          <span
            key={index}
            className={styles.token}
            role="button"
            tabIndex={0}
            onClick={() => onTokenClick(token, index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onTokenClick(token, index);
              }
            }}
          >
            {token.text}
          </span>
        ),
      )}
    </p>
  );
}
