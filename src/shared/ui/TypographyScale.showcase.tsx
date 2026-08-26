import styles from './TypographyScale.showcase.module.css';

interface TypeStyle {
  token: string;
  sample: string;
  size: string;
  weight: string;
  lineHeight: string;
  tracking: string;
  usage: string;
}

const TYPE_SCALE: TypeStyle[] = [
  { token: 'display-3xl', sample: 'Quiet Confidence', size: '40px', weight: '600', lineHeight: '1.1', tracking: '-0.04em', usage: 'Hero, landing' },
  { token: 'display-2xl', sample: 'Quiet Confidence', size: '32px', weight: '600', lineHeight: '1.1', tracking: '-0.03em', usage: 'Hero, landing' },
  { token: 'display-xl', sample: 'Quiet Confidence', size: '28px', weight: '600', lineHeight: '1.2', tracking: '-0.03em', usage: 'Page title' },
  { token: 'headline-lg', sample: 'Build your vocabulary', size: '24px', weight: '600', lineHeight: '1.2', tracking: '-0.02em', usage: 'Section header' },
  { token: 'headline-md', sample: 'Build your vocabulary', size: '20px', weight: '600', lineHeight: '1.2', tracking: '-0.01em', usage: 'Section header' },
  { token: 'headline-sm', sample: 'Build your vocabulary', size: '18px', weight: '600', lineHeight: '1.2', tracking: '-0.01em', usage: 'Card title' },
  { token: 'title-lg', sample: 'Subtitle settings', size: '16px', weight: '500', lineHeight: '1.2', tracking: '-0.01em', usage: 'Panel title' },
  { token: 'title-md', sample: 'Subtitle settings', size: '14px', weight: '500', lineHeight: '1.2', tracking: '0', usage: 'List heading' },
  { token: 'title-sm', sample: 'Subtitle settings', size: '12px', weight: '500', lineHeight: '1.2', tracking: '0', usage: 'Small heading' },
  { token: 'body-lg', sample: 'Read along with video, look up words, and review cues.', size: '16px', weight: '400', lineHeight: '1.6', tracking: '0', usage: 'Long reading' },
  { token: 'body-md', sample: 'Read along with video, look up words, and review cues.', size: '14px', weight: '400', lineHeight: '1.5', tracking: '0', usage: 'Default body' },
  { token: 'body-sm', sample: 'Read along with video, look up words, and review cues.', size: '12px', weight: '400', lineHeight: '1.5', tracking: '0', usage: 'Compact body' },
  { token: 'body-xs', sample: 'Last synced 2m ago', size: '11px', weight: '400', lineHeight: '1.5', tracking: '0', usage: 'Metadata' },
  { token: 'label-lg', sample: 'Save changes', size: '14px', weight: '500', lineHeight: '1.2', tracking: '0', usage: 'Button, large label' },
  { token: 'label-md', sample: 'Save changes', size: '12px', weight: '500', lineHeight: '1.2', tracking: '0', usage: 'Button, label' },
  { token: 'label-sm', sample: 'Save changes', size: '11px', weight: '500', lineHeight: '1.2', tracking: '0.01em', usage: 'Badge, tag' },
  { token: 'label-xs', sample: 'CMD', size: '8px', weight: '500', lineHeight: '1.2', tracking: '0.02em', usage: 'Keycap, shortcut' },
  { token: 'mono-sm', sample: 'font-size: 16px;', size: '11px', weight: '400', lineHeight: '1.5', tracking: '0', usage: 'Code snippet' },
];

const PRINCIPLES = [
  { title: 'Five roles', body: 'Display, Headline, Title, Body, and Label — the same five roles as Material 3. Each role has small, medium, and large variants where needed.' },
  { title: 'Inter + system fallback', body: 'Inter Variable is primary; SF Pro (Apple), Roboto (Android), and system sans-serif are fallbacks for native texture on every platform.' },
  { title: 'Weight, not color, for hierarchy', body: 'Following Apple HIG: hierarchy is built from size, weight, and tracking. Color is a secondary accent.' },
  { title: 'Negative tracking on display', body: 'Large type uses tight tracking for a crisp, compact wordmark. Body and label keep normal tracking for legibility.' },
  { title: 'Variable font ready', body: 'Token values are designed for variable fonts, allowing fluid size/weight interpolation and responsive scaling without extra requests.' },
];

function TypeRow({ style }: { style: TypeStyle }): React.JSX.Element {
  const { token, sample, size, weight, lineHeight, tracking, usage } = style;
  return (
    <div className={styles.row}>
      <div className={styles.meta}>
        <span className={styles.token}>{token}</span>
        <span className={styles.values}>
          {size} · {weight} · {lineHeight} · {tracking}
        </span>
        <span className={styles.usage}>{usage}</span>
      </div>
      <span
        className={styles.sample}
        style={{
          fontSize: `var(--${token}-font-size)`,
          fontWeight: `var(--${token}-font-weight)`,
          lineHeight: `var(--${token}-line-height)`,
          letterSpacing: `var(--${token}-letter-spacing)`,
        }}
      >
        {sample}
      </span>
    </div>
  );
}

export function Showcase(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Typography Scale</h1>
      <p className={styles.lead}>
        A type scale is a selection of type styles used across a product to ensure consistency.
        This scale follows five roles from Material 3 — display, headline, title, body, label —
        while calibrating tracking and weight for dense Chrome-extension UI.
      </p>

      <section className={styles.principles}>
        {PRINCIPLES.map((p) => (
          <div key={p.title} className={styles.principleCard}>
            <h3 className={styles.principleTitle}>{p.title}</h3>
            <p className={styles.principleBody}>{p.body}</p>
          </div>
        ))}
      </section>

      <section className={styles.table}>
        {TYPE_SCALE.map((style) => (
          <TypeRow key={style.token} style={style} />
        ))}
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Typography Scale',
  description: 'All --*-font-* tokens: 5 roles (display, headline, title, body, label) with sizes, weights, line-heights, and tracking.',
  level: 'foundations' as const,
  category: 'Typography',
  group: 'Tokens',
  order: 3,
  status: 'experimental' as const,
};

export default Showcase;
