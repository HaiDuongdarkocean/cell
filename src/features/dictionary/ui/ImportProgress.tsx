// ImportProgress — progress bar + cancel (spec F11).

import { type ReactElement } from 'react';
import { Button } from '@/shared/ui';
import { Alert } from '@/shared/ui/Alert';
import styles from './ImportProgress.module.css';

interface ImportProgressProps {
  readonly processed: number;
  readonly total: number;
  readonly onCancel?: () => void;
  readonly error?: string | null;
}

export function ImportProgress({ processed, total, onCancel, error }: ImportProgressProps): ReactElement {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div className={styles.progress} data-cell-id="import-progress">
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.label}>
        {processed}{total > 0 ? ` / ${total}` : ''} mục
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
          style={{ marginTop: 'var(--space-2)' }}
        />
      )}
    </div>
  );
}
