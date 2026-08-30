import { Button } from './Button';
import {
  Check,
  ChevronRight,
  Download,
  EyeOff,
  Image,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { useId, type ReactElement, type ReactNode } from 'react';
import styles from './Button.showcase.module.css';

interface SectionProps {
  title: string;
  caption: string;
  children: ReactNode;
  vertical?: boolean;
}

function Section({ title, caption, children, vertical }: SectionProps): ReactElement {
  const id = useId();
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h3 id={id} className={styles.title}>{title}</h3>
      <p className={styles.caption}>{caption}</p>
      <div className={vertical ? styles.verticalRow : styles.row}>{children}</div>
    </section>
  );
}

export function Showcase(): ReactElement {
  return (
    <div className={styles.root}>
      <Section
        title="Variants — Liquid Glass"
        caption="6 canonical variants. All action variants share the same neutral smoked-blue liquid-glass material; the rim caustics provide the only outline. Pointer-down spawns a water ripple from the touch point; release uses a spring easing for a water-surface rebound. Token-driven, theme-agnostic."
      >
        <Button variant="primary">Primary</Button>
        <Button variant="glass">Glass</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="success">Success</Button>
        <Button variant="destructive">Destructive</Button>
      </Section>

      <Section
        title="Sizes"
        caption="sm / md / lg / xl. xl is the hero CTA — taller, semibold, for prominent actions."
      >
        <Button size="sm" variant="primary">Small</Button>
        <Button size="md" variant="primary">Medium</Button>
        <Button size="lg" variant="primary">Large</Button>
        <Button size="xl" variant="primary">Extra</Button>
      </Section>

      <Section
        title="1-item & 2-item"
        caption="1-item: icon only or label only. 2-item horizontal: icon + label inline. 2-item vertical: icon stacked above label."
      >
        <Button variant="primary" aria-label="Download"><Download size={18} aria-hidden="true" /></Button>
        <Button variant="primary">Label only</Button>
        <Button variant="glass" leadingIcon={<Download size={18} aria-hidden="true" />}>Horizontal</Button>
        <Button variant="outline" trailingIcon={<ChevronRight size={18} aria-hidden="true" />}>Next</Button>
      </Section>

      <Section
        title="Vertical (icon + label)"
        caption="ZaloPay-style bottom navigation: icon stacked above a short label. fullWidth keeps each item the same width."
        vertical
      >
        <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Search size={20} aria-hidden="true" />}>Search</Button>
        <Button variant="ghost" orientation="vertical" fullWidth active leadingIcon={<EyeOff size={20} aria-hidden="true" />}>Hide</Button>
        <Button variant="success" orientation="vertical" fullWidth leadingIcon={<Check size={20} aria-hidden="true" />}>Done</Button>
        <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<SlidersHorizontal size={20} aria-hidden="true" />}>Custom</Button>
      </Section>

      <Section
        title="States"
        caption="8 states: default, hover, focus, pressed, active(toggle), disabled, loading, error."
      >
        <Button variant="ghost">Inactive</Button>
        <Button variant="ghost" active>Active</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button error>Error</Button>
        <Button variant="success" loading>Saving</Button>
      </Section>

      <Section
        title="Liquid Glass — Apple materials"
        caption="3 material directions, switched through one API. Use the showcase preset switcher above to preview Dawn, Forest, Ocean, and Warmth."
      >
        <Button variant="glass" liquidStyle="regular" leadingIcon={<Search size={18} aria-hidden="true" />}>Regular</Button>
        <Button variant="glass" liquidStyle="clear" leadingIcon={<Image size={18} aria-hidden="true" />}>Clear</Button>
        <Button variant="glass" liquidStyle="prominent" leadingIcon={<Sun size={18} aria-hidden="true" />}>Prominent</Button>
        <Button variant="glass" liquidStyle="regular" elevation="med">Elevated</Button>
        <Button variant="glass" liquidStyle="clear" fullWidth leadingIcon={<Download size={20} aria-hidden="true" />}>Download video</Button>
      </Section>

      <Section
        title="Solid"
        caption="Flat, opaque material for non-glass contexts. Works with any variant: primary, success, destructive, secondary, outline, ghost, link."
      >
        <Button material="solid" variant="primary">Primary</Button>
        <Button material="solid" variant="success">Success</Button>
        <Button material="solid" variant="destructive">Destructive</Button>
        <Button material="solid" variant="secondary">Secondary</Button>
        <Button material="solid" variant="outline">Outline</Button>
        <Button material="solid" variant="ghost">Ghost</Button>
        <Button material="solid" variant="link">Link</Button>
        <Button material="solid" disabled>Disabled</Button>
        <Button material="solid" loading>Loading</Button>
      </Section>

      <Section
        title="Surfaces"
        caption="Extreme white and black surfaces to verify the conic rim and contact shadow remain visible; solid stays opaque and legible."
      >
        <div data-theme="light" className={styles.surfaceWhite}>
          <Button variant="primary" leadingIcon={<Download size={18} aria-hidden="true" />}>White</Button>
          <Button variant="ghost" aria-label="Close"><X size={18} aria-hidden="true" /></Button>
          <Button variant="glass" size="lg">Large</Button>
          <Button material="solid" variant="primary">Solid</Button>
        </div>
        <div data-theme="dark" className={styles.surfaceBlack}>
          <Button variant="primary" leadingIcon={<Download size={18} aria-hidden="true" />}>Black</Button>
          <Button variant="ghost" aria-label="Close"><X size={18} aria-hidden="true" /></Button>
          <Button variant="glass" size="lg">Large</Button>
          <Button material="solid" variant="primary">Solid</Button>
        </div>
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Button',
  description: 'Button atom — Liquid Glass + Solid. 7 canonical variants (primary, glass, outline, ghost, solid, success, destructive) + 3 aliases (secondary, primarySubtle, link). 4 sizes (sm/md/lg/xl). 2 orientations. 8 states (default, hover, focus, pressed, active, disabled, loading, error). Pill shape, caustic highlights, smoked-blue glass, no idle motion. Token-driven, theme-agnostic.',
  level: 'atoms',
  category: 'Action',
  group: 'Shared UI — Action',
  order: 10,
};
