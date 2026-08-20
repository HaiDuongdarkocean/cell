import { Button } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './PlayerMenuBar.module.css';

interface PlayerMenuBarProps {
  /** Loaded video filename, or null when no file is loaded. */
  filename: string | null;
  /** Whether the library panel is currently open (toggles button highlight). */
  isLibraryOpen: boolean;
  /** Called when the user clicks "Open file". */
  onOpenFile: () => void;
  /** Called when the user clicks "Library". */
  onToggleLibrary: () => void;
}

/**
 * PlayerMenuBar — top bar of the local player page.
 *
 * Left: app title + current filename (or "No file loaded" placeholder).
 * Right: "Open file" + "Library" toggle buttons.
 * Responsive: on narrow viewports the title shrinks and buttons collapse to
 * icon-only labels hidden via CSS.
 */
export function PlayerMenuBar({
  filename,
  isLibraryOpen,
  onOpenFile,
  onToggleLibrary,
}: PlayerMenuBarProps): React.JSX.Element {
  return (
    <header className={styles.bar} data-cell-id="player-menu-bar">
      <div className={styles.left}>
        <h1 className={styles.title}>Local Player</h1>
        <span className={styles.filename} data-cell-id="player-menu-filename">
          <Icon name="fileVideo" size={16} className={styles.fileIcon} />
          {filename ?? 'No file loaded'}
        </span>
      </div>

      <div className={styles.right}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenFile}
          leadingIcon={<Icon name="folderOpen" size={18} />}
          aria-label="Open file"
        >
          <span className={styles.btnLabel}>Open file</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          active={isLibraryOpen}
          onClick={onToggleLibrary}
          leadingIcon={<Icon name="library" size={18} />}
          aria-label="Library"
          aria-pressed={isLibraryOpen}
        >
          <span className={styles.btnLabel}>Library</span>
        </Button>
      </div>
    </header>
  );
}
