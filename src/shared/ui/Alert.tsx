import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import { Icon } from '@/shared/icons/Icon';
import styles from './Alert.module.css';

type AlertVariant = 'default' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual variant. Default: default. */
  variant?: AlertVariant;
  /** Alert title. */
  title?: ReactNode;
  /** Alert description. */
  description?: ReactNode;
  /** Dismiss handler; shows a dismiss button when provided. */
  onDismiss?: () => void;
  /** ARIA role. Default: alert. */
  role?: 'alert' | 'status';
}

/**
 * Alert — inline message banner.
 */
export function Alert({
  variant = 'default',
  title,
  description,
  onDismiss,
  role = 'alert',
  className,
  ...rest
}: AlertProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const cls = [styles.alert, styles[variant], className ?? ''].filter(Boolean).join(' ');

  const handleDismiss = (): void => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={cls} role={role} {...rest}>
      <div className={styles.content}>
        {title && <div className={styles.title}>{title}</div>}
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {onDismiss && (
        <IconButton
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss"
          variant="ghost"
          size="xs"
          onClick={handleDismiss}
        >
          <Icon name="x" />
        </IconButton>
      )}
    </div>
  );
}
