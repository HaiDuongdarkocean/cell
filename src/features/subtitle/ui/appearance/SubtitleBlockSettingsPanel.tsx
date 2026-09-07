import type { ReactElement } from 'react';
import type { SubtitleBlockSettings } from '@/entities/settings';
import { Slider } from '@/shared/ui/Slider';
import { Label } from '@/shared/ui/Label';
import styles from './SubtitleBlockSettingsPanel.module.css';

interface SubtitleBlockSettingsPanelProps {
  /** Current block settings. */
  settings: SubtitleBlockSettings;
  /** Called with partial settings update whenever a control changes. */
  onChange: (partial: Partial<SubtitleBlockSettings>) => void;
}

/**
 * Subtitle block settings panel (ADR-025).
 * Shared position, global scale, and background opacity for the unified block.
 * iOS Settings card style — grouped rows in a rounded card.
 */
export function SubtitleBlockSettingsPanel({
  settings,
  onChange,
}: SubtitleBlockSettingsPanelProps): ReactElement {
  return (
    <div className={styles.container} data-cell-id="subtitle-block-settings-panel">
      <div className={styles.card}>
        {/* Position */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <Label className={styles.label} htmlFor="block-y-offset">
              Position
            </Label>
            <span className={styles.value}>{settings.yOffsetPercent}%</span>
          </div>
          <Slider
            id="block-y-offset"
            value={settings.yOffsetPercent}
            min={0}
            max={95}
            step={1}
            onChange={(v) => onChange({ yOffsetPercent: v })}
            aria-label="Vertical position"
            data-cell-id="block-y-offset"
          />
          <p className={styles.hint}>0% = top, 95% = bottom. Drag the block on video to reposition.</p>
        </div>

        {/* Size */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <Label className={styles.label} htmlFor="block-global-scale">
              Size
            </Label>
            <span className={styles.value}>{settings.globalScale.toFixed(1)}×</span>
          </div>
          <Slider
            id="block-global-scale"
            value={settings.globalScale}
            min={0.5}
            max={2}
            step={0.1}
            onChange={(v) => onChange({ globalScale: v })}
            aria-label="Scale"
            data-cell-id="block-global-scale"
          />
        </div>

        {/* Background */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <Label className={styles.label} htmlFor="block-bg-opacity">
              Background
            </Label>
            <span className={styles.value}>{Math.round(settings.bgOpacity * 100)}%</span>
          </div>
          <Slider
            id="block-bg-opacity"
            value={settings.bgOpacity}
            min={0}
            max={1}
            step={0.1}
            onChange={(v) => onChange({ bgOpacity: v })}
            aria-label="Block background opacity"
            data-cell-id="block-bg-opacity"
          />
        </div>
      </div>
    </div>
  );
}
