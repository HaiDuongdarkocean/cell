import { LauncherBackground } from './components/LauncherBackground';
import styles from './App.module.css';

const PLACEHOLDER_TILES = [
  'Dictionary',
  'Subtitle Manager',
  'Settings',
  'History',
  'Reader',
  'Local Player',
  'Help',
];

export function App() {
  return (
    <div className={styles.app}>
      <LauncherBackground />
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.searchPlaceholder} role="search" aria-label="Search Cell features" />
        </header>
        <main className={styles.main}>
          <ul className={styles.grid}>
            {PLACEHOLDER_TILES.map((label) => (
              <li key={label} className={styles.tilePlaceholder}>
                {label}
              </li>
            ))}
          </ul>
        </main>
        <footer className={styles.footer}>
          <div className={styles.userBarPlaceholder} aria-label="User actions" />
        </footer>
      </div>
    </div>
  );
}
