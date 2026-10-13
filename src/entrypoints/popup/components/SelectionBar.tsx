import { Button, HStack } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
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
      data-tihoka-id="selection-bar"
    >
      <Button shape="circle"
        size="sm"
        onClick={onClear}
        aria-label={t('downloads.action.deselectAll')}
        data-tihoka-id="selection-clear-btn"
      >
        <Icon name="x" size={18}  />
      </Button>
      <span className={styles.count} data-tihoka-id="selection-count">
        {t('downloads.selection.count', [selectionCount])}
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={onDownload}
        data-tihoka-id="selection-download-btn"
        leadingIcon={<Icon name="download" size={18} className={styles.downloadIcon} />}
      >
        {t('downloads.action.download')}
      </Button>
    </HStack>
  );
}
