// ColorCustomization — 9 color pickers per mode, light/dark tabs (spec F4).
//
// Real-time apply: onChange → themeStore.updateColor. Debounce 300ms cho drag
// (color picker rapid-fire) — coalesce để tránh spam storage write.

import { useState, useRef, useEffect } from 'react';
import type { ResolvedMode, ThemeConfig, CoreColorTokenKey } from '@/entities/theme';
import styles from './ColorCustomization.module.css';

interface ColorCustomizationProps {
  /** Current theme config. */
  config: ThemeConfig;
  /** Called when a color changes (debounced 300ms). */
  onColorChange: (mode: ResolvedMode, token: CoreColorTokenKey, hex: string) => void;
}

const TOKENS: ReadonlyArray<{ key: CoreColorTokenKey; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'textSecondary', label: 'Text Secondary' },
  { key: 'border', label: 'Border' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error' },
];

const DEBOUNCE_MS = 300;

export function ColorCustomization({ config, onColorChange }: ColorCustomizationProps): React.JSX.Element {
  const [tab, setTab] = useState<ResolvedMode>('dark');
  const [pending, setPending] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending override khi tab switch (pending chỉ cho tab hiện tại).
  useEffect(() => {
    setPending({});
  }, [tab]);

  const getCurrentColor = (key: CoreColorTokenKey): string =>
    pending[`${tab}.${key}`] ?? config.customColors[tab][key];

  const handleChange = (key: CoreColorTokenKey, hex: string): void => {
    const pendingKey = `${tab}.${key}`;
    setPending((prev) => ({ ...prev, [pendingKey]: hex }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onColorChange(tab, key, hex);
      setPending((prev) => {
        const next = { ...prev };
        delete next[pendingKey];
        return next;
      });
    }, DEBOUNCE_MS);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className={styles.wrapper} data-testid="color-customization">
      <div className={styles.tabs} role="tablist">
        {(['light', 'dark'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={tab === m}
            className={`${styles.tab} ${tab === m ? styles.active : ''}`}
            onClick={() => setTab(m)}
            data-testid={`color-tab-${m}`}
          >
            {m === 'light' ? '☀️ Light' : '🌙 Dark'}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {TOKENS.map(({ key, label }) => (
          <div key={key} className={styles.field}>
            <input
              type="color"
              className={styles.swatch}
              value={getCurrentColor(key)}
              onChange={(e) => handleChange(key, e.target.value)}
              aria-label={label}
              data-testid={`color-picker-${key}`}
            />
            <span className={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
