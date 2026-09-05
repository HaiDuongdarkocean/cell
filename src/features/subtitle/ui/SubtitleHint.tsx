import styles from './SubtitleHint.module.css';

export interface SubtitleHintProps {
  title?: string;
  message?: string;
  onClick?: () => void;
}

export function SubtitleHint({
  title = 'Drop subtitle file here',
  message,
  onClick,
}: SubtitleHintProps): React.JSX.Element {
  return (
    <div
      className={styles.hint}
      data-cell-id="subtitle-hint"
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={title}
    >
      <div className={styles.dashedBox}>
        <span className={styles.title}>{title}</span>
        {message && <span className={styles.message}>{message}</span>}
      </div>
    </div>
  );
}
