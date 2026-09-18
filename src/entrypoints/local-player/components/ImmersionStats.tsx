import { useEffect, useState } from 'react';
import { getHistory } from '@/features/local-player/services/mediaLibraryRepository';
import {
  aggregateHistory,
  levelForHours,
  type ImmersionSummary,
} from '@/features/local-player/logic/immersionClock';
import { Card, VisuallyHidden } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
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
  const totalLabel = `${formatHours(totalMs)} h input`;
  const sourceTitle = summary
    ? `local ${formatHours(summary.bySource.localMs)} h · streaming ${formatHours(summary.bySource.streamMs)} h`
    : undefined;

  return (
    <Card className={styles.card} data-cell-id="immersion-stats">
      <div className={styles.row}>
        <Icon name="clock" size="sm" className={styles.icon} />
        <span className={styles.total} title={sourceTitle}>
          {totalLabel}
        </span>
        <span className={styles.dim}>· {formatHours(summary?.last7dMs ?? 0)} h last 7 days</span>
        {(summary?.streakDays ?? 0) > 0 && (
          <span className={styles.dim}>· {summary!.streakDays}-day streak</span>
        )}
      </div>
      <div className={styles.row}>
        <span className={styles.level}>Level {level.level}</span>
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
              ? `Level ${level.level}, maximum level reached`
              : `Level ${level.level}, ${formatHours(totalMs)} of ${level.nextH} hours`}
          </VisuallyHidden>
        </div>
        <span className={styles.dim}>
          {level.nextH === null
            ? 'max level'
            : `${formatHours(Math.max(0, level.nextH * HOUR_MS - totalMs))} h to Level ${level.level + 1}`}
        </span>
      </div>
    </Card>
  );
}
