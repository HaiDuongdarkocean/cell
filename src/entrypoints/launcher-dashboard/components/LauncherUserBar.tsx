import { Button, Icon } from '@/shared/ui';
import { useThemeStore } from '@/stores/themeStore';
import type { PresetName } from '@/entities/theme';
import styles from './LauncherUserBar.module.css';

const PRESETS: readonly PresetName[] = ['dawn', 'forest', 'ocean', 'warmth'];

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
      <Button shape="circle" material="solid"
        size="lg"
        variant="ghost"
        onClick={cycleMode}
        aria-label={`Theme: ${mode}`}
        title={`Theme: ${mode}`}
      >
        <Icon name={themeIcon} size="md" />
      </Button>
      <Button shape="circle" material="solid"
        size="lg"
        variant="ghost"
        onClick={cyclePreset}
        aria-label={`Preset: ${config.preset}`}
        title={`Preset: ${config.preset}`}
      >
        <Icon name="layers" size="md" />
      </Button>
      <Button shape="circle" material="solid"
        size="lg"
        variant="ghost"
        aria-label="Settings"
        title="Settings"
        disabled
      >
        <Icon name="settings" size="md" />
      </Button>
      <Button shape="circle" material="solid"
        size="lg"
        variant="ghost"
        aria-label="Add"
        title="Add"
        disabled
      >
        <Icon name="plus" size="md" />
      </Button>
    </nav>
  );
}
