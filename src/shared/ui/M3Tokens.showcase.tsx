import type { ReactElement, CSSProperties } from 'react';

// ─── Elevation ─────────────────────────────────────────────────────

interface ElevationLevel {
  token: string;
  dp: string;
  shadowToken: string;
  components: string;
}

const ELEVATION_LEVELS: readonly ElevationLevel[] = [
  { token: '--elevation-level0', dp: '0dp', shadowToken: 'none', components: 'Filled Card, Filled Button' },
  { token: '--elevation-level1', dp: '1dp', shadowToken: '--elevation-shadow-l1', components: 'Elevated Card, Elevated Button' },
  { token: '--elevation-level2', dp: '3dp', shadowToken: '--elevation-shadow-l2', components: 'Nav Bar, Menu, Rich Tooltip' },
  { token: '--elevation-level3', dp: '6dp', shadowToken: '--elevation-shadow-l3', components: 'FAB, Dialog, Extended FAB' },
  { token: '--elevation-level4', dp: '8dp', shadowToken: '--elevation-shadow-l4', components: 'FAB hovered, Card dragged' },
  { token: '--elevation-level5', dp: '12dp', shadowToken: '--elevation-shadow-l5', components: 'Reserved' },
];

function ElevationPreview({ level }: { level: ElevationLevel }): ReactElement {
  const surfaceStyle: CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-m3-medium)',
    padding: 'var(--space-4)',
    boxShadow: `var(${level.shadowToken})`,
    minHeight: 64,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };
  return (
    <div style={surfaceStyle}>
      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{level.dp}</span>
      <span style={{ fontFamily: 'var(--font-family-code)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        {level.token}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{level.components}</span>
    </div>
  );
}

function ElevationSection(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Elevation Levels (M3)</h3>
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        6 levels (0-5). Shadow CSS from material-web [MATERIAL-WEB]. Dark mode uses tonal elevation (surface tint).
        Scrim: #000000 @ 0.32 opacity.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
        {ELEVATION_LEVELS.map((level) => (
          <ElevationPreview key={level.token} level={level} />
        ))}
      </div>
    </div>
  );
}

// ─── Shape ─────────────────────────────────────────────────────────

interface ShapeToken {
  token: string;
  dp: string;
  component: string;
}

const SHAPE_SCALE: readonly ShapeToken[] = [
  { token: '--radius-m3-none', dp: '0px', component: 'App Bar, Tab, List Item' },
  { token: '--radius-m3-extra-small', dp: '4px', component: 'TextField, Snackbar, Menu' },
  { token: '--radius-m3-small', dp: '8px', component: 'Chip' },
  { token: '--radius-m3-medium', dp: '12px', component: 'Card, Button (square)' },
  { token: '--radius-m3-large', dp: '16px', component: 'FAB, Nav Drawer (modal)' },
  { token: '--radius-m3-extra-large', dp: '28px', component: 'Dialog, Bottom Sheet, Large FAB' },
  { token: '--radius-full', dp: '9999px', component: 'Button, Switch, Badge, Search Bar' },
];

function ShapePreview({ shape }: { shape: ShapeToken }): ReactElement {
  const boxStyle: CSSProperties = {
    width: 72,
    height: 72,
    background: 'var(--color-primary-subtle)',
    border: '2px solid var(--color-primary)',
    borderRadius: `var(${shape.token})`,
    flexShrink: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div style={boxStyle} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-family-code)', fontSize: 'var(--font-size-xs)' }}>{shape.token}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{shape.dp}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{shape.component}</span>
      </div>
    </div>
  );
}

function ShapeSection(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Shape Scale (M3)</h3>
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        7 tokens [OFFICIAL M3]. Card=12px (Medium), Dialog=28px (Extra Large). Button=Full (hardcoded, not themeable).
        Shape does NOT change in dark mode. Shape does NOT relate to elevation.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {SHAPE_SCALE.map((shape) => (
          <ShapePreview key={shape.token} shape={shape} />
        ))}
      </div>
    </div>
  );
}

// ─── Motion ────────────────────────────────────────────────────────

interface DurationToken {
  token: string;
  ms: string;
  use: string;
}

const DURATIONS: readonly DurationToken[] = [
  { token: '--duration-short1', ms: '50ms', use: 'Ripple, checkbox tick' },
  { token: '--duration-short2', ms: '100ms', use: 'Small element appear' },
  { token: '--duration-short3', ms: '150ms', use: 'Icon transition, selection' },
  { token: '--duration-short4', ms: '200ms', use: 'Tooltip, chip selection' },
  { token: '--duration-medium1', ms: '250ms', use: 'FAB expand, card state' },
  { token: '--duration-medium2', ms: '300ms', use: 'Dialog, sheet, drawer (most common)' },
  { token: '--duration-medium3', ms: '350ms', use: 'Expanded component' },
  { token: '--duration-medium4', ms: '400ms', use: 'Page-level panel' },
  { token: '--duration-long1', ms: '450ms', use: 'Complex layout change' },
  { token: '--duration-long2', ms: '500ms', use: 'Shared element enter' },
  { token: '--duration-long3', ms: '550ms', use: 'Shared element large' },
  { token: '--duration-long4', ms: '600ms', use: 'Full container morph' },
];

interface EasingToken {
  token: string;
  curve: string;
  use: string;
}

const EASINGS: readonly EasingToken[] = [
  { token: '--ease-standard', curve: 'cubic-bezier(0.2, 0, 0, 1)', use: 'Simple state changes' },
  { token: '--ease-standard-decelerate', curve: 'cubic-bezier(0, 0, 0, 1)', use: 'Entering (simple)' },
  { token: '--ease-standard-accelerate', curve: 'cubic-bezier(0.3, 0, 1, 1)', use: 'Exiting (simple)' },
  { token: '--ease-emphasized', curve: 'cubic-bezier(0.2, 0, 0, 1)', use: 'Default M3 component transitions' },
  { token: '--ease-emphasized-decelerate', curve: 'cubic-bezier(0.05, 0.7, 0.1, 1)', use: 'Element arriving on screen' },
  { token: '--ease-emphasized-accelerate', curve: 'cubic-bezier(0.3, 0, 0.8, 0.15)', use: 'Element leaving screen' },
  { token: '--ease-linear', curve: 'cubic-bezier(0, 0, 1, 1)', use: 'Looping ONLY' },
];

function MotionSection(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Motion Tokens (M3)</h3>
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        16 duration tokens [OFFICIAL M3] + 7 easing curves. Enter=decelerate, Exit=accelerate (never same).
        Container transform: 500-550ms emphasized. M3 Expressive: spring physics (spatial + effects).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Duration Scale</span>
        {DURATIONS.map((d) => (
          <div key={d.token} style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-code)' }}>
            <span style={{ minWidth: 180 }}>{d.token}</span>
            <span style={{ minWidth: 56, color: 'var(--color-text-secondary)' }}>{d.ms}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{d.use}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Easing Curves</span>
        {EASINGS.map((e) => (
          <div key={e.token} style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-code)' }}>
            <span style={{ minWidth: 240 }}>{e.token}</span>
            <span style={{ minWidth: 240, color: 'var(--color-text-secondary)' }}>{e.curve}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{e.use}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Typography ────────────────────────────────────────────────────

interface TypeStyle {
  token: string;
  role: string;
  size: string;
  weight: string;
  lineHeight: string;
  tracking: string;
}

const TYPE_SCALE: readonly TypeStyle[] = [
  { token: 'text-m3-display-large', role: 'Display L', size: '49px', weight: '400', lineHeight: '1.12', tracking: '-0.25px' },
  { token: 'text-m3-display-medium', role: 'Display M', size: '39px', weight: '400', lineHeight: '1.16', tracking: '0' },
  { token: 'text-m3-display-small', role: 'Display S', size: '31px', weight: '400', lineHeight: '1.23', tracking: '0' },
  { token: 'text-m3-headline-large', role: 'Headline L', size: '25px', weight: '400', lineHeight: '1.25', tracking: '0' },
  { token: 'text-m3-headline-medium', role: 'Headline M', size: '20px', weight: '400', lineHeight: '1.29', tracking: '0' },
  { token: 'text-m3-headline-small', role: 'Headline S', size: '17px', weight: '400', lineHeight: '1.33', tracking: '0' },
  { token: 'text-m3-title-large', role: 'Title L', size: '20px', weight: '400', lineHeight: '1.27', tracking: '0' },
  { token: 'text-m3-title-medium', role: 'Title M', size: '16px', weight: '500', lineHeight: '1.5', tracking: '0.15px' },
  { token: 'text-m3-title-small', role: 'Title S', size: '14px', weight: '500', lineHeight: '1.43', tracking: '0.10px' },
  { token: 'text-m3-body-large', role: 'Body L', size: '16px', weight: '400', lineHeight: '1.5', tracking: '0.50px' },
  { token: 'text-m3-body-medium', role: 'Body M', size: '14px', weight: '400', lineHeight: '1.43', tracking: '0.25px' },
  { token: 'text-m3-body-small', role: 'Body S', size: '12px', weight: '400', lineHeight: '1.33', tracking: '0.40px' },
  { token: 'text-m3-label-large', role: 'Label L', size: '14px', weight: '500', lineHeight: '1.43', tracking: '0.10px' },
  { token: 'text-m3-label-medium', role: 'Label M', size: '12px', weight: '500', lineHeight: '1.33', tracking: '0.50px' },
  { token: 'text-m3-label-small', role: 'Label S', size: '10px', weight: '500', lineHeight: '1.6', tracking: '0.50px' },
];

function TypographySection(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Typography Scale (M3 15-style)</h3>
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        15 styles [OFFICIAL M3]: Display (L/M/S), Headline (L/M/S), Title (L/M/S), Body (L/M/S), Label (L/M/S).
        Font: Figtree (cell default, M3 uses Roboto). Min font: 10sp. Cell font sizes approximate M3 sp values.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {TYPE_SCALE.map((t) => (
          <div key={t.token} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
            <span
              style={{
                fontSize: `var(--${t.token}-font-size)`,
                fontWeight: `var(--${t.token}-font-weight)`,
                lineHeight: `var(--${t.token}-line-height)`,
                letterSpacing: `var(--${t.token}-letter-spacing)`,
                minWidth: 120,
              }}
            >
              {t.role}
            </span>
            <span style={{ fontFamily: 'var(--font-family-code)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {t.size} / {t.weight} / lh {t.lineHeight} / tr {t.tracking}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: 720 }}>
      <ElevationSection />
      <ShapeSection />
      <MotionSection />
      <TypographySection />
    </div>
  );
}

export const showcaseMeta = {
  title: 'M3 Design Tokens',
  description: 'Reference archive: Material Design 3 verified token specs. Kept for comparison only; Cell design system does not use M3 tokens.',
  level: 'atoms',
  category: 'Reference',
  group: 'Tokens',
  order: 200,
  status: 'deprecated' as const,
};
