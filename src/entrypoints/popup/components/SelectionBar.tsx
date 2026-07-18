import { Button, IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
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
        <Icon name="x" size={16} />
      </IconButton>
      <span className={styles.count} data-testid="selection-count">
        {selectionCount} selected
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={onDownload}
        data-testid="selection-download-btn"
        leadingIcon={<Icon name="download" size={14} className={styles.downloadIcon} />}
      >
        Download
      </Button>
    </div>
  );
}
