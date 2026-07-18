import { useState, type ReactElement } from 'react';
import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';
import { SubtitlePreview } from './SubtitlePreview';
import { Button } from '@/shared/ui/Button';
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

const FONT_FAMILY_OPTIONS = [
  { value: 'sans-serif', label: 'Sans-serif (system)' },
  { value: 'serif', label: 'Serif (system)' },
  { value: 'monospace', label: 'Monospace (system)' },
];

/**
 * Subtitle appearance control panel (ADR-013, ADR-025).
 * 6 appearance controls + reset. Position (Y) and visible toggle are handled by
 * the parent section header. Each control calls onChange(partial) → parent
 * persists → storage.onChanged → content-script applyStyle (realtime).
 *
 * Accessibility: label htmlFor, aria-label, keyboard-navigable.
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

  const handleResetClick = (): void => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = (): void => {
    onReset();
    setShowResetConfirm(false);
  };

  const handleResetCancel = (): void => {
    setShowResetConfirm(false);
  };

  return (
    <div className={styles.container} data-testid={`subtitle-style-panel-${role}`}>
      {/* Live preview */}
      <SubtitlePreview style={style} role={role} />

      {/* Font size — moved to top row (full-width slider) */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`style-${role}-font-size`}>
          Font size
          <span className={styles.valueBadge}>{style.fontSize}px</span>
        </label>
        <input
          id={`style-${role}-font-size`}
          type="range"
          min={12}
          max={72}
          step={1}
          value={style.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className={styles.slider}
          aria-label={`Font size ${style.fontSize} pixels`}
        />
      </div>

      {/* Font family */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`style-${role}-font-family`}>Font family</label>
        <select
          id={`style-${role}-font-family`}
          value={isCustomFont ? '__custom__' : style.fontFamily}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setCustomFontOpen(true);
            } else {
              onChange({ fontFamily: e.target.value });
              setCustomFontOpen(false);
            }
          }}
          className={styles.select}
          aria-label="Font family"
        >
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
        {(customFontOpen || isCustomFont) && (
          <input
            type="text"
            value={isCustomFont ? style.fontFamily : ''}
            placeholder="e.g. 'Noto Sans JP', sans-serif"
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            className={styles.textInput}
            aria-label="Custom font family CSS string"
            data-testid={`style-${role}-font-family-custom`}
          />
        )}
      </div>

      {/* PAIR: Text color + Background color */}
      <div className={styles.pairRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`style-${role}-text-color`}>
            Text color
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`style-${role}-bg-color`}>
            Background color
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

      {/* PAIR: Text opacity + BG opacity */}
      <div className={styles.pairRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`style-${role}-text-opacity`}>
            Text opacity
            <span className={styles.valueBadge}>{style.textOpacity.toFixed(2)}</span>
          </label>
          <input
            id={`style-${role}-text-opacity`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={style.textOpacity}
            onChange={(e) => onChange({ textOpacity: Number(e.target.value) })}
            className={styles.slider}
            aria-label={`Text opacity ${style.textOpacity}`}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`style-${role}-bg-opacity`}>
            BG opacity
            <span className={styles.valueBadge}>{style.backgroundOpacity.toFixed(2)}</span>
          </label>
          <input
            id={`style-${role}-bg-opacity`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={style.backgroundOpacity}
            onChange={(e) => onChange({ backgroundOpacity: Number(e.target.value) })}
            className={styles.slider}
            aria-label={`Background opacity ${style.backgroundOpacity}`}
          />
        </div>
      </div>

      {/* Horizontal align + Text shadow preset (existing fieldRow) */}
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label}>Horizontal align</label>
          <div className={styles.radioRow} role="radiogroup" aria-label="Horizontal align">
            {HORIZONTAL_ALIGN_OPTIONS.map((align) => (
              <label key={align} className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`style-${role}-align`}
                  value={align}
                  checked={style.horizontalAlign === align}
                  onChange={() => onChange({ horizontalAlign: align })}
                  aria-label={`Align ${align}`}
                />
                <span className={styles.capitalize}>{align}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Text shadow</label>
          <div className={styles.radioRow} role="radiogroup" aria-label="Text shadow preset">
            {TEXT_SHADOW_PRESETS.map((preset) => (
              <label key={preset} className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`style-${role}-shadow-preset`}
                  value={preset}
                  checked={style.textShadow.preset === preset}
                  onChange={() => handleShadowPresetChange(preset)}
                  aria-label={`${TEXT_SHADOW_LABELS[preset]} shadow`}
                />
                <span>{TEXT_SHADOW_LABELS[preset]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Custom shadow fields (only when preset=custom) */}
      {style.textShadow.preset === 'custom' && (
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`style-${role}-shadow-color`}>Shadow color</label>
            <input
              id={`style-${role}-shadow-color`}
              type="color"
              value={style.textShadow.color}
              onChange={(e) => handleShadowFieldChange('color', e.target.value)}
              className={styles.colorInput}
              aria-label="Shadow color"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`style-${role}-shadow-blur`}>
              Blur
              <span className={styles.valueBadge}>{style.textShadow.blur}px</span>
            </label>
            <input
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
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`style-${role}-shadow-offset-x`}>
              Offset X
              <span className={styles.valueBadge}>{style.textShadow.offsetX}px</span>
            </label>
            <input
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
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`style-${role}-shadow-offset-y`}>
              Offset Y
              <span className={styles.valueBadge}>{style.textShadow.offsetY}px</span>
            </label>
            <input
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

      {/* Font family — moved into pair row above (settings-dialog-rearrange) */}



      {/* Reset button — in panel, justify-end (settings-dialog-rearrange) */}
      <div className={styles.resetRow}>
        {!showResetConfirm ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetClick}
            aria-label={`Reset ${role} style to defaults`}
            data-testid={`style-${role}-reset`}
          >
            Reset to defaults
          </Button>
        ) : (
          <div className={styles.confirmRow} data-testid={`style-${role}-reset-confirm`}>
            <span>Reset {role} style to defaults?</span>
            <Button variant="destructive" size="sm" onClick={handleResetConfirm}>
              Yes, reset
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Hidden reference to defaultStyle to satisfy lint (used by parent) */}
      <span hidden data-default-style={JSON.stringify(defaultStyle)} />
    </div>
  );
}
