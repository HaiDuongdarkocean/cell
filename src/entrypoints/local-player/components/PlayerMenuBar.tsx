import { Button } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './PlayerMenuBar.module.css';

interface PlayerMenuBarProps {
  /** Loaded video filename, or null when no file is loaded. */
  filename: string | null;
  /** Whether the library panel is currently open (toggles button highlight). */
  isLibraryOpen: boolean;
  /** Called when the user clicks "File" (open file picker). */
  onOpenFile: () => void;
  /** Called when the user clicks "Folder" (open folder picker). */
  onOpenFolder: () => void;
  /** Called when the user clicks "Library". */
  onToggleLibrary: () => void;
}

/**
 * PlayerMenuBar — top bar of the local player page.
 *
 * Left: app title + current filename (or "No file loaded" placeholder).
 * Right: Open pill (File | Folder) + Library toggle button.
 * Responsive: on narrow viewports the title shrinks and buttons collapse to
 * icon-only labels hidden via CSS.
 */
export function PlayerMenuBar({
  filename,
  isLibraryOpen,
  onOpenFile,
  onOpenFolder,
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
        <div className={styles.openPill} role="group" aria-label="Open media">
          <button
            type="button"
            className={styles.openPillBtn}
            onClick={onOpenFile}
            aria-label="Open file"
          >
            <Icon name="fileVideo" size={16} />
            <span className={styles.btnLabel}>File</span>
          </button>
          <span className={styles.openPillDivider} aria-hidden="true" />
          <button
            type="button"
            className={styles.openPillBtn}
            onClick={onOpenFolder}
            aria-label="Open folder"
          >
            <Icon name="folderOpen" size={16} />
            <span className={styles.btnLabel}>Folder</span>
          </button>
        </div>

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
