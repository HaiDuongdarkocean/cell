import { Badge } from '@/shared/ui/Badge';
import { t, type MessageKey } from '@/shared/i18n';
import type { ComprehensionBand, ComprehensionStats } from '@/entities/comprehension';

const BAND_VARIANT: Record<ComprehensionBand, 'success' | 'warning' | 'destructive'> = {
  comfortable: 'success',
  stretch: 'warning',
  hard: 'destructive',
};

const BAND_MESSAGE: Record<ComprehensionBand, MessageKey> = {
  comfortable: 'comprehension.band.comfortable',
  stretch: 'comprehension.band.stretch',
  hard: 'comprehension.band.hard',
};

export interface ComprehensionBadgeProps {
  stats: ComprehensionStats;
  size?: 'xs' | 'sm' | 'md';
}

export function ComprehensionBadge({ stats, size = 'sm' }: ComprehensionBadgeProps): React.JSX.Element {
  const title = t('comprehension.badge.title', [stats.coverage, t(BAND_MESSAGE[stats.band]), t('comprehension.newTerms', [stats.newTerms])]);
  return (
    <Badge
      variant={BAND_VARIANT[stats.band]}
      size={size}
      title={title}
      data-tihoka-id="comprehension-badge"
      data-band={stats.band}
    >
      {stats.coverage.toFixed(1)}%
    </Badge>
  );
}
