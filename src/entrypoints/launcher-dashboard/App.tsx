import { useMemo, useState } from 'react';
import { LauncherBackground } from './components/LauncherBackground';
import { LauncherSearchBar } from './components/LauncherSearchBar';
import { LauncherTile } from './components/LauncherTile';
import { LauncherUserBar } from './components/LauncherUserBar';
import { LAUNCHER_TILES } from './data/launcherTiles';
import styles from './App.module.css';

export function App() {
  const [query, setQuery] = useState('');

  const filteredTiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return LAUNCHER_TILES;
    return LAUNCHER_TILES.filter(
      (tile) =>
        tile.label.toLowerCase().includes(normalized) ||
        tile.keywords.some((keyword) => keyword.includes(normalized)),
    );
  }, [query]);

  return (
    <div className={styles.app}>
      <LauncherBackground />
      <div className={styles.container}>
        <header className={styles.header}>
          <LauncherSearchBar value={query} onChange={setQuery} placeholder="Search Cell…" />
        </header>
        <main className={styles.main}>
          <ul className={styles.grid}>
            {filteredTiles.map((tile) => (
              <li key={tile.id} className={styles.tileWrapper}>
                <LauncherTile icon={tile.icon} label={tile.label} />
              </li>
            ))}
          </ul>
        </main>
        <footer className={styles.footer}>
          <LauncherUserBar />
        </footer>
      </div>
    </div>
  );
}
