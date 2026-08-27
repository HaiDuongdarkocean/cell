import styles from './LauncherBackground.module.css';

export function LauncherBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />
      <div className={styles.overlay} />
    </div>
  );
}
