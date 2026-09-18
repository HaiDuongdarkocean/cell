import { useCallback } from 'react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/icons/Icon';
import { formatCueTimestamp } from '../logic/cueTime';
import { FrequencyBadge, type FrequencyLevel } from '@/shared/domain/learning/atoms';
import { t } from '@/shared/i18n';
import type { PrimerRow } from '../logic/primerList';
import styles from './PrimerTab.module.css';

export interface PrimerTabProps {
  readonly rows: readonly PrimerRow[];
  readonly onTokenClick: (term: string, element: HTMLElement, contextSentence: string) => void;
  readonly onSeek: (timeMs: number) => void;
}

export function PrimerTab({ rows, onTokenClick, onSeek }: PrimerTabProps): React.JSX.Element {
  const unknownCount = rows.reduce((n, r) => n + (r.status === 'unknown' ? 1 : 0), 0);
  const trackingCount = rows.length - unknownCount;
  const hasHours = rows.some((r) => r.firstCueStartMs >= 3_600_000);

  const handleRowClick = useCallback(
    (event: React.MouseEvent<HTMLElement>, row: PrimerRow): void => {
      const termEl = event.currentTarget.querySelector<HTMLElement>('.js-cell-token');
      if (termEl) onTokenClick(row.term, termEl, row.contextText);
    },
    [onTokenClick],
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, row: PrimerRow): void => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const termEl = event.currentTarget.querySelector<HTMLElement>('.js-cell-token');
      if (termEl) onTokenClick(row.term, termEl, row.contextText);
    },
    [onTokenClick],
  );

  if (rows.length === 0) {
    return (
      <div className={styles.root} data-cell-id="primer-tab">
        <EmptyState size="compact" title={t('primer.empty')} style={{ flex: 1 }} />
      </div>
    );
  }

  return (
    <div className={styles.root} data-cell-id="primer-tab">
      <div className={styles.header} data-cell-id="primer-header">
        <span className={styles.count}>{t('primer.count', [rows.length])}</span>
        {unknownCount > 0 && trackingCount > 0 && (
          <span className={styles.breakdown}>
            {t('primer.countBreakdown', [unknownCount, trackingCount])}
          </span>
        )}
      </div>
      <ul className={styles.list} data-cell-id="primer-list">
        {rows.map((row) => (
          <li key={row.term} className={styles.item}>
            <div
              className={styles.row}
              role="button"
              tabIndex={0}
              data-cell-id="primer-row"
              data-cue-start={row.firstCueStartMs}
              data-cue-end={row.firstCueEndMs}
              onClick={(e) => handleRowClick(e, row)}
              onKeyDown={(e) => handleRowKeyDown(e, row)}
            >
              <span
                className={`${styles.term} js-cell-token`}
                data-cell-term={row.term}
                data-cell-start={row.firstTokenOffset}
              >
                {row.term}
              </span>
              {row.band !== 'none' && (
                <FrequencyBadge
                  level={row.band as FrequencyLevel}
                  rank={row.rank ?? undefined}
                  className={styles.band}
                />
              )}
              <span className={`${styles.status} ${styles[`status_${row.status}`]}`}>
                {t(`vocabulary.status.${row.status}`)}
              </span>
              <span className={styles.occurrences} aria-label={t('primer.occurrences', [row.count])}>
                ×{row.count}
              </span>
              <Button
                shape="circle"
                variant="ghost"
                size="sm"
                className={styles.seek}
                aria-label={t('primer.seek', [row.term, formatCueTimestamp(row.firstCueStartMs, hasHours)])}
                data-cell-id="primer-seek"
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(row.firstCueStartMs);
                }}
              >
                <Icon name="playRoundedRect" size="xs" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
