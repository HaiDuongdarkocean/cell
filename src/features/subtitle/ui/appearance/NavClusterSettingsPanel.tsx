import type { ReactElement } from 'react';
import type { NavClusterSettings } from '@/entities/settings';
import { Button } from '@/shared/ui';
import { Slider } from '@/shared/ui/Slider';
import { t, type MessageKey } from '@/shared/i18n';
import styles from './NavClusterSettingsPanel.module.css';

interface NavClusterSettingsPanelProps {
  /** Current nav cluster settings. */
  settings: NavClusterSettings;
  /** Called with partial settings update whenever a control changes. */
  onChange: (partial: Partial<NavClusterSettings>) => void;
}

/** Button size slider bounds (ADR-018 D2-rev: free range 10-100px). */
const BUTTON_SIZE_MIN = 10;
const BUTTON_SIZE_MAX = 100;

/** Overlay appearance presets (feather blur 1px hardcoded). */
const PRESETS: ReadonlyArray<{ id: string; key: MessageKey; textOpacity: number; bgOpacity: number }> = [
  { id: 'frosted', key: 'subtitle.navSettings.preset.frosted', textOpacity: 1, bgOpacity: 0.2 },
  { id: 'glass', key: 'subtitle.navSettings.preset.glass', textOpacity: 1, bgOpacity: 0 },
  { id: 'muted', key: 'subtitle.navSettings.preset.muted', textOpacity: 0.8, bgOpacity: 0.4 },
  { id: 'solid', key: 'subtitle.navSettings.preset.solid', textOpacity: 0.6, bgOpacity: 0.8 },
];

/**
 * Nav cluster settings panel (ADR-018 D2, ADR-025).
 * iOS Settings card style — grouped rows + preset pills.
 */
export function NavClusterSettingsPanel({
  settings,
  onChange,
}: NavClusterSettingsPanelProps): ReactElement {
  const handlePreset = (preset: { textOpacity: number; bgOpacity: number }): void => {
    onChange({ textOpacity: preset.textOpacity, bgOpacity: preset.bgOpacity });
  };

  return (
    <div className={styles.container} data-cell-id="nav-cluster-settings-panel">
      {/* ─── Controls card ─── */}
      <div className={styles.card}>
        {/* Button size */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <label className={styles.label} htmlFor="nav-cluster-button-size">{t('subtitle.navSettings.buttonSize')}</label>
            <span className={styles.value}>{settings.buttonSize}px</span>
          </div>
          <Slider
            id="nav-cluster-button-size"
            value={settings.buttonSize}
            min={BUTTON_SIZE_MIN}
            max={BUTTON_SIZE_MAX}
            step={1}
            onChange={(v) => onChange({ buttonSize: v })}
            aria-label={t('subtitle.navSettings.buttonSize')}
            data-cell-id="nav-cluster-button-size"
          />
        </div>

        {/* Icon opacity */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <label className={styles.label} htmlFor="nav-cluster-text-opacity">{t('subtitle.navSettings.icon')}</label>
            <span className={styles.value}>{Math.round(settings.textOpacity * 100)}%</span>
          </div>
          <Slider
            id="nav-cluster-text-opacity"
            value={settings.textOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => onChange({ textOpacity: v })}
            aria-label={t('subtitle.navSettings.iconOpacityAria')}
            data-cell-id="nav-cluster-text-opacity"
          />
        </div>

        {/* Button opacity */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <label className={styles.label} htmlFor="nav-cluster-bg-opacity">{t('subtitle.style.background')}</label>
            <span className={styles.value}>{Math.round(settings.bgOpacity * 100)}%</span>
          </div>
          <Slider
            id="nav-cluster-bg-opacity"
            value={settings.bgOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => onChange({ bgOpacity: v })}
            aria-label={t('subtitle.navSettings.buttonOpacityAria')}
            data-cell-id="nav-cluster-bg-opacity"
          />
        </div>
      </div>

      {/* ─── Style presets ─── */}
      <span className={styles.sectionHeader}>{t('subtitle.navSettings.style')}</span>
      <div className={styles.presetRow} role="group" aria-label={t('subtitle.navSettings.presetsAria')}>
        {PRESETS.map((preset) => {
          const isActive =
            settings.textOpacity === preset.textOpacity &&
            settings.bgOpacity === preset.bgOpacity;
          return (
            <Button
              key={preset.id}
              variant="primary"
              size="sm"
              active={isActive}
              aria-pressed={isActive}
              onClick={() => handlePreset(preset)}
              data-cell-id={`nav-cluster-preset-${preset.id}`}
            >
              {t(preset.key)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
