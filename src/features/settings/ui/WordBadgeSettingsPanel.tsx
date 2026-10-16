import type React from 'react';
import { useMemo } from 'react';
import { Select } from '@/shared/ui/Select';
import { SliderRow } from '@/shared/ui/SliderRow';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsPanel } from '@/shared/ui/SettingsPanel';
import { t, type MessageKey } from '@/shared/i18n';
import type { BadgePointerTriggerSettings } from '@/entities/settings/types';
import styles from './WordBadgeSettingsPanel.module.css';

interface WordBadgeSettingsPanelProps {
  readonly badgePointerTrigger: BadgePointerTriggerSettings;
  readonly onChange: (next: BadgePointerTriggerSettings) => void;
}

const POSITION_OPTIONS: readonly { value: string; labelKey: MessageKey }[] = [
  { value: 'top', labelKey: 'settings.wordBadge.position.top' },
  { value: 'bottom', labelKey: 'settings.wordBadge.position.bottom' },
  { value: 'left', labelKey: 'settings.wordBadge.position.left' },
  { value: 'right', labelKey: 'settings.wordBadge.position.right' },
  { value: 'center', labelKey: 'settings.wordBadge.position.center' },
];

const SIZE_MIN = 24;
const SIZE_MAX = 96;
const SCALE_MIN = 0.1;
const SCALE_MAX = 0.6;

export function WordBadgeSettingsPanel({
  badgePointerTrigger,
  onChange,
}: WordBadgeSettingsPanelProps): React.JSX.Element {
  const size = badgePointerTrigger.size ?? 36;
  const position = badgePointerTrigger.position ?? 'center';
  const pointerScale = badgePointerTrigger.pointerScale ?? 0.25;
  const pointerSize = Math.max(8, size * pointerScale);

  const pointerStyle = useMemo<React.CSSProperties>(() => {
    const offset = size / 2 + pointerSize / 2 - 2;
    const base: React.CSSProperties = {
      position: 'absolute',
      width: pointerSize,
      height: pointerSize,
      borderRadius: 'var(--radius-full)',
      background: 'var(--color-primary)',
      border: 'var(--border-width-thick) solid var(--color-surface)',
    };

    if (position === 'top') return { ...base, left: '50%', top: `calc(50% - ${offset}px)`, transform: 'translate(-50%, 0)' };
    if (position === 'bottom') return { ...base, left: '50%', top: `calc(50% + ${offset}px)`, transform: 'translate(-50%, -100%)' };
    if (position === 'left') return { ...base, left: `calc(50% - ${offset}px)`, top: '50%', transform: 'translate(0, -50%)' };
    if (position === 'right') return { ...base, left: `calc(50% + ${offset}px)`, top: '50%', transform: 'translate(-100%, -50%)' };
    return { ...base, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }, [size, position, pointerSize]);

  return (
    <SettingsPanel>
      <div className={styles.previewBox}>
        <div className={styles.previewBadge} style={{ width: size, height: size }}>
          <span className={styles.previewPointer} style={pointerStyle} />
        </div>
      </div>

      <SettingsGroup>
      <SettingsRow dense stacked title={t('settings.wordBadge.position')} labelFor="word-badge-position">
        <Select
          id="word-badge-position"
          value={position}
          options={POSITION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onChange={(value) => onChange({ ...badgePointerTrigger, position: value as BadgePointerTriggerSettings['position'] })}
        />
      </SettingsRow>

      <SliderRow
        label={t('settings.wordBadge.size')}
        value={size}
        min={SIZE_MIN}
        max={SIZE_MAX}
        step={1}
        formatValue={(v) => `${v}px`}
        aria-label={t('settings.wordBadge.buttonSize.aria')}
        onChange={(value) => onChange({ ...badgePointerTrigger, size: value })}
      />

      <SliderRow
        label={t('settings.wordBadge.pointerScale')}
        value={pointerScale}
        min={SCALE_MIN}
        max={SCALE_MAX}
        step={0.05}
        formatValue={(v) => `${Math.round(v * 100)}%`}
        aria-label={t('settings.wordBadge.pointerScale')}
        onChange={(value) => onChange({ ...badgePointerTrigger, pointerScale: value })}
      />
      </SettingsGroup>
    </SettingsPanel>
  );
}
