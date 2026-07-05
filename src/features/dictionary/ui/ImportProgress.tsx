// ImportProgress — progress bar + cancel (spec F11).

import { type ReactElement } from 'react';
import styles from './ImportProgress.module.css';

interface ImportProgressProps {
  readonly processed: number;
  readonly total: number;
  readonly onCancel?: () => void;
}

export function ImportProgress({ processed, total, onCancel }: ImportProgressProps): ReactElement {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div className={styles.progress} data-testid="import-progress">
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.label}>
        {processed}{total > 0 ? ` / ${total}` : ''} mục
      </span>
      {onCancel && (
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Hủy
        </button>
      )}
    </div>
  );
}
