// ImportProgress — progress bar + cancel (spec F11).

import { type ReactElement } from 'react';
import { Button } from '@/shared/ui';
import { Alert } from '@/shared/ui/Alert';
import { Progress } from '@/shared/ui/Progress';
import styles from './ImportProgress.module.css';

interface ImportProgressProps {
  readonly processed: number;
  readonly total: number;
  readonly onCancel?: () => void;
  readonly error?: string | null;
}

export function ImportProgress({ processed, total, onCancel, error }: ImportProgressProps): ReactElement {
  return (
    <div className={styles.progress} data-cell-id="import-progress">
      <Progress
        className={styles.bar}
        value={processed}
        max={total > 0 ? total : 100}
        indeterminate={total === 0}
        aria-label="Import progress"
      />
      <span className={styles.label}>
        Đang thêm… {processed}{total > 0 ? ` / ${total}` : ''} mục
      </span>
      {onCancel && (
        <Button variant="outline" size="sm" onClick={onCancel}>
          Hủy
        </Button>
      )}
      {error && (
        <Alert
          variant="error"
          description={error}
          role="alert"
          className={styles.error}
        />
      )}
    </div>
  );
}
