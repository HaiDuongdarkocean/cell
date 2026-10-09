import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { rankToBand, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import { baseStatus, nextBaseStatus, statusFlag } from '@/features/dictionary';
import { t, type MessageKey } from '@/shared/i18n';
import { useDragScroll } from '@/shared/ui/useDragScroll';
import styles from './CandidateView.module.css';
import type { VariantFrequency, WordStatus } from '@/entities/dictionary';

export const STATUS_KEYS: Record<WordStatus, MessageKey> = {
  unknown: 'vocabulary.status.unknown',
  tracking: 'vocabulary.status.tracking',
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

function freqTitle(freq: VariantFrequency): string | undefined {
  const parts: string[] = [];
  if (freq.total != null) parts.push(`total ${freq.total.toLocaleString()}`);
  if (freq.genres) {
    const g = freq.genres;
    for (const [k, v] of [['spoken', g.spoken], ['fiction', g.fiction], ['magazine', g.magazine], ['newspaper', g.newspaper], ['academic', g.academic]] as const) {
      if (v != null) parts.push(`${k} ${v.toLocaleString()}`);
    }
  }
  return parts.length ? parts.join(' · ') : undefined;
}

export interface StatusPillProps {
  readonly status: WordStatus;
  readonly onCycle: () => void;
}

export function StatusPill({ status, onCycle }: StatusPillProps): React.JSX.Element {
  const base = baseStatus(status);
  return (
    <Button
      variant="transparent"
      className={`${styles.cellHeaderStatus} ${styles[`cellHeaderStatus--${base}`]}`}
      onClick={onCycle}
      title={t('dict.status.cycle', [t(STATUS_KEYS[base]), t(STATUS_KEYS[nextBaseStatus(status)])])}
      data-cell-id="dictionary-status-cycle"
    >
      {t(STATUS_KEYS[base])}
    </Button>
  );
}

export interface StatusSegmentedProps {
  readonly status: WordStatus;
  readonly onCycle: () => void;
  readonly onToggleTracking?: () => void;
}

export function StatusSegmented({ status, onCycle, onToggleTracking }: StatusSegmentedProps): React.JSX.Element {
  const flag = statusFlag(status);
  return (
    <span className={styles.cellHeaderStatusGroup}>
      <StatusPill status={status} onCycle={onCycle} />
      {flag === 'tracking' && (
        <Button
          variant="transparent"
          className={`${styles.cellHeaderStatus} ${styles.cellHeaderStatusFlag} ${styles['cellHeaderStatus--tracking']}`}
          onClick={onToggleTracking}
          title={t('dict.status.trackingToggle')}
          aria-label={t('dict.status.trackingToggle')}
          data-cell-id="dictionary-status-flag"
        >
          <Icon name="eye" size="sm" />
        </Button>
      )}
      {flag === 'learning' && (
        <Button
          variant="transparent"
          className={`${styles.cellHeaderStatus} ${styles.cellHeaderStatusFlag} ${styles['cellHeaderStatus--learning']}`}
          disabled
          title={t('dict.status.learningFlag')}
          aria-label={t('dict.status.learningFlag')}
          data-cell-id="dictionary-status-flag"
        >
          <Icon name="layers" size="sm" />
        </Button>
      )}
    </span>
  );
}

export interface StatusRowProps {
  readonly status: WordStatus;
  readonly onCycle: () => void;
  readonly onToggleTracking?: () => void;
  readonly frequencies: readonly VariantFrequency[];
  readonly stars: { readonly count: number; readonly source: string } | undefined;
  readonly thresholds: FrequencyBandThresholds;
  readonly statusControl?: ReactNode;
}

export function StatusRow({ status, onCycle, onToggleTracking, frequencies, stars, thresholds, statusControl }: StatusRowProps): React.JSX.Element {
  const scrollRef = useDragScroll<HTMLDivElement>();
  return (
    <div className={styles.cellHeaderSecond} ref={scrollRef} data-cell-id="dictionary-freq-row">
      {statusControl ?? <StatusSegmented status={status} onCycle={onCycle} onToggleTracking={onToggleTracking} />}
      {frequencies.map((freq, i) => (
        <span key={`${freq.source}-${i}`} className={`${styles.cellHeaderFrequency} ${styles[`cellHeaderFrequency--${rankToBand(freq.rank, thresholds)}`]}`} title={freqTitle(freq)} data-cell-id="dictionary-frequency">
          <span className={styles.cellHeaderFrequencySource}>{freq.source}</span>
          <span className={styles.cellHeaderFrequencyRank}>{freq.rank.toLocaleString()}</span>
        </span>
      ))}
      {stars && (
        <span className={styles.cellHeaderFrequency} title={t('resources.component.frequencyStars')} data-cell-id="dictionary-stars">
          <span className={styles.cellHeaderFrequencySource}>{stars.source}</span>
          <span className={styles.cellHeaderFrequencyRank}>{'★'.repeat(stars.count)}</span>
        </span>
      )}
    </div>
  );
}
