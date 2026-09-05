import styles from './Header.module.css';
import { Button, HStack } from '@/shared/ui';
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
      <HStack align="center" gap="2" className={styles.headerLeft}>
        <Icon name="play" className={styles.headerIcon} />
        <h1 className={styles.headerTitle}>Cell</h1>
      </HStack>
      <HStack align="center" gap="0-5" className={styles.headerRight}>
        {/* Extension on/off toggle — ghost when ON, danger-active when OFF */}
        <Button shape="circle" material="solid"
          size="sm"
          variant={isActive ? 'ghost' : 'destructive'}
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
        </Button>

        {/* Auto Download toggle — primary active when ON */}
        <Button shape="circle" material="solid"
          size="sm"
          active={isAutoDownloadActive}
          onClick={onToggleAutoDownload}
          aria-label="Toggle auto download for this site"
          aria-pressed={isAutoDownloadActive}
          title={isAutoDownloadActive ? 'Auto download: ON — URL sẽ tự tải khi ghé lại' : 'Auto download: OFF — click để whitelist trang này'}
        >
          <Icon name="download" className={styles.icon} />
        </Button>

        {/* Theme toggle */}
        <Button shape="circle" material="solid"
          size="sm"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {currentTheme === 'light' ? (
            <Icon name="moon" className={styles.iconMoon} />
          ) : (
            <Icon name="sun" className={styles.iconSun} />
          )}
        </Button>

        {/* Settings */}
        <Button shape="circle" material="solid"
          size="sm"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <Icon name="settings" className={styles.icon} />
        </Button>
      </HStack>
    </header>
  );
}
