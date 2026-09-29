import styles from './Header.module.css';
import { Button, HStack, Heading } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';

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
        <Heading level={1} className={styles.headerTitle}>tihoka</Heading>
      </HStack>
      <HStack align="center" gap="0-5" className={styles.headerRight}>
        {/* Extension on/off toggle — ghost when ON, danger-active when OFF */}
        <Button shape="circle"
          size="sm"
          variant={isActive ? 'ghost' : 'destructive'}
          active={!isActive}
          onClick={onToggleExtension}
          aria-label={t('popup.header.toggleExtension')}
          title={t('popup.header.toggleExtension')}
          aria-pressed={isActive}
        >
          {isActive ? (
            <Icon name="power" className={styles.icon} />
          ) : (
            <Icon name="power" className={styles.icon} />
          )}
        </Button>

        {/* Auto Download toggle — ghost, accent when ON */}
        <Button shape="circle"
          size="sm"
          variant="ghost"
          active={isAutoDownloadActive}
          onClick={onToggleAutoDownload}
          aria-label={t('popup.header.autoDownload')}
          aria-pressed={isAutoDownloadActive}
          title={isAutoDownloadActive ? t('popup.header.autoDownloadOn') : t('popup.header.autoDownloadOff')}
        >
          <Icon name="download" className={styles.icon} />
        </Button>

        {/* Theme toggle */}
        <Button shape="circle"
          size="sm"
          variant="ghost"
          onClick={onToggleTheme}
          aria-label={t('popup.header.toggleTheme')}
          title={t('popup.header.toggleTheme')}
        >
          {currentTheme === 'light' ? (
            <Icon name="moon" className={styles.iconMoon} />
          ) : (
            <Icon name="sun" className={styles.iconSun} />
          )}
        </Button>

        {/* Settings */}
        <Button shape="circle"
          size="sm"
          variant="ghost"
          onClick={onOpenSettings}
          aria-label={t('settings.title')}
          title={t('settings.title')}
        >
          <Icon name="settings" className={styles.icon} />
        </Button>
      </HStack>
    </header>
  );
}
