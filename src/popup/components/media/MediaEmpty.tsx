import { Button } from '../ui/Button';
import styles from './MediaEmpty.module.css';

interface MediaEmptyProps {
  type: 'videos' | 'subtitles' | 'downloads';
  onAction?: () => void;
}

const EMPTY_STATE_CONFIG = {
  videos: {
    icon: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
    title: 'No videos detected',
    description: 'Visit a video page to detect downloadable content.',
    actionText: null,
  },
  subtitles: {
    icon: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    title: 'No subtitles found',
    description: 'Subtitles will appear here when available.',
    actionText: null,
  },
  downloads: {
    icon: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: 'No downloads yet',
    description: 'Your download queue is empty.',
    actionText: null,
  },
};

export function MediaEmpty({ type, onAction }: MediaEmptyProps): React.JSX.Element {
  const config = EMPTY_STATE_CONFIG[type];

  return (
    <div className={styles.empty} role="status" aria-live="polite" data-testid="empty-media">
      <div className={styles.icon}>{config.icon}</div>
      <h3 className={styles.title}>{config.title}</h3>
      <p className={styles.description}>{config.description}</p>
      {config.actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} className={styles.action}>
          {config.actionText}
        </Button>
      )}
    </div>
  );
}