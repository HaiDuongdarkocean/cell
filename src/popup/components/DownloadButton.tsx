import styles from './DownloadButton.module.css';

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  variant?: 'single' | 'all';
}

const defaultLabelFor = (variant: 'single' | 'all'): string =>
  variant === 'all' ? 'Download All' : 'Download';

export function DownloadButton({
  onClick,
  disabled = false,
  label,
  variant = 'single',
}: DownloadButtonProps): React.JSX.Element {
  const text = label ?? defaultLabelFor(variant);

  const className = [styles.button, styles.primary, disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      data-testid="download-button"
    >
      {text}
    </button>
  );
}
