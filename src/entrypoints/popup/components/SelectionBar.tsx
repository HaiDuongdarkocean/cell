import { Button, HStack, IconButton } from '@/shared/ui';
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
    <HStack
      align="center"
      justify="between"
      gap="2"
      className={styles.selectionBar}
      data-cell-id="selection-bar"
    >
      <IconButton
        size="sm"
        onClick={onClear}
        aria-label="Clear selection"
        data-cell-id="selection-clear-btn"
      >
        <Icon name="x" size={24} />
      </IconButton>
      <span className={styles.count} data-cell-id="selection-count">
        {selectionCount} selected
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={onDownload}
        data-cell-id="selection-download-btn"
        leadingIcon={<Icon name="download" size={24} className={styles.downloadIcon} />}
      >
        Download
      </Button>
    </HStack>
  );
}
