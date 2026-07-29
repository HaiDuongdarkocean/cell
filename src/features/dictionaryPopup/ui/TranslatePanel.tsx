import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DictionaryPanelView.module.css';

export interface TranslatePanelProps {
  readonly term: string;
  readonly sentence: string;
  readonly targetLang: string;
  readonly translation: string;
  readonly error: string | null;
  readonly loading: boolean;
  readonly selected: boolean;
  readonly onToggle: () => void;
  readonly onTranslate: () => void;
}

export function TranslatePanel({
  term,
  sentence,
  targetLang,
  translation,
  error,
  loading,
  selected,
  onToggle,
  onTranslate,
}: TranslatePanelProps): React.JSX.Element {
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
