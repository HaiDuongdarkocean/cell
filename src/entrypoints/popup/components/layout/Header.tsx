import styles from './Header.module.css';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';

interface HeaderProps {
  isActive: boolean;
  onToggleExtension: () => void;
  isAutoDownloadActive: boolean;
  onToggleAutoDownload: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  currentTheme: 'light' | 'dark';
}

export function Header({
  isActive,
  onToggleExtension,
  isAutoDownloadActive,
  onToggleAutoDownload,
  onToggleTheme,
  onOpenSettings,
  currentTheme,
}: HeaderProps): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Icon name="play" className={styles.headerIcon} />
        <h1 className={styles.headerTitle}>Video Downloader</h1>
      </div>
      <div className={styles.headerRight}>
        {/* Extension on/off toggle — ghost when ON, danger-active when OFF */}
        <IconButton
          variant={isActive ? 'ghost' : 'danger'}
          active={!isActive}
          onClick={onToggleExtension}
          aria-label="Toggle extension"
          title="Enable/Disable extension"
          aria-pressed={isActive}
        >
          {isActive ? (
            <Icon name="power" className={styles.icon} />
          ) : (
            <Icon name="power" className={styles.icon} />
          )}
        </IconButton>

        {/* Auto Download toggle — primary active when ON */}
        <IconButton
          active={isAutoDownloadActive}
          onClick={onToggleAutoDownload}
          aria-label="Toggle auto download for this site"
          aria-pressed={isAutoDownloadActive}
          title={isAutoDownloadActive ? 'Auto download: ON — URL sẽ tự tải khi ghé lại' : 'Auto download: OFF — click để whitelist trang này'}
        >
          <Icon name="download" className={styles.icon} />
        </IconButton>

        {/* Theme toggle */}
        <IconButton
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {currentTheme === 'light' ? (
            <Icon name="moon" className={styles.iconMoon} />
          ) : (
            <Icon name="sun" className={styles.iconSun} />
          )}
        </IconButton>

        {/* Settings */}
        <IconButton
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          {/* FIXME: extract to registry once stroke-width variant supported — path differs from ICON_CATALOG.settings (older cog vs newer gear) */}
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </IconButton>
      </div>
    </header>
  );
}
