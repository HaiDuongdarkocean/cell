import styles from './Icon.module.css';

interface IconProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function Icon({
  children,
  size = 'md',
  className,
  label,
}: IconProps): React.JSX.Element {
  return (
    <span
      className={`${styles.icon} ${styles[size]} ${className || ''}`}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={!label}
    >
      {children}
    </span>
  );
}