import type React from 'react';
import { useMemo } from 'react';
import { Card, Heading, Select, Slider, Text, VStack } from '@/shared/ui';
import type { BadgePointerTriggerSettings } from '@/entities/settings/types';
import styles from './mockup.module.css';

interface OrbitalCardProps {
  badgePointerTrigger: BadgePointerTriggerSettings;
  onChange: (next: BadgePointerTriggerSettings) => void;
}

const POSITION_OPTIONS = [
  { value: 'top', label: 'Pointer up' },
  { value: 'bottom', label: 'Pointer down' },
  { value: 'left', label: 'Pointer left' },
  { value: 'right', label: 'Pointer right' },
  { value: 'center', label: 'Pointer centered' },
];

const SIZE_MIN = 24;
const SIZE_MAX = 96;
const SCALE_MIN = 0.1;
const SCALE_MAX = 0.6;

export function OrbitalCard({ badgePointerTrigger, onChange }: OrbitalCardProps): React.JSX.Element {
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
      borderRadius: '9999px',
      background: 'var(--color-primary)',
      border: '2px solid var(--color-surface)',
    };

    if (position === 'top') return { ...base, left: '50%', top: `calc(50% - ${offset}px)`, transform: 'translate(-50%, 0)' };
    if (position === 'bottom') return { ...base, left: '50%', top: `calc(50% + ${offset}px)`, transform: 'translate(-50%, -100%)' };
    if (position === 'left') return { ...base, left: `calc(50% - ${offset}px)`, top: '50%', transform: 'translate(0, -50%)' };
    if (position === 'right') return { ...base, left: `calc(50% + ${offset}px)`, top: '50%', transform: 'translate(-100%, -50%)' };
    return { ...base, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }, [size, position, pointerSize]);

  return (
    <Card className={styles.orbitalCard}>
      <div className={styles.orbitalHeader}>
        <Heading level={4} size={4} className={styles.orbitalTitle}>
          Word badge
        </Heading>
        <Text as="p" color="secondary" className={styles.orbitalDesc}>
          The floating button with a pointer tip.
        </Text>
      </div>
      <VStack gap="4" className={styles.orbitalBody}>
        <div className={styles.orbitalPreviewBox}>
          <div
            className={styles.orbitalPreviewBadge}
            style={{ width: size, height: size }}
          >
            <span className={styles.orbitalPreviewPointer} style={pointerStyle} />
          </div>
        </div>

        <div className={styles.orbitalField}>
          <label className={styles.orbitalLabel} htmlFor="orbital-position">Pointer position</label>
          <Select
            id="orbital-position"
            value={position}
            options={POSITION_OPTIONS}
            onChange={(value) => onChange({ ...badgePointerTrigger, position: value as BadgePointerTriggerSettings['position'] })}
          />
        </div>

        <div className={styles.orbitalField}>
          <div className={styles.orbitalSliderHeader}>
            <label className={styles.orbitalLabel} htmlFor="orbital-size">Button size</label>
            <span className={styles.orbitalValue}>{size}px</span>
          </div>
          <Slider
            id="orbital-size"
            value={size}
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={1}
            aria-label="Button size"
            onChange={(value) => onChange({ ...badgePointerTrigger, size: value })}
          />
        </div>

        <div className={styles.orbitalField}>
          <div className={styles.orbitalSliderHeader}>
            <label className={styles.orbitalLabel} htmlFor="orbital-scale">Pointer scale</label>
            <span className={styles.orbitalValue}>{Math.round(pointerScale * 100)}%</span>
          </div>
          <Slider
            id="orbital-scale"
            value={pointerScale}
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={0.05}
            aria-label="Pointer scale"
            onChange={(value) => onChange({ ...badgePointerTrigger, pointerScale: value })}
          />
        </div>
      </VStack>
    </Card>
  );
}
