import { useState, type ReactElement } from 'react';
import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';
import { Button } from '@/shared/ui/Button';
import { Slider } from '@/shared/ui/Slider';
import { Select } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';
import styles from './SubtitleStylePanel.module.css';

interface SubtitleStylePanelProps {
  /** Which overlay layer this panel controls. */
  role: 'target' | 'native';
  /** Current style config. */
  style: OverlayStyleConfig;
  /** Called with partial style update whenever a control changes. */
  onChange: (partial: Partial<OverlayStyleConfig>) => void;
  /** Called when user confirms reset to defaults. */
  onReset: () => void;
  /** Default style for reset (passed by parent to avoid import coupling). */
  defaultStyle: OverlayStyleConfig;
}

const TEXT_SHADOW_PRESETS: readonly TextShadowConfig['preset'][] = ['none', 'soft', 'cinema', 'custom'];

const TEXT_SHADOW_LABELS: Record<TextShadowConfig['preset'], string> = {
  none: 'None',
  soft: 'Soft',
  cinema: 'Cinema',
  custom: 'Custom',
};

const HORIZONTAL_ALIGN_OPTIONS: readonly OverlayStyleConfig['horizontalAlign'][] = ['left', 'center', 'right'];

const ALIGN_LABELS: Record<OverlayStyleConfig['horizontalAlign'], string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
};

const FONT_FAMILY_OPTIONS = [
  { value: 'sans-serif', label: 'Sans-serif (system)' },
  { value: 'serif', label: 'Serif (system)' },
  { value: 'monospace', label: 'Monospace (system)' },
];

/**
 * Subtitle appearance control panel (ADR-013, ADR-025).
 * iOS Settings card style — grouped rows in rounded cards with
 * segmented controls for alignment + shadow.
 */
export function SubtitleStylePanel({
  role,
  style,
  onChange,
  onReset,
  defaultStyle,
}: SubtitleStylePanelProps): ReactElement {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [customFontOpen, setCustomFontOpen] = useState(false);
  const isCustomFont = !FONT_FAMILY_OPTIONS.some((opt) => opt.value === style.fontFamily);

  const handleShadowPresetChange = (preset: TextShadowConfig['preset']): void => {
    onChange({ textShadow: { ...style.textShadow, preset } });
  };

  const handleShadowFieldChange = (field: keyof Omit<TextShadowConfig, 'preset'>, value: string | number): void => {
    onChange({ textShadow: { ...style.textShadow, [field]: value } });
  };

  return (
    <div className={styles.container} data-cell-id={`subtitle-style-panel-${role}`}>
      {/* ─── Text section ─── */}
      <span className={styles.sectionHeader}>Text</span>
      <div className={styles.card}>
        {/* Font size */}
        <div className={styles.row}>
          <label className={styles.label} htmlFor={`style-${role}-font-size`}>
            Size
            <span className={styles.valueBadge}>{style.fontSize}px</span>
          </label>
          <Slider
            id={`style-${role}-font-size`}
            min={12}
            max={72}
            step={1}
            value={style.fontSize}
            onChange={(value) => onChange({ fontSize: value })}
            className={styles.slider}
            aria-label={`Font size ${style.fontSize} pixels`}
          />
        </div>

        {/* Font weight */}
        <div className={styles.row}>
          <label className={styles.label} htmlFor={`style-${role}-font-weight`}>
            Weight
            <span className={styles.valueBadge}>{style.fontWeight ?? defaultStyle.fontWeight}</span>
          </label>
          <Slider
            id={`style-${role}-font-weight`}
            min={100}
            max={900}
            step={100}
            value={style.fontWeight ?? defaultStyle.fontWeight}
            onChange={(value) => onChange({ fontWeight: value })}
            className={styles.slider}
            aria-label={`Font weight ${style.fontWeight ?? defaultStyle.fontWeight}`}
          />
        </div>

        {/* Font family */}
        <div className={styles.row}>
          <label className={styles.label} htmlFor={`style-${role}-font-family`}>Font</label>
          <Select
            id={`style-${role}-font-family`}
            value={isCustomFont ? '__custom__' : style.fontFamily}
            options={[
              ...FONT_FAMILY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
              { value: '__custom__', label: 'Custom…' },
            ]}
            onChange={(value) => {
              if (value === '__custom__') {
                setCustomFontOpen(true);
              } else {
                onChange({ fontFamily: value });
                setCustomFontOpen(false);
              }
            }}
            className={styles.select}
            aria-label="Font family"
          />
          {(customFontOpen || isCustomFont) && (
            <Input
              type="text"
              value={isCustomFont ? style.fontFamily : ''}
              placeholder="e.g. 'Noto Sans JP', sans-serif"
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className={styles.textInput}
              aria-label="Custom font family CSS string"
              data-cell-id={`style-${role}-font-family-custom`}
            />
          )}
        </div>

        {/* Text color + Background color */}
        <div className={styles.pairRow}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor={`style-${role}-text-color`}>
              Text Color
            </label>
            <input
              id={`style-${role}-text-color`}
              type="color"
              value={style.textColor}
              onChange={(e) => onChange({ textColor: e.target.value })}
              className={styles.colorInput}
              aria-label="Text color"
            />
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor={`style-${role}-bg-color`}>
              Background
            </label>
            <input
              id={`style-${role}-bg-color`}
              type="color"
              value={style.backgroundColor}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              className={styles.colorInput}
              aria-label="Background color"
            />
          </div>
        </div>
      </div>

      {/* ─── Opacity section ─── */}
      <span className={styles.sectionHeader}>Opacity</span>
      <div className={styles.card}>
        <div className={styles.pairRow}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor={`style-${role}-text-opacity`}>
              Text
              <span className={styles.valueBadge}>{style.textOpacity.toFixed(2)}</span>
            </label>
            <Slider
              id={`style-${role}-text-opacity`}
              min={0}
              max={1}
              step={0.05}
              value={style.textOpacity}
              onChange={(value) => onChange({ textOpacity: value })}
              className={styles.slider}
              aria-label={`Text opacity ${style.textOpacity}`}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor={`style-${role}-bg-opacity`}>
              Background
              <span className={styles.valueBadge}>{style.backgroundOpacity.toFixed(2)}</span>
            </label>
            <Slider
              id={`style-${role}-bg-opacity`}
              min={0}
              max={1}
              step={0.05}
              value={style.backgroundOpacity}
              onChange={(value) => onChange({ backgroundOpacity: value })}
              className={styles.slider}
              aria-label={`Background opacity ${style.backgroundOpacity}`}
            />
          </div>
        </div>
      </div>

      {/* ─── Layout section ─── */}
      <span className={styles.sectionHeader}>Layout</span>
      <div className={styles.card}>
        {/* Alignment — segmented control */}
        <div className={styles.row}>
          <label className={styles.label}>Alignment</label>
          <div className={styles.segmented} role="radiogroup" aria-label="Alignment">
            {HORIZONTAL_ALIGN_OPTIONS.map((align) => (
              <Button material="liquid" variant="secondary"
                key={align}
                role="radio"
                aria-checked={style.horizontalAlign === align}
                aria-label={`Align ${align}`}
                className={`${styles.segment} ${style.horizontalAlign === align ? styles.segmentActive : ''}`}
                onClick={() => onChange({ horizontalAlign: align })}
              >
                {ALIGN_LABELS[align]}
              </Button>
            ))}
          </div>
        </div>

        {/* Shadow — segmented control */}
        <div className={styles.row}>
          <label className={styles.label}>Shadow</label>
          <div className={styles.segmented} role="radiogroup" aria-label="Shadow style">
            {TEXT_SHADOW_PRESETS.map((preset) => (
              <Button material="liquid" variant="secondary"
                key={preset}
                role="radio"
                aria-checked={style.textShadow.preset === preset}
                aria-label={`${TEXT_SHADOW_LABELS[preset]} shadow`}
                className={`${styles.segment} ${style.textShadow.preset === preset ? styles.segmentActive : ''}`}
                onClick={() => handleShadowPresetChange(preset)}
              >
                {TEXT_SHADOW_LABELS[preset]}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom shadow fields */}
        {style.textShadow.preset === 'custom' && (
          <div className={styles.customShadowRow}>
            <div className={styles.row}>
              <label className={styles.label} htmlFor={`style-${role}-shadow-color`}>Shadow Color</label>
              <input
                id={`style-${role}-shadow-color`}
                type="color"
                value={style.textShadow.color}
                onChange={(e) => handleShadowFieldChange('color', e.target.value)}
                className={styles.colorInput}
                aria-label="Shadow color"
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor={`style-${role}-shadow-blur`}>
                Blur
                <span className={styles.valueBadge}>{style.textShadow.blur}px</span>
              </label>
              <Input
                id={`style-${role}-shadow-blur`}
                type="number"
                min={0}
                max={20}
                step={1}
                value={style.textShadow.blur}
                onChange={(e) => handleShadowFieldChange('blur', Number(e.target.value))}
                className={styles.numberInput}
                aria-label="Shadow blur pixels"
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor={`style-${role}-shadow-offset-x`}>
                Offset X
                <span className={styles.valueBadge}>{style.textShadow.offsetX}px</span>
              </label>
              <Input
                id={`style-${role}-shadow-offset-x`}
                type="number"
                min={-10}
                max={10}
                step={1}
                value={style.textShadow.offsetX}
                onChange={(e) => handleShadowFieldChange('offsetX', Number(e.target.value))}
                className={styles.numberInput}
                aria-label="Shadow offset X pixels"
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor={`style-${role}-shadow-offset-y`}>
                Offset Y
                <span className={styles.valueBadge}>{style.textShadow.offsetY}px</span>
              </label>
              <Input
                id={`style-${role}-shadow-offset-y`}
                type="number"
                min={-10}
                max={10}
                step={1}
                value={style.textShadow.offsetY}
                onChange={(e) => handleShadowFieldChange('offsetY', Number(e.target.value))}
                className={styles.numberInput}
                aria-label="Shadow offset Y pixels"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Reset ─── */}
      <div className={styles.resetRow}>
        {!showResetConfirm ? (
          <Button material="liquid"
            variant="ghost"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            aria-label={`Reset ${role} style to defaults`}
            data-cell-id={`style-${role}-reset`}
          >
            Reset
          </Button>
        ) : (
          <div className={styles.confirmRow} data-cell-id={`style-${role}-reset-confirm`}>
            <span>Reset to defaults?</span>
            <Button material="liquid" variant="destructive" size="sm" onClick={() => { onReset(); setShowResetConfirm(false); }}>
              Reset
            </Button>
            <Button material="liquid" variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Hidden reference to defaultStyle */}
      <span hidden data-default-style={JSON.stringify(defaultStyle)} />
    </div>
  );
}
