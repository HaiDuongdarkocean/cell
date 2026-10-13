import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { bandToStars, rankToBand, starsToBand, type FrequencyBandThresholds, type TokenFrequencyBand } from '@/shared/lib/frequencyBand';
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
      className={`${styles.TihokaHeaderStatus} ${styles[`TihokaHeaderStatus--${base}`]}`}
      onClick={onCycle}
      title={t('dict.status.cycle', [t(STATUS_KEYS[base]), t(STATUS_KEYS[nextBaseStatus(status)])])}
      data-tihoka-id="dictionary-status-cycle"
      data-compact-hit
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
    <span className={styles.TihokaHeaderStatusGroup}>
      <Button
        variant="transparent"
        size="xs"
        className={`${styles.TihokaHeaderStatus} ${styles.TihokaHeaderStatusFlag} ${flag === 'tracking' ? styles['TihokaHeaderStatus--tracking'] : styles.TihokaHeaderStatusFlagIdle}`}
        disabled={!onToggleTracking}
        onClick={onToggleTracking}
        title={t('dict.status.trackingToggle')}
        aria-label={t('dict.status.trackingToggle')}
        data-tihoka-id="dictionary-status-flag"
        data-compact-hit
      >
        <Icon name="footprints" size="sm" />
      </Button>
      <StatusPill status={status} onCycle={onCycle} />
      {hasCards && (
        <Button
          variant="transparent"
          size="xs"
          className={`${styles.TihokaHeaderStatus} ${styles.TihokaHeaderStatusFlag} ${styles['TihokaHeaderStatus--learning']}`}
          onClick={onOpenSrsCards}
          title={t('dict.status.srsCards', [srsCardCount ?? 0])}
          aria-label={t('dict.status.srsCards', [srsCardCount ?? 0])}
          data-tihoka-id="dictionary-srs-cards"
          data-compact-hit
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
  /** 'rank' → source+rank chips; 'stars' → ★ chips (ranks convert via
   *  `thresholds`, from Settings → Dictionary popup → Frequency display). */
  readonly frequencyDisplay?: 'stars' | 'rank';
  readonly statusControl?: ReactNode;
}

export function StatusRow({ status, onCycle, onToggleTracking, srsCardCount, onOpenSrsCards, frequencies, stars, thresholds, frequencyDisplay = 'stars', statusControl }: StatusRowProps): React.JSX.Element {
  const scrollRef = useDragScroll<HTMLDivElement>();
  const starChips: { readonly key: string; readonly source: string; readonly count: number; readonly band: TokenFrequencyBand }[] = [];
  if (stars) starChips.push({ key: `stars-${stars.source}`, source: stars.source, count: stars.count, band: starsToBand(stars.count) });
  for (const freq of frequencies) {
    if (stars && freq.source === stars.source) continue;
    const band = rankToBand(freq.rank, thresholds);
    const count = bandToStars(band);
    if (count > 0) starChips.push({ key: `rank-${freq.source}`, source: freq.source, count, band });
  }
  const rankSources = new Set(frequencies.map((freq) => freq.source));
  // Rank mode: every rank list renders a chip; dict-native stars still show
  // alongside when their source has no rank list (e.g. COCA + dict frequency).
  const renderStars = frequencyDisplay === 'rank'
    ? starChips.filter((chip) => !rankSources.has(chip.source))
    : starChips;
  const renderRanks = frequencyDisplay === 'rank' || starChips.length === 0 ? frequencies : [];
  const hasChips = renderStars.length > 0 || renderRanks.length > 0;
  return (
    <div className={styles.TihokaHeaderSecond} ref={scrollRef} data-tihoka-id="dictionary-freq-row">
      {statusControl ?? <StatusSegmented status={status} onCycle={onCycle} onToggleTracking={onToggleTracking} srsCardCount={srsCardCount} onOpenSrsCards={onOpenSrsCards} />}
      {hasChips && <span className={styles.TihokaHeaderDivider} aria-hidden="true" />}
      {renderStars.map((chip) => (
        <span key={chip.key} className={`${styles.TihokaHeaderFrequency} ${styles[`TihokaHeaderFrequency--${chip.band}`]}`} title={t('resources.component.frequencyStars')} data-tihoka-id="dictionary-stars">
          <span className={styles.TihokaHeaderFrequencySource}>{chip.source}</span>
          <span className={styles.TihokaHeaderFrequencyRank}>{'★'.repeat(chip.count)}</span>
        </span>
      ))}
      {renderRanks.map((freq, i) => (
        <span key={`${freq.source}-${i}`} className={`${styles.TihokaHeaderFrequency} ${styles[`TihokaHeaderFrequency--${rankToBand(freq.rank, thresholds)}`]}`} title={freqTitle(freq)} data-tihoka-id="dictionary-frequency">
          <span className={styles.TihokaHeaderFrequencySource}>{freq.source}</span>
          <span className={styles.TihokaHeaderFrequencyRank}>{freq.rank.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}
