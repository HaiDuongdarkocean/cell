import { useEffect } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
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
  // Auto-translate when panel opens with no translation and no error yet
  useEffect(() => {
    if (!translation && !error && !loading) {
      onTranslate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !translation) {
    return (
      <div className={styles.cellTranslate} data-cell-id="dictionary-translate-panel">
        <TranslateSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.cellTranslate} data-cell-id="dictionary-translate-panel">
        <div className={styles.cellTranslateError}>{error}</div>
        <EmptyState
          size="md"
          icon={<Icon name="languages" size={24} />}
          title="No translation"
          action={
            <Button variant="outline" size="md" onClick={onTranslate}>
              Translate to {targetLang}
            </Button>
          }
          data-cell-id="dictionary-translate-empty"
        />
      </div>
    );
  }

  if (translation) {
    return (
      <div className={styles.cellTranslate} data-cell-id="dictionary-translate-panel">
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
          <span className={styles.cellDefCheckBox} aria-hidden="true">
            {loading ? <Spinner size="md" /> : <Icon name="check" size={24} />}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cellTranslate} data-cell-id="dictionary-translate-panel">
      <EmptyState
        size="md"
        icon={<Icon name="languages" size={24} />}
        title="No translation"
        action={
          <Button variant="outline" size="md" loading={loading} onClick={onTranslate}>
            Translate to {targetLang}
          </Button>
        }
        data-cell-id="dictionary-translate-empty"
      />
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
