import { IconButton, Icon } from '@/shared/ui';
import { useThemeStore } from '@/stores/themeStore';
import type { PresetName } from '@/entities/theme';
import styles from './LauncherUserBar.module.css';

const PRESETS: readonly (PresetName | undefined)[] = ['dawn', 'forest', 'ocean', 'warmth', undefined];

export function LauncherUserBar() {
  const mode = useThemeStore((s) => s.mode);
  const switchMode = useThemeStore((s) => s.switchMode);
  const config = useThemeStore((s) => s.config);
  const switchPreset = useThemeStore((s) => s.switchPreset);

  const resolvedMode = mode === 'system' ? 'light' : mode;
  const themeIcon = resolvedMode === 'dark' ? 'moon' : 'sun';

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
    <nav className={styles.userBar} aria-label="User actions">
      <IconButton
        size="lg"
        variant="glass"
        onClick={cycleMode}
        aria-label={`Theme: ${mode}`}
        title={`Theme: ${mode}`}
      >
        <Icon name={themeIcon} size="md" />
      </IconButton>
      <IconButton
        size="lg"
        variant="glass"
        onClick={cyclePreset}
        aria-label={`Preset: ${config.preset ?? 'default'}`}
        title={`Preset: ${config.preset ?? 'default'}`}
      >
        <Icon name="layers" size="md" />
      </IconButton>
      <IconButton
        size="lg"
        variant="glass"
        aria-label="Settings"
        title="Settings"
      >
        <Icon name="settings" size="md" />
      </IconButton>
      <IconButton
        size="lg"
        variant="glass"
        aria-label="Add"
        title="Add"
      >
        <Icon name="plus" size="md" />
      </IconButton>
    </nav>
  );
}
