import { useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { Skeleton } from '@/shared/ui/Skeleton';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
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
  /** Google vs AI engine (spec ai-bridge-dictionary REQ-4). Omit for read-only use. */
  readonly engine?: 'google' | 'ai';
  readonly onEngineChange?: (engine: 'google' | 'ai') => void;
  /** Provider that produced the AI translation — shown as attribution. */
  readonly aiProviderLabel?: string;
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
  engine,
  onEngineChange,
  aiProviderLabel,
}: TranslatePanelProps): React.JSX.Element {
  const engineSwitch = onEngineChange && engine ? (
    <SegmentedControl<'google' | 'ai'>
      ariaLabel={t('dict.translate.engine.aria')}
      value={engine}
      onChange={onEngineChange}
      options={[
        { value: 'google', label: t('dict.translate.engine.google'), ariaLabel: t('dict.translate.engine.google') },
        { value: 'ai', label: t('dict.translate.engine.ai'), ariaLabel: t('dict.translate.engine.ai') },
      ]}
    />
  ) : null;
  // Auto-translate once when panel opens with no translation and no error yet
  const autoTranslateFiredRef = useRef(false);
  useEffect(() => {
    if (autoTranslateFiredRef.current) return;
    if (!translation && !error && !loading) {
      autoTranslateFiredRef.current = true;
      onTranslate();
    }
  }, [translation, error, loading, onTranslate]);

  if (loading && !translation) {
    return (
      <div className={styles.TihokaTranslate} data-tihoka-id="dictionary-translate-panel">
        {engineSwitch}
        <TranslateSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.TihokaTranslate} data-tihoka-id="dictionary-translate-panel">
        {engineSwitch}
        <div className={panelStyles.TihokaTranslateError}>{error}</div>
        <EmptyState
          size="md"
          icon={<Icon name="languages"  />}
          title={t('dict.translate.empty')}
          action={
            <Button variant="outline" size="md" onClick={onTranslate}>
              {t('dict.translate.action', [targetLang])}
            </Button>
          }
          data-tihoka-id="dictionary-translate-empty"
        />
      </div>
    );
  }

  if (translation) {
    return (
      <div className={styles.TihokaTranslate} data-tihoka-id="dictionary-translate-panel">
        {engineSwitch}
        <div
          className={`${checkStyles.TihokaTranslateBlock} ${selected ? checkStyles['TihokaTranslateBlock--selected'] : ''}`}
          onClick={onToggle}
          role="button"
          aria-pressed={selected}
          tabIndex={0}
        >
          <div className={styles.TihokaTranslateText}>
            <div className={styles.TihokaTranslateTarget}>{translation}</div>
            <div className={styles.TihokaTranslateNative}>{sentence || term}</div>
            {engine === 'ai' && aiProviderLabel && (
              <div className={styles.TihokaTranslateSource}>{t('dict.ai.sourcedFrom', [aiProviderLabel])}</div>
            )}
          </div>
          <span className={`${checkStyles.TihokaDefCheckBox} ${loading ? checkStyles['TihokaDefCheckBox--loading'] : ''}`} aria-hidden="true">
            {loading ? <Spinner size="xl" color="accent" /> : <Icon name="check" size="md" />}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.TihokaTranslate} data-tihoka-id="dictionary-translate-panel">
      {engineSwitch}
      <EmptyState
        size="md"
        icon={<Icon name="languages"  />}
        title={t('dict.translate.empty')}
        action={
          <Button variant="outline" size="md" loading={loading} onClick={onTranslate}>
            {t('dict.translate.action', [targetLang])}
          </Button>
        }
        data-tihoka-id="dictionary-translate-empty"
      />
    </div>
  );
}

function TranslateSkeleton(): React.JSX.Element {
  return (
    <div className={styles.TihokaTranslateSkeletonBlock} aria-hidden="true">
      <div className={styles.TihokaTranslateSkeletonText}>
        <Skeleton height="calc(var(--font-size-base) * var(--leading-normal))" className={styles.TihokaTranslateSkeletonLine} />
        <Skeleton width="75%" height="calc(var(--font-size-xs) * var(--leading-normal))" className={styles.TihokaTranslateSkeletonLine} />
      </div>
      <Skeleton width="var(--space-4)" height="var(--space-4)" className={styles.TihokaTranslateSkeletonCheck} />
    </div>
  );
}
