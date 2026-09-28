import { useEffect, useState } from 'react';
import { getHistory } from '@/features/local-player/services/mediaLibraryRepository';
import {
  aggregateHistory,
  levelForHours,
  type ImmersionSummary,
} from '@/features/local-player/logic/immersionClock';
import { Card, VisuallyHidden } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import styles from './ImmersionStats.module.css';

const HOUR_MS = 3_600_000;

const formatHours = (ms: number): string => {
  const h = ms / HOUR_MS;
  const rounded = h >= 100 ? Math.round(h) : Math.round(h * 10) / 10;
  return `${rounded}`;
};

/**
 * ImmersionStats — watch-time summary card at the top of the library
 * (immersion-clock). Reads the history store on mount and renders total
 * input hours, last-7-days hours, day streak, and level progress.
 * Renders zeroed values on an empty history — the clock starts at zero.
 */
export function ImmersionStats(): React.JSX.Element {
  const [summary, setSummary] = useState<ImmersionSummary | null>(null);

  useEffect(() => {
    let live = true;
    void getHistory()
      .then((records) => {
        if (live) setSummary(aggregateHistory(records, new Date()));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const totalMs = summary?.totalMs ?? 0;
  const level = levelForHours(totalMs / HOUR_MS);
  const totalLabel = t('library.stats.hours', [formatHours(totalMs)]);
  const sourceTitle = summary
    ? t('library.stats.breakdown', [
        formatHours(summary.bySource.localMs),
        formatHours(summary.bySource.streamMs),
      ])
    : undefined;

  return (
    <Card className={styles.card} data-cell-id="immersion-stats">
      <div className={styles.row}>
        <Icon name="clock" size="sm" className={styles.icon} />
        <span className={styles.total} title={sourceTitle}>
          {totalLabel}
        </span>
        <span className={styles.dim}>· {t('library.stats.last7d', [formatHours(summary?.last7dMs ?? 0)])}</span>
        {(summary?.streakDays ?? 0) > 0 && (
          <span className={styles.dim}>· {t('library.stats.streak', [summary!.streakDays])}</span>
        )}
      </div>
      <div className={styles.row}>
        <span className={styles.level}>{t('library.stats.level', [level.level])}</span>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuenow={Math.round((totalMs / HOUR_MS) * 10) / 10}
          aria-valuemin={level.floorH}
          aria-valuemax={level.nextH ?? level.floorH}
        >
          <div className={styles.fill} style={{ width: `${level.progress * 100}%` }} />
          <VisuallyHidden>
            {level.nextH === null
              ? t('library.stats.levelMaxSr', [level.level])
              : t('library.stats.levelSr', [level.level, formatHours(totalMs), level.nextH])}
          </VisuallyHidden>
        </div>
        <span className={styles.dim}>
          {level.nextH === null
            ? t('library.stats.maxLevel')
            : t('library.stats.toNextLevel', [
                formatHours(Math.max(0, level.nextH * HOUR_MS - totalMs)),
                level.level + 1,
              ])}
        </span>
      </div>
    </Card>
  );
}
