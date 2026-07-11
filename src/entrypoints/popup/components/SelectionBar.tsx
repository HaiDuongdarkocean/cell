import { Button, IconButton } from '@/shared/ui';
import styles from './SelectionBar.module.css';

interface SelectionBarProps {
  selectionCount: number;
  onClear: () => void;
  onDownload: () => void;
}

export function SelectionBar({ selectionCount, onClear, onDownload }: SelectionBarProps): React.JSX.Element | null {
  if (selectionCount === 0) return null;

  return (
    <div className={styles.selectionBar} data-testid="selection-bar">
      <IconButton
        size="sm"
        onClick={onClear}
        aria-label="Clear selection"
        data-testid="selection-clear-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </IconButton>
      <span className={styles.count} data-testid="selection-count">
        {selectionCount} selected
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={onDownload}
        data-testid="selection-download-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{ marginRight: '4px' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Download
      </Button>
    </div>
  );
}
