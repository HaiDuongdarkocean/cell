import { EmptyState } from '@/shared/ui';
import styles from './MediaEmpty.module.css';

interface MediaEmptyProps {
  type: 'videos' | 'subtitles' | 'downloads';
  scanning?: boolean;
}

const EMPTY_CONFIG = {
  videos: {
    // FIXME: extract to registry once stroke-width variant supported — strokeWidth 1.5 differs from ICON_CATALOG.search (stroke 2)
    scanningIcon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    // FIXME: extract to registry once stroke-width variant supported — strokeWidth 1.5 differs from ICON_CATALOG.video (stroke 2)
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M10 9l5 3-5 3z" />
      </svg>
    ),
    scanningTitle: 'Looking for media…',
    scanningHint: 'Open a page with a video player and\ndownloadable media will appear here.',
    title: 'No media found',
    hint: 'Try playing a video on this page,\nthen check back here.',
  },
  subtitles: {
    scanningIcon: null,
    // FIXME: extract to registry once stroke-width variant supported — strokeWidth 1.5 differs from ICON_CATALOG.flag (stroke 2)
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    scanningTitle: '',
    scanningHint: '',
    title: 'No subtitles found',
    hint: 'Subtitles will appear here when available.',
  },
  downloads: {
    scanningIcon: null,
    // FIXME: extract to registry once stroke-width variant supported — strokeWidth 1.5 differs from ICON_CATALOG.download (stroke 2)
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
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
