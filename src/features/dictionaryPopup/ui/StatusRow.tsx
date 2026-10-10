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
  readonly srsCardCount?: number;
  readonly onOpenSrsCards?: () => void;
}

export function StatusSegmented({ status, onCycle, onToggleTracking, srsCardCount, onOpenSrsCards }: StatusSegmentedProps): React.JSX.Element {
  const flag = statusFlag(status);
  const hasCards = (srsCardCount ?? 0) > 0;
  return (
    <span className={styles.cellHeaderStatusGroup}>
      <Button
        variant="transparent"
        className={`${styles.cellHeaderStatus} ${styles.cellHeaderStatusFlag} ${flag === 'tracking' ? styles['cellHeaderStatus--tracking'] : styles.cellHeaderStatusFlagIdle}`}
        disabled={!onToggleTracking}
        onClick={onToggleTracking}
        title={t('dict.status.trackingToggle')}
        aria-label={t('dict.status.trackingToggle')}
        data-cell-id="dictionary-status-flag"
      >
        <Icon name="footprints" size="sm" />
      </Button>
      <StatusPill status={status} onCycle={onCycle} />
      {hasCards && (
        <Button
          variant="transparent"
          className={`${styles.cellHeaderStatus} ${styles.cellHeaderStatusFlag} ${styles['cellHeaderStatus--learning']}`}
          onClick={onOpenSrsCards}
          title={t('dict.status.srsCards', [srsCardCount ?? 0])}
          aria-label={t('dict.status.srsCards', [srsCardCount ?? 0])}
          data-cell-id="dictionary-srs-cards"
        >
          <Icon name="notebookPen" size="sm" />
        </Button>
      )}
    </span>
  );
}

export interface StatusRowProps {
  readonly status: WordStatus;
  readonly onCycle: () => void;
  readonly onToggleTracking?: () => void;
  readonly srsCardCount?: number;
  readonly onOpenSrsCards?: () => void;
  readonly frequencies: readonly VariantFrequency[];
  readonly stars: { readonly count: number; readonly source: string } | undefined;
  readonly thresholds: FrequencyBandThresholds;
  readonly statusControl?: ReactNode;
}

export function StatusRow({ status, onCycle, onToggleTracking, srsCardCount, onOpenSrsCards, frequencies, stars, thresholds, statusControl }: StatusRowProps): React.JSX.Element {
  const scrollRef = useDragScroll<HTMLDivElement>();
  return (
    <div className={styles.cellHeaderSecond} ref={scrollRef} data-cell-id="dictionary-freq-row">
      {statusControl ?? <StatusSegmented status={status} onCycle={onCycle} onToggleTracking={onToggleTracking} srsCardCount={srsCardCount} onOpenSrsCards={onOpenSrsCards} />}
      {frequencies.length > 0 && <span className={styles.cellHeaderDivider} aria-hidden="true" />}
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
