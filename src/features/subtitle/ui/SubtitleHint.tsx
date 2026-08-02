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
      role="button"
      aria-label={title}
    >
      <div className={styles.dashedBox}>
        <span className={styles.title}>{title}</span>
        {message && <span className={styles.message}>{message}</span>}
      </div>
    </div>
  );
}
