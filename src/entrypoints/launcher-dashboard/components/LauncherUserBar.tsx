import { Button, Icon } from '@/shared/ui';
import { useThemeStore } from '@/features/theme/logic/themeStore';
import type { PresetName, ThemeMode } from '@/entities/theme';
import { t } from '@/shared/i18n';
import type { MessageKey } from '@/shared/i18n';
import styles from './LauncherUserBar.module.css';

const PRESETS: readonly PresetName[] = ['dawn', 'forest', 'ocean', 'warmth'];

const MODE_LABEL_KEYS: Record<ThemeMode, MessageKey> = {
  light: 'theme.mode.light',
  dark: 'theme.mode.dark',
  system: 'theme.mode.system',
};

const PRESET_LABEL_KEYS: Record<PresetName, MessageKey> = {
  dawn: 'theme.preset.dawn',
  forest: 'theme.preset.forest',
  ocean: 'theme.preset.ocean',
  warmth: 'theme.preset.warmth',
};

export function LauncherUserBar() {
  const mode = useThemeStore((s) => s.mode);
  const switchMode = useThemeStore((s) => s.switchMode);
  const config = useThemeStore((s) => s.config);
  const switchPreset = useThemeStore((s) => s.switchPreset);

  const resolvedMode = mode === 'system' ? 'light' : mode;
  const themeIcon = resolvedMode === 'dark' ? 'moon' : 'sun';
  const modeLabel = t(MODE_LABEL_KEYS[mode]);
  const presetLabel = t(PRESET_LABEL_KEYS[config.preset]);

  const cycleMode = () => {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    switchMode(next);
  };

  const cyclePreset = () => {
    const current = config.preset;
    const index = PRESETS.indexOf(current);
    const next = PRESETS[(index + 1) % PRESETS.length];
    switchPreset(next);
  };

  return (
    <nav className={styles.userBar} aria-label={t('launcher.userBar.aria')}>
      <Button shape="circle"
        size="lg"
        variant="ghost"
        onClick={cycleMode}
        aria-label={t('launcher.userBar.theme', [modeLabel])}
        title={t('launcher.userBar.theme', [modeLabel])}
      >
        <Icon name={themeIcon} size="md" />
      </Button>
      <Button shape="circle"
        size="lg"
        variant="ghost"
        onClick={cyclePreset}
        aria-label={t('launcher.userBar.preset', [presetLabel])}
        title={t('launcher.userBar.preset', [presetLabel])}
      >
        <Icon name="layers" size="md" />
      </Button>
      <Button shape="circle"
        size="lg"
        variant="ghost"
        aria-label={t('settings.title')}
        title={t('settings.title')}
        disabled
      >
        <Icon name="settings" size="md" />
      </Button>
      <Button shape="circle"
        size="lg"
        variant="ghost"
        aria-label={t('launcher.userBar.add')}
        title={t('launcher.userBar.add')}
        disabled
      >
        <Icon name="plus" size="md" />
      </Button>
    </nav>
  );
}
