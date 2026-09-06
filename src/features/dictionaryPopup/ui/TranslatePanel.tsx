import { useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './TranslatePanel.module.css';
import { t } from '@/shared/i18n';

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
        <div className={panelStyles.cellTranslateError}>{error}</div>
        <EmptyState
          size="md"
          icon={<Icon name="languages"  />}
          title={t('dict.translate.empty')}
          action={
            <Button material="solid" variant="outline" size="md" onClick={onTranslate}>
              {t('dict.translate.action', [targetLang])}
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
          className={`${checkStyles.cellTranslateBlock} ${selected ? checkStyles['cellTranslateBlock--selected'] : ''}`}
          onClick={onToggle}
          role="button"
          aria-pressed={selected}
          tabIndex={0}
        >
          <div className={styles.cellTranslateText}>
            <div className={styles.cellTranslateTarget}>{translation}</div>
            <div className={styles.cellTranslateNative}>{sentence || term}</div>
          </div>
          <span className={`${checkStyles.cellDefCheckBox} ${loading ? checkStyles['cellDefCheckBox--loading'] : ''}`} aria-hidden="true">
            {loading ? <Spinner size="xl" color="accent" /> : <Icon name="check" size="md" />}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cellTranslate} data-cell-id="dictionary-translate-panel">
      <EmptyState
        size="md"
        icon={<Icon name="languages"  />}
        title={t('dict.translate.empty')}
        action={
          <Button material="solid" variant="outline" size="md" loading={loading} onClick={onTranslate}>
            {t('dict.translate.action', [targetLang])}
          </Button>
        }
        data-cell-id="dictionary-translate-empty"
      />
    </div>
  );
}

function TranslateSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellTranslateSkeletonBlock} aria-hidden="true">
      <div className={styles.cellTranslateSkeletonText}>
        <Skeleton height="calc(var(--font-size-base) * var(--leading-normal))" className={styles.cellTranslateSkeletonLine} />
        <Skeleton width="75%" height="calc(var(--font-size-xs) * var(--leading-normal))" className={styles.cellTranslateSkeletonLine} />
      </div>
      <Skeleton width="var(--space-4)" height="var(--space-4)" className={styles.cellTranslateSkeletonCheck} />
    </div>
  );
}
