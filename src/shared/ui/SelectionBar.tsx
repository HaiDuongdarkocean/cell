import type { ReactNode } from 'react';
import { t } from '@/shared/i18n';
import styles from './SelectionBar.module.css';

export interface SelectionBarProps {
  readonly open: boolean;
  readonly label?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly 'data-tihoka-id'?: string;
}

/** Sticky bottom action bar for multi-select flows — elevated pill with an
 *  optional leading label and equal-width action children. Stays mounted while
 *  closed so the exit transition can play; hidden state is inert via
 *  visibility + pointer-events + aria-hidden. */
export function SelectionBar({
  open,
  label,
  children,
  className,
  'data-tihoka-id': dataTihokaId,
}: SelectionBarProps): React.JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label={t('ui.selectionBar.aria')}
      aria-hidden={!open}
      data-open={open ? '' : undefined}
      data-tihoka-id={dataTihokaId}
      className={[styles.bar, className].filter(Boolean).join(' ')}
    >
      {label !== undefined && label !== null ? (
        <span className={styles.label}>{label}</span>
      ) : null}
      <div className={styles.actions}>{children}</div>
    </div>
  );
}
