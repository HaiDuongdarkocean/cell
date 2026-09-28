import { EmptyState } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { MessageKey } from '@/shared/i18n';
import styles from './MediaEmpty.module.css';

interface MediaEmptyProps {
  type: 'videos' | 'subtitles' | 'downloads';
  scanning?: boolean;
}

interface EmptyConfig {
  scanningIcon: React.JSX.Element | null;
  icon: React.JSX.Element;
  scanningTitle: MessageKey | null;
  scanningHint: MessageKey | null;
  title: MessageKey;
  hint: MessageKey;
}

const EMPTY_CONFIG: Record<MediaEmptyProps['type'], EmptyConfig> = {
  videos: {
    scanningIcon: <Icon name="search" size="lg" className={styles.emptyIcon} />,
    icon: <Icon name="video" size="lg" className={styles.emptyIcon} />,
    scanningTitle: 'downloads.empty.scanningTitle',
    scanningHint: 'downloads.empty.scanningHint',
    title: 'downloads.empty.mediaTitle',
    hint: 'downloads.empty.mediaHint',
  },
  subtitles: {
    scanningIcon: null,
    icon: <Icon name="flag" size="lg" className={styles.emptyIcon} />,
    scanningTitle: null,
    scanningHint: null,
    title: 'downloads.empty.subtitlesTitle',
    hint: 'downloads.empty.subtitlesHint',
  },
  downloads: {
    scanningIcon: null,
    icon: <Icon name="download" size="lg" className={styles.emptyIcon} />,
    scanningTitle: null,
    scanningHint: null,
    title: 'downloads.empty.downloadsTitle',
    hint: 'downloads.empty.downloadsHint',
  },
};

export function MediaEmpty({ type, scanning = false }: MediaEmptyProps): React.JSX.Element {
  const config = EMPTY_CONFIG[type];
  const isScanning = scanning && config.scanningIcon !== null;
  const titleKey = isScanning && config.scanningTitle ? config.scanningTitle : config.title;
  const hintKey = isScanning && config.scanningHint ? config.scanningHint : config.hint;

  return (
    <div
      className={`${styles.empty} ${isScanning ? styles.scanning : ''}`}
      role="status"
      aria-live="polite"
      data-cell-id="empty-media"
    >
      <EmptyState
        icon={isScanning ? config.scanningIcon : config.icon}
        title={t(titleKey)}
        description={t(hintKey)}
      />
    </div>
  );
}
