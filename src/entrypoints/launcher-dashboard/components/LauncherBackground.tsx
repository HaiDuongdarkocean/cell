import styles from './LauncherBackground.module.css';

export function LauncherBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
      <div className={styles.overlay} />
    </div>
  );
}
