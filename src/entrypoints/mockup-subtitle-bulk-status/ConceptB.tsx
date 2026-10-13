import { useEffect, useState } from 'react';
import { MOCK_CUES, MATRIX, bandFor, statusFor } from './mockData';
import styles from './mockup.module.css';

function tokenClass(word: string, selected: boolean): string {
  const band = bandFor(word);
  return [
    'js-Tihoka-token',
    'js-Tihoka-token--word',
    `js-Tihoka-token--status-${statusFor(word)}`,
    band ? `js-Tihoka-token--frequency-${band}` : '',
    selected ? 'js-Tihoka-token--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function ConceptB(): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onTokenClick = (key: string, word: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setNote('');
    } else {
      setNote(`dictionary → ${word}`);
    }
  };

  return (
    <div className={`${styles.panel} ${styles.scopeB}`}>
      <div className={styles.demoBar}>
        <span>{selected.size} selected</span>
        <span>{note || 'ctrl/cmd+click selects · click opens dictionary · Esc clears'}</span>
      </div>

      <div className={styles.cues}>
        {MOCK_CUES.map((cue) => (
          <div key={cue.index} className={styles.cue}>
            <div className={styles.cueText}>
              {cue.targetText.split(' ').map((word, i) => {
                const key = `${cue.index}:${i}`;
                return (
                  <span key={key}>
                    {i > 0 && ' '}
                    <span
                      className={tokenClass(word, selected.has(key))}
                      data-tihoka-term={word.toLowerCase()}
                      onClick={(event) => onTokenClick(key, word, event)}
                    >
                      <span className="js-Tihoka-token-word">{word}</span>
                      <span className="js-Tihoka-token-status" aria-hidden="true" />
                    </span>
                  </span>
                );
              })}
            </div>
            <div className={styles.cueNative}>{cue.nativeText}</div>
          </div>
        ))}
      </div>

      <div className={styles.matrix}>
        {MATRIX.map((Tihoka) => (
          <div key={Tihoka.label} className={styles.matrixRow}>
            <span className={styles.matrixLabel}>{Tihoka.label}</span>
            <span
              className={[
                'js-Tihoka-token',
                'js-Tihoka-token--word',
                `js-Tihoka-token--status-${Tihoka.status}`,
                Tihoka.band ? `js-Tihoka-token--frequency-${Tihoka.band}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="js-Tihoka-token-word">{Tihoka.label}</span>
            </span>
            <span
              className={[
                'js-Tihoka-token',
                'js-Tihoka-token--word',
                `js-Tihoka-token--status-${Tihoka.status}`,
                Tihoka.band ? `js-Tihoka-token--frequency-${Tihoka.band}` : '',
                'js-Tihoka-token--selected',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="js-Tihoka-token-word">{Tihoka.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
