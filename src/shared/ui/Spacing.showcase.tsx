import type { ReactElement, CSSProperties } from 'react';

interface SpacingItem {
  token: string;
  value: string;
}

const HALF_STEPS: readonly SpacingItem[] = [
  { token: '--space-0', value: '0' },
  { token: '--space-0-5', value: '2px' },
  { token: '--space-1', value: '4px' },
  { token: '--space-1-5', value: '6px' },
  { token: '--space-2-5', value: '10px' },
  { token: '--space-3-5', value: '14px' },
  { token: '--space-4-5', value: '18px' },
];

const CORE: readonly SpacingItem[] = [
  { token: '--space-2', value: '8px' },
  { token: '--space-3', value: '12px' },
  { token: '--space-4', value: '16px' },
  { token: '--space-5', value: '20px' },
  { token: '--space-6', value: '24px' },
  { token: '--space-7', value: '28px' },
  { token: '--space-8', value: '32px' },
  { token: '--space-9', value: '36px' },
  { token: '--space-10', value: '40px' },
  { token: '--space-11', value: '44px' },
  { token: '--space-12', value: '48px' },
];

const LARGE: readonly SpacingItem[] = [
  { token: '--space-14', value: '56px' },
  { token: '--space-16', value: '64px' },
  { token: '--space-20', value: '80px' },
  { token: '--space-24', value: '96px' },
];

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontFamily: 'var(--font-family-code)',
  fontSize: 'var(--font-size-xs)',
};

const labelStyle: CSSProperties = {
  minWidth: 120,
  color: 'var(--color-text-secondary)',
};

const valueStyle: CSSProperties = {
  minWidth: 48,
  color: 'var(--color-text-primary)',
};

const barBase: CSSProperties = {
  height: 16,
  background: 'var(--color-primary)',
  borderRadius: 'var(--radius-2xs)',
  flexShrink: 0,
};

function SpacingRow({ item }: { item: SpacingItem }): ReactElement {
  const barStyle: CSSProperties = {
    ...barBase,
    width: `var(${item.token})`,
    opacity: item.value === '0' ? 0.3 : 1,
  };
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{item.token}</span>
      <span style={valueStyle}>{item.value}</span>
      <div style={barStyle} />
    </div>
  );
}

function Group({ title, items }: { title: string; items: readonly SpacingItem[] }): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{title}</span>
      {items.map((item) => (
        <SpacingRow key={item.token} item={item} />
      ))}
    </div>
  );
}

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
      <Group title="Half-step (tight internal)" items={HALF_STEPS} />
      <Group title="Core (component internal)" items={CORE} />
      <Group title="Large (section / page gaps)" items={LARGE} />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Spacing Scale',
  description: 'All --space-* tokens (4px base-unit scale). Half-step for tight spacing, core for components, large for section/page gaps. SSOT: only --space-* (no --spacing-* alias).',
  level: 'foundations',
  category: 'Spacing',
  group: 'Tokens',
  order: 1,
};
