import { useState, type ReactElement } from 'react';
import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';
import { Button } from '@/shared/ui/Button';
import { Slider } from '@/shared/ui/Slider';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Select } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';
import { ColorInput } from '@/shared/ui/ColorInput';
import { Label } from '@/shared/ui/Label';
import { t, type MessageKey } from '@/shared/i18n';
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

const TEXT_SHADOW_KEY: Record<TextShadowConfig['preset'], MessageKey> = {
  none: 'subtitle.style.shadowPreset.none',
  soft: 'subtitle.style.shadowPreset.soft',
  cinema: 'subtitle.style.shadowPreset.cinema',
  custom: 'subtitle.style.shadowPreset.custom',
};

const HORIZONTAL_ALIGN_OPTIONS: readonly OverlayStyleConfig['horizontalAlign'][] = ['left', 'center', 'right'];

const ALIGN_KEY: Record<OverlayStyleConfig['horizontalAlign'], MessageKey> = {
  left: 'subtitle.style.align.left',
  center: 'subtitle.style.align.center',
  right: 'subtitle.style.align.right',
};

const FONT_FAMILY_OPTIONS: readonly { value: string; key: MessageKey }[] = [
  { value: 'sans-serif', key: 'subtitle.style.font.sansSerif' },
  { value: 'serif', key: 'subtitle.style.font.serif' },
  { value: 'monospace', key: 'subtitle.style.font.monospace' },
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
      <span className={styles.sectionHeader}>{t('subtitle.style.sectionText')}</span>
      <div className={styles.card}>
        {/* Font size */}
        <div className={styles.row}>
          <Label className={styles.label} htmlFor={`style-${role}-font-size`}>
            {t('subtitle.style.size')}
            <span className={styles.valueBadge}>{style.fontSize}px</span>
          </Label>
          <Slider
            id={`style-${role}-font-size`}
            min={12}
            max={72}
            step={1}
            value={style.fontSize}
            onChange={(value) => onChange({ fontSize: value })}
            size="compact"
            aria-label={t('subtitle.style.fontSizeAria', [style.fontSize])}
          />
        </div>

        {/* Font weight */}
        <div className={styles.row}>
          <Label className={styles.label} htmlFor={`style-${role}-font-weight`}>
            {t('subtitle.style.weight')}
            <span className={styles.valueBadge}>{style.fontWeight ?? defaultStyle.fontWeight}</span>
          </Label>
          <Slider
            id={`style-${role}-font-weight`}
            min={100}
            max={900}
            step={100}
            value={style.fontWeight ?? defaultStyle.fontWeight}
            onChange={(value) => onChange({ fontWeight: value })}
            size="compact"
            aria-label={t('subtitle.style.fontWeightAria', [style.fontWeight ?? defaultStyle.fontWeight])}
          />
        </div>

        {/* Font family */}
        <div className={styles.row}>
          <Label className={styles.label} htmlFor={`style-${role}-font-family`}>{t('subtitle.style.font')}</Label>
          <Select
            id={`style-${role}-font-family`}
            value={isCustomFont ? '__custom__' : style.fontFamily}
            options={[
              ...FONT_FAMILY_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.key) })),
              { value: '__custom__', label: t('subtitle.style.fontCustom') },
            ]}
            onChange={(value) => {
              if (value === '__custom__') {
                setCustomFontOpen(true);
              } else {
                onChange({ fontFamily: value });
                setCustomFontOpen(false);
              }
            }}
            aria-label={t('subtitle.style.fontFamilyAria')}
          />
          {(customFontOpen || isCustomFont) && (
            <Input
              type="text"
              value={isCustomFont ? style.fontFamily : ''}
              placeholder={t('subtitle.style.fontCustomPlaceholder')}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              aria-label={t('subtitle.style.fontCustomAria')}
              data-cell-id={`style-${role}-font-family-custom`}
            />
          )}
        </div>

        {/* Text color + Background color */}
        <div className={styles.pairRow}>
          <div className={styles.row}>
            <Label className={styles.label} htmlFor={`style-${role}-text-color`}>
              {t('subtitle.style.textColor')}
            </Label>
            <ColorInput
              id={`style-${role}-text-color`}
              value={style.textColor}
              onChange={(e) => onChange({ textColor: e.target.value })}
              aria-label={t('subtitle.style.textColorAria')}
            />
          </div>
          <div className={styles.row}>
            <Label className={styles.label} htmlFor={`style-${role}-bg-color`}>
              {t('subtitle.style.background')}
            </Label>
            <ColorInput
              id={`style-${role}-bg-color`}
              value={style.backgroundColor}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              aria-label={t('subtitle.style.backgroundColorAria')}
            />
          </div>
        </div>
      </div>

      {/* ─── Opacity section ─── */}
      <span className={styles.sectionHeader}>{t('subtitle.style.sectionOpacity')}</span>
      <div className={styles.card}>
        <div className={styles.pairRow}>
          <div className={styles.row}>
            <Label className={styles.label} htmlFor={`style-${role}-text-opacity`}>
              {t('subtitle.style.sectionText')}
              <span className={styles.valueBadge}>{style.textOpacity.toFixed(2)}</span>
            </Label>
            <Slider
              id={`style-${role}-text-opacity`}
              min={0}
              max={1}
              step={0.05}
              value={style.textOpacity}
              onChange={(value) => onChange({ textOpacity: value })}
              size="compact"
              aria-label={t('subtitle.style.textOpacityAria', [style.textOpacity])}
            />
          </div>
          <div className={styles.row}>
            <Label className={styles.label} htmlFor={`style-${role}-bg-opacity`}>
              {t('subtitle.style.background')}
              <span className={styles.valueBadge}>{style.backgroundOpacity.toFixed(2)}</span>
            </Label>
            <Slider
              id={`style-${role}-bg-opacity`}
              min={0}
              max={1}
              step={0.05}
              value={style.backgroundOpacity}
              onChange={(value) => onChange({ backgroundOpacity: value })}
              size="compact"
              aria-label={t('subtitle.style.bgOpacityAria', [style.backgroundOpacity])}
            />
          </div>
        </div>
      </div>

      {/* ─── Layout section ─── */}
      <span className={styles.sectionHeader}>{t('subtitle.style.sectionLayout')}</span>
      <div className={styles.card}>
        {/* Alignment — segmented control */}
        <div className={styles.row}>
          <Label className={styles.label}>{t('subtitle.style.alignment')}</Label>
          <SegmentedControl
            variant="raised"
            ariaLabel={t('subtitle.style.alignment')}
            options={HORIZONTAL_ALIGN_OPTIONS.map((align) => ({
              value: align,
              label: t(ALIGN_KEY[align]),
              ariaLabel: t('subtitle.style.alignAria', [t(ALIGN_KEY[align])]),
            }))}
            value={style.horizontalAlign}
            onChange={(horizontalAlign) => onChange({ horizontalAlign })}
          />
        </div>

        {/* Shadow — segmented control */}
        <div className={styles.row}>
          <Label className={styles.label}>{t('subtitle.style.shadow')}</Label>
          <SegmentedControl
            variant="raised"
            ariaLabel={t('subtitle.style.shadowAria')}
            options={TEXT_SHADOW_PRESETS.map((preset) => ({
              value: preset,
              label: t(TEXT_SHADOW_KEY[preset]),
              ariaLabel: t('subtitle.style.shadowOptionAria', [t(TEXT_SHADOW_KEY[preset])]),
            }))}
            value={style.textShadow.preset}
            onChange={handleShadowPresetChange}
          />
        </div>

        {/* Custom shadow fields */}
        {style.textShadow.preset === 'custom' && (
          <div className={styles.customShadowRow}>
            <div className={styles.row}>
              <Label className={styles.label} htmlFor={`style-${role}-shadow-color`}>{t('subtitle.style.shadowColor')}</Label>
              <ColorInput
                id={`style-${role}-shadow-color`}
                value={style.textShadow.color}
                onChange={(e) => handleShadowFieldChange('color', e.target.value)}
                aria-label={t('subtitle.style.shadowColorAria')}
              />
            </div>
            <div className={styles.row}>
              <Label className={styles.label} htmlFor={`style-${role}-shadow-blur`}>
                {t('subtitle.style.blur')}
                <span className={styles.valueBadge}>{style.textShadow.blur}px</span>
              </Label>
              <Input
                id={`style-${role}-shadow-blur`}
                type="number"
                min={0}
                max={20}
                step={1}
                value={style.textShadow.blur}
                onChange={(e) => handleShadowFieldChange('blur', Number(e.target.value))}
                  aria-label={t('subtitle.style.shadowBlurAria')}
              />
            </div>
            <div className={styles.row}>
              <Label className={styles.label} htmlFor={`style-${role}-shadow-offset-x`}>
                {t('subtitle.style.offsetX')}
                <span className={styles.valueBadge}>{style.textShadow.offsetX}px</span>
              </Label>
              <Input
                id={`style-${role}-shadow-offset-x`}
                type="number"
                min={-10}
                max={10}
                step={1}
                value={style.textShadow.offsetX}
                onChange={(e) => handleShadowFieldChange('offsetX', Number(e.target.value))}
                  aria-label={t('subtitle.style.shadowOffsetXAria')}
              />
            </div>
            <div className={styles.row}>
              <Label className={styles.label} htmlFor={`style-${role}-shadow-offset-y`}>
                {t('subtitle.style.offsetY')}
                <span className={styles.valueBadge}>{style.textShadow.offsetY}px</span>
              </Label>
              <Input
                id={`style-${role}-shadow-offset-y`}
                type="number"
                min={-10}
                max={10}
                step={1}
                value={style.textShadow.offsetY}
                onChange={(e) => handleShadowFieldChange('offsetY', Number(e.target.value))}
                  aria-label={t('subtitle.style.shadowOffsetYAria')}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Reset ─── */}
      <div className={styles.resetRow}>
        {!showResetConfirm ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            aria-label={t('subtitle.style.resetAria', [role === 'target' ? t('library.card.target') : t('library.card.native')])}
            data-cell-id={`style-${role}-reset`}
          >
            {t('subtitle.action.reset')}
          </Button>
        ) : (
          <div className={styles.confirmRow} data-cell-id={`style-${role}-reset-confirm`}>
            <span>{t('subtitle.style.resetConfirm')}</span>
            <Button variant="destructive" size="sm" onClick={() => { onReset(); setShowResetConfirm(false); }}>
              {t('subtitle.action.reset')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
              {t('subtitle.action.cancel')}
            </Button>
          </div>
        )}
      </div>

      {/* Hidden reference to defaultStyle */}
      <span hidden data-default-style={JSON.stringify(defaultStyle)} />
    </div>
  );
}
