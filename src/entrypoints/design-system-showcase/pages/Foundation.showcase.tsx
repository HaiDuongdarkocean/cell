import { Icon } from '@/shared/icons/Icon';
import styles from './Foundation.module.css';

export const showcaseMeta = {
  title: 'Foundation',
  description: 'Quiet confidence — color, typography, spacing, shape, motion, and elevation.',
  level: 'foundations' as const,
  category: 'Overview',
  order: 0,
  status: 'experimental' as const,
};

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchColor} style={{ backgroundColor: color }} />
      <span className={styles.swatchName}>{name}</span>
      <span className={styles.swatchValue}>{color}</span>
    </div>
  );
}

function Spacer({ name, value }: { name: string; value: string }) {
  return (
    <div className={styles.spacerRow}>
      <span className={styles.spacerName}>{name}</span>
      <div className={styles.spacerLine} style={{ width: value, height: 'var(--space-4)' }} />
      <span className={styles.spacerValue}>{value}</span>
    </div>
  );
}

export function Showcase() {
  return (
    <div className={styles.root} data-theme="light">
      <section className={styles.section}>
        <h1 className={styles.title}>Foundation — Quiet Confidence</h1>
        <p className={styles.lead}>
          Calm, focused, learnable, điềm đạm, có hứng thú học tập, đơn giản, thanh lịch.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Color — light</h2>
        <div className={styles.grid}>
          <Swatch name="background" color="var(--color-background)" />
          <Swatch name="surface" color="var(--color-surface)" />
          <Swatch name="surface-elevated" color="var(--color-surface-elevated)" />
          <Swatch name="surface-hover" color="var(--color-surface-hover)" />
          <Swatch name="text" color="var(--color-text)" />
          <Swatch name="text-secondary" color="var(--color-text-secondary)" />
          <Swatch name="text-tertiary" color="var(--color-text-tertiary)" />
          <Swatch name="primary" color="var(--color-primary)" />
          <Swatch name="border" color="var(--color-border)" />
          <Swatch name="border-subtle" color="var(--color-border-subtle)" />
          <Swatch name="success" color="var(--color-success)" />
          <Swatch name="warning" color="var(--color-warning)" />
          <Swatch name="error" color="var(--color-error)" />
        </div>
      </section>

      <section className={styles.section} data-theme="dark">
        <h2 className={styles.heading}>Color — dark</h2>
        <div className={styles.grid}>
          <Swatch name="background" color="var(--color-background)" />
          <Swatch name="surface" color="var(--color-surface)" />
          <Swatch name="surface-elevated" color="var(--color-surface-elevated)" />
          <Swatch name="surface-hover" color="var(--color-surface-hover)" />
          <Swatch name="text" color="var(--color-text)" />
          <Swatch name="text-secondary" color="var(--color-text-secondary)" />
          <Swatch name="text-tertiary" color="var(--color-text-tertiary)" />
          <Swatch name="primary" color="var(--color-primary)" />
          <Swatch name="border" color="var(--color-border)" />
          <Swatch name="border-subtle" color="var(--color-border-subtle)" />
          <Swatch name="success" color="var(--color-success)" />
          <Swatch name="warning" color="var(--color-warning)" />
          <Swatch name="error" color="var(--color-error)" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Typography</h2>
        <p className={styles.display3xl}>Display 3XL — 40/56px</p>
        <p className={styles.display2xl}>Display 2XL — 32/40px</p>
        <p className={styles.displayXl}>Display XL — 28/32px</p>
        <p className={styles.headlineLg}>Headline LG — 24/28px</p>
        <p className={styles.headlineMd}>Headline MD — 20/24px</p>
        <p className={styles.headlineSm}>Headline SM — 18/20px</p>
        <p className={styles.titleLg}>Title LG — 16/18px</p>
        <p className={styles.titleMd}>Title MD — 16/16px</p>
        <p className={styles.titleSm}>Title SM — 14/14px</p>
        <p className={styles.bodyLg}>Body LG — 16/18px. Learnable content for long-form reading.</p>
        <p className={styles.bodyMd}>Body MD — 14/16px. The default paragraph for most UI content.</p>
        <p className={styles.bodySm}>Body SM — 12/14px. Secondary descriptions and metadata.</p>
        <p className={styles.bodyXs}>Body XS — 11/12px. Captions and timestamps.</p>
        <p className={styles.labelLg}>Label LG — 16/16px</p>
        <p className={styles.labelMd}>Label MD — 14/14px</p>
        <p className={styles.labelSm}>Label SM — 12/12px</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Spacing</h2>
        {['space-0-5', 'space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-8', 'space-10', 'space-12'].map((t) => (
          <Spacer key={t} name={t} value={`var(--${t})`} />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Shape & Elevation</h2>
        <div className={styles.shapes}>
          <div className={styles.shapeXs}>radius-xs</div>
          <div className={styles.shapeSm}>radius-sm</div>
          <div className={styles.shapeMd}>radius-md</div>
          <div className={styles.shapeLg}>radius-lg</div>
          <div className={styles.shapeXl}>radius-xl</div>
          <div className={styles.shapePill}>radius-pill</div>
        </div>
        <div className={styles.elevations}>
          <div className={styles.elev0}>Elevation 0</div>
          <div className={styles.elev1}>Elevation 1</div>
          <div className={styles.elev2}>Elevation 2</div>
          <div className={styles.elev3}>Elevation 3</div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Motion</h2>
        <button type="button" className={styles.motionBtn}>
          Hover me (120ms)
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Iconography</h2>
        <div className={styles.icons}>
          <Icon name="play" size={24} />
          <Icon name="pause" size={24} />
          <Icon name="search" size={24} />
          <Icon name="settings" size={24} />
          <Icon name="check" size={24} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Core Components</h2>
        <div className={styles.components}>
          <button type="button" className={styles.btnPrimary}>Primary</button>
          <button type="button" className={styles.btnSecondary}>Secondary</button>
          <button type="button" className={styles.btnGhost}>Ghost</button>
          <input className={styles.input} placeholder="Input" />
          <div className={styles.card}>Card with surface + border</div>
        </div>
      </section>
    </div>
  );
}

export default Showcase;
