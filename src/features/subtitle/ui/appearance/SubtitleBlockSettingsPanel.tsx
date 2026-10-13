import type { ReactElement } from 'react';
import type { SubtitleBlockSettings } from '@/entities/settings';
import { Slider } from '@/shared/ui/Slider';
import { Label } from '@/shared/ui/Label';
import { t } from '@/shared/i18n';
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
    <div className={styles.container} data-tihoka-id="subtitle-block-settings-panel">
      <div className={styles.card}>
        {/* Position */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <Label className={styles.label} htmlFor="block-y-offset">
              {t('subtitle.blockSettings.position')}
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
            aria-label={t('subtitle.blockSettings.positionAria')}
            data-tihoka-id="block-y-offset"
          />
          <p className={styles.hint}>{t('subtitle.blockSettings.positionHint')}</p>
        </div>

        {/* Size */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <Label className={styles.label} htmlFor="block-global-scale">
              {t('subtitle.style.size')}
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
            aria-label={t('subtitle.blockSettings.scaleAria')}
            data-tihoka-id="block-global-scale"
          />
        </div>

        {/* Background */}
        <div className={styles.row}>
          <div className={styles.sliderHeader}>
            <Label className={styles.label} htmlFor="block-bg-opacity">
              {t('subtitle.style.background')}
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
            aria-label={t('subtitle.blockSettings.bgOpacityAria')}
            data-tihoka-id="block-bg-opacity"
          />
        </div>
      </div>
    </div>
  );
}
