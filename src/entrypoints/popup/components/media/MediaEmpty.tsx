import { EmptyState } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './MediaEmpty.module.css';

interface MediaEmptyProps {
  type: 'videos' | 'subtitles' | 'downloads';
  scanning?: boolean;
}

const EMPTY_CONFIG = {
  videos: {
    scanningIcon: <Icon name="search" size={32} className={styles.emptyIcon} />,
    icon: <Icon name="video" size={32} className={styles.emptyIcon} />,
    scanningTitle: 'Looking for media…',
    scanningHint: 'Open a page with a video player and\ndownloadable media will appear here.',
    title: 'No media found',
    hint: 'Try playing a video on this page,\nthen check back here.',
  },
  subtitles: {
    scanningIcon: null,
    icon: <Icon name="flag" size={32} className={styles.emptyIcon} />,
    scanningTitle: '',
    scanningHint: '',
    title: 'No subtitles found',
    hint: 'Subtitles will appear here when available.',
  },
  downloads: {
    scanningIcon: null,
    icon: <Icon name="download" size={32} className={styles.emptyIcon} />,
    scanningTitle: '',
    scanningHint: '',
    title: 'No downloads yet',
    hint: 'Your download queue is empty.',
  },
} as const;

export function MediaEmpty({ type, scanning = false }: MediaEmptyProps): React.JSX.Element {
  const config = EMPTY_CONFIG[type];
  const isScanning = scanning && config.scanningIcon !== null;

  return (
    <div
      className={`${styles.empty} ${isScanning ? styles.scanning : ''}`}
      role="status"
      aria-live="polite"
      data-testid="empty-media"
    >
      <EmptyState
        icon={isScanning ? config.scanningIcon : config.icon}
        title={isScanning ? config.scanningTitle : config.title}
        description={isScanning ? config.scanningHint : config.hint}
      />
    </div>
  );
}
