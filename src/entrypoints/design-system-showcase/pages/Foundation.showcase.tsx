import { Icon } from '@/shared/icons/Icon';
import { useShowcaseNavigation } from '../ShowcaseNavigationContext';
import styles from './Foundation.module.css';

export const showcaseMeta = {
  title: 'Overview',
  description: 'Quiet confidence — a navigable reference for color, typography, spacing, shape, motion, iconography, and grid.',
  level: 'foundations' as const,
  category: 'Overview',
  order: 0,
  status: 'experimental' as const,
};

type SectionId = 'overview' | 'color' | 'typography' | 'spacing' | 'shape' | 'motion' | 'iconography' | 'grid';

interface Section {
  id: SectionId;
  label: string;
  description: string;
  priority: number;
  target?: string;
}

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', description: 'Quiet confidence — the story of the foundation.', priority: 0 },
  { id: 'color', label: 'Color', description: 'Neutral-first palette with a single indigo accent.', priority: 1, target: 'Color Scale' },
  { id: 'typography', label: 'Typography', description: 'Inter, 5 roles, progressive negative tracking.', priority: 2, target: 'Typography Scale' },
  { id: 'spacing', label: 'Spacing', description: '4px base unit for dense extension UI.', priority: 3, target: 'Spacing Scale' },
  { id: 'shape', label: 'Shape & Elevation', description: 'Concentric radius and surface lift over heavy shadow.', priority: 4 },
  { id: 'motion', label: 'Motion', description: 'Purpose-driven, under 300ms, reduced-motion aware.', priority: 5 },
  { id: 'iconography', label: 'Iconography', description: '24×24, 1.5px stroke, round, semantic.', priority: 6 },
  { id: 'grid', label: 'Grid & Breakpoints', description: 'Mobile-first 320px → 1280px.', priority: 7 },
];

function Swatch({ name, color, value }: { name: string; color: string; value?: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchColor} style={{ backgroundColor: color }} />
      <span className={styles.swatchName}>{name}</span>
      {value && <span className={styles.swatchValue}>{value}</span>}
    </div>
  );
}

function SectionTitle({ children, onClick }: { children: string; onClick?: () => void }) {
  if (!onClick) {
    return <h2 className={styles.sectionTitle}>{children}</h2>;
  }
  return (
    <button type="button" className={styles.sectionTitleButton} onClick={onClick}>
      <span>{children}</span>
      <Icon name="chevronRight" size={18} />
    </button>
  );
}

function SectionLead({ children }: { children: string }) {
  return <p className={styles.sectionLead}>{children}</p>;
}

function Overview() {
  return (
    <div className={styles.section}>
      <SectionTitle>Quiet Confidence</SectionTitle>
      <SectionLead>
        Cell is a learning companion, not a loud tool. The foundation is designed to feel calm,
        focused, and trustworthy while still encouraging curiosity.
      </SectionLead>
      <div className={styles.principles}>
        {[
          { title: 'Calm', body: 'No aggressive color, no heavy shadow. Restrained use of accent.' },
          { title: 'Focused', body: 'Single accent color, clear hierarchy, purposeful motion.' },
          { title: 'Learnable', body: 'Consistent patterns: 5 type roles, 4px spacing, concentric radius.' },
          { title: 'Elegant', body: 'Warm off-white light theme. Near-black with faint blue tint dark theme.' },
        ].map((p) => (
          <div key={p.title} className={styles.principleCard}>
            <h3 className={styles.principleTitle}>{p.title}</h3>
            <p className={styles.principleBody}>{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Color({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Color</SectionTitle>
      <SectionLead>
        Neutral-first, single indigo accent as punctuation. Color is organized by role, not by hex.
      </SectionLead>

      <h3 className={styles.subsectionTitle}>Light palette</h3>
      <div className={styles.grid}>
        <Swatch name="Background" color="var(--color-background)" value="#F9F9F7" />
        <Swatch name="Surface" color="var(--color-surface)" value="#FFFFFF" />
        <Swatch name="Elevated" color="var(--color-surface-elevated)" value="#FAFAF8" />
        <Swatch name="Hover" color="var(--color-surface-hover)" value="#F2F2EF" />
        <Swatch name="Text" color="var(--color-text)" value="#2A2A2B" />
        <Swatch name="Text secondary" color="var(--color-text-secondary)" value="#6E6E73" />
        <Swatch name="Text tertiary" color="var(--color-text-tertiary)" value="#9A9AA2" />
        <Swatch name="Primary" color="var(--color-primary)" value="#5E6AD2" />
        <Swatch name="Border" color="var(--color-border)" value="#E2E2DF" />
        <Swatch name="Success" color="var(--color-success)" value="#2F7D46" />
        <Swatch name="Warning" color="var(--color-warning)" value="#9E6A1E" />
        <Swatch name="Error" color="var(--color-error)" value="#A63C3C" />
      </div>

      <h3 className={styles.subsectionTitle}>Dark palette</h3>
      <div className={styles.gridDark} data-theme="dark">
        <Swatch name="Background" color="var(--color-background)" value="#0F1011" />
        <Swatch name="Surface" color="var(--color-surface)" value="#18191A" />
        <Swatch name="Elevated" color="var(--color-surface-elevated)" value="#222325" />
        <Swatch name="Hover" color="var(--color-surface-hover)" value="#2B2D2F" />
        <Swatch name="Text" color="var(--color-text)" value="#F7F8F8" />
        <Swatch name="Text secondary" color="var(--color-text-secondary)" value="#AEB4BC" />
        <Swatch name="Text tertiary" color="var(--color-text-tertiary)" value="#7D838B" />
        <Swatch name="Primary" color="var(--color-primary)" value="#5E6AD2" />
        <Swatch name="Border" color="var(--color-border)" value="#33363A" />
        <Swatch name="Success" color="var(--color-success)" value="#5FD389" />
        <Swatch name="Warning" color="var(--color-warning)" value="#F5B955" />
        <Swatch name="Error" color="var(--color-error)" value="#F28B82" />
      </div>

      <h3 className={styles.subsectionTitle}>Usage rules</h3>
      <ul className={styles.ruleList}>
        <li>One chromatic accent per screen. Indigo is the only primary action color.</li>
        <li>Hierarchy comes from surface lift and border, not from saturation.</li>
        <li>Semantic colors are muted — never neon.</li>
      </ul>
    </div>
  );
}

const TYPE_SAMPLES = [
  { style: 'display-3xl', label: 'Display 3XL', sample: 'Quiet Confidence' },
  { style: 'display-2xl', label: 'Display 2XL', sample: 'Quiet Confidence' },
  { style: 'display-xl', label: 'Display XL', sample: 'Quiet Confidence' },
  { style: 'headline-lg', label: 'Headline LG', sample: 'Build your vocabulary' },
  { style: 'headline-md', label: 'Headline MD', sample: 'Build your vocabulary' },
  { style: 'headline-sm', label: 'Headline SM', sample: 'Build your vocabulary' },
  { style: 'title-lg', label: 'Title LG', sample: 'Subtitle settings' },
  { style: 'title-md', label: 'Title MD', sample: 'Subtitle settings' },
  { style: 'title-sm', label: 'Title SM', sample: 'Subtitle settings' },
  { style: 'body-lg', label: 'Body LG', sample: 'Read along with video, look up words, and review cues.' },
  { style: 'body-md', label: 'Body MD', sample: 'Read along with video, look up words, and review cues.' },
  { style: 'body-sm', label: 'Body SM', sample: 'Read along with video, look up words, and review cues.' },
  { style: 'body-xs', label: 'Body XS', sample: 'Last synced 2m ago' },
  { style: 'label-lg', label: 'Label LG', sample: 'Save changes' },
  { style: 'label-md', label: 'Label MD', sample: 'Save changes' },
  { style: 'label-sm', label: 'Label SM', sample: 'Save changes' },
];

function Typography({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Typography</SectionTitle>
      <SectionLead>
        Inter Variable, five roles, aggressive negative tracking on display, restrained on body.
      </SectionLead>

      <div className={styles.typeStack}>
        {TYPE_SAMPLES.map((t) => (
          <div key={t.style} className={styles.typeRow}>
            <span className={styles.typeLabel}>{t.label}</span>
            <span className={`${styles.typeSample} ${styles[t.style]}`}>{t.sample}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SPACE_TOKENS = [
  { name: 'space-0-5', value: '2px' },
  { name: 'space-1', value: '4px' },
  { name: 'space-2', value: '8px' },
  { name: 'space-3', value: '12px' },
  { name: 'space-4', value: '16px' },
  { name: 'space-5', value: '20px' },
  { name: 'space-6', value: '24px' },
  { name: 'space-8', value: '32px' },
  { name: 'space-10', value: '40px' },
  { name: 'space-12', value: '48px' },
];

function Spacing({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Spacing</SectionTitle>
      <SectionLead>
        4px base unit. Dense enough for popup and sidepanel, but with enough range for page sections.
      </SectionLead>
      <div className={styles.spacerList}>
        {SPACE_TOKENS.map((t) => (
          <div key={t.name} className={styles.spacerRow}>
            <span className={styles.spacerName}>{t.name}</span>
            <div className={styles.spacerLine} style={{ width: t.value }} />
            <span className={styles.spacerValue}>{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shape({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Shape & Elevation</SectionTitle>
      <SectionLead>
        Radius tells you what a component is. Elevation is built from surface lift, not decoration.
      </SectionLead>
      <div className={styles.shapes}>
        <div className={`${styles.shapeBox} ${styles.shapeXs}`}>xs</div>
        <div className={`${styles.shapeBox} ${styles.shapeSm}`}>sm</div>
        <div className={`${styles.shapeBox} ${styles.shapeMd}`}>md</div>
        <div className={`${styles.shapeBox} ${styles.shapeLg}`}>lg</div>
        <div className={`${styles.shapeBox} ${styles.shapeXl}`}>xl</div>
        <div className={`${styles.shapeBox} ${styles.shapePill}`}>pill</div>
      </div>
      <div className={styles.elevations}>
        <div className={styles.elev0}>0 — page</div>
        <div className={styles.elev1}>1 — card</div>
        <div className={styles.elev2}>2 — popover</div>
        <div className={styles.elev3}>3 — modal</div>
      </div>
    </div>
  );
}

const MOTION_TABLE = [
  { token: 'duration-instant', value: '0ms', use: 'Disable transition' },
  { token: 'duration-fast', value: '120ms', use: 'Hover, active, color' },
  { token: 'duration-normal', value: '200ms', use: 'Expand, fade, opacity' },
  { token: 'duration-slow', value: '300ms', use: 'Modal, page transition' },
  { token: 'duration-slower', value: '500ms', use: 'Toast, large layout' },
];

function Motion({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Motion</SectionTitle>
      <SectionLead>
        Every animation needs a purpose. No animation on keyboard actions. Respect reduced motion.
      </SectionLead>
      <div className={styles.motionTable}>
        {MOTION_TABLE.map((m) => (
          <div key={m.token} className={styles.motionRow}>
            <span className={styles.motionToken}>{m.token}</span>
            <span className={styles.motionValue}>{m.value}</span>
            <span className={styles.motionUse}>{m.use}</span>
          </div>
        ))}
      </div>
      <button type="button" className={styles.motionBtn}>Hover me</button>
    </div>
  );
}

const ICONS = ['play', 'pause', 'search', 'settings', 'check', 'moon', 'sun'] as const;

function Iconography({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Iconography</SectionTitle>
      <SectionLead>
        24×24 canvas, 1.5px stroke, round caps/joins, currentColor. One style across the app.
      </SectionLead>
      <div className={styles.icons}>
        {ICONS.map((name) => (
          <div key={name} className={styles.iconItem}>
            <Icon name={name} size={24} />
            <span className={styles.iconName}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Grid({ onClick }: { onClick?: () => void }) {
  return (
    <div className={styles.section}>
      <SectionTitle onClick={onClick}>Grid & Breakpoints</SectionTitle>
      <SectionLead>
        Mobile-first, 4 columns on small screens, 12 on desktop. Built for popup, sidepanel, and options.
      </SectionLead>
      <div className={styles.gridTable}>
        {[
          { bp: 'sm', width: '320px', cols: '4' },
          { bp: 'md', width: '480px', cols: '4' },
          { bp: 'lg', width: '768px', cols: '12' },
          { bp: 'xl', width: '1024px', cols: '12' },
          { bp: '2xl', width: '1280px+', cols: '12' },
        ].map((g) => (
          <div key={g.bp} className={styles.gridRow}>
            <span className={styles.gridBp}>{g.bp}</span>
            <span className={styles.gridWidth}>{g.width}</span>
            <span className={styles.gridCols}>{g.cols} cols</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONTENT: Record<SectionId, (props: { onClick?: () => void }) => React.JSX.Element> = {
  overview: Overview,
  color: Color,
  typography: Typography,
  spacing: Spacing,
  shape: Shape,
  motion: Motion,
  iconography: Iconography,
  grid: Grid,
};

export function Showcase() {
  const { navigateToShowcase } = useShowcaseNavigation();

  return (
    <main className={styles.main}>
      {SECTIONS.map((s) => {
        const Component = CONTENT[s.id];
        const handleClick = s.target ? () => navigateToShowcase(s.target) : undefined;
        return (
          <Component key={s.id} onClick={handleClick} />
        );
      })}
    </main>
  );
}

export default Showcase;
