import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
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
        <Button variant="primary" aria-label="Download"><Icon name="download" size={18} /></Button>
        <Button variant="primary">Label only</Button>
        <Button variant="glass" leadingIcon={<Icon name="download" size={18} />}>Horizontal</Button>
        <Button variant="outline" trailingIcon={<Icon name="chevronRight" size={18} />}>Next</Button>
      </Section>

      <Section
        title="Vertical (icon + label)"
        caption="ZaloPay-style bottom navigation: icon stacked above a short label. fullWidth keeps each item the same width."
        vertical
      >
        <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Icon name="search" size={20} />}>Search</Button>
        <Button variant="ghost" orientation="vertical" fullWidth active leadingIcon={<Icon name="eyeOff" size={20} />}>Hide</Button>
        <Button variant="success" orientation="vertical" fullWidth leadingIcon={<Icon name="check" size={20} />}>Done</Button>
        <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Icon name="slidersHorizontal" size={20} />}>Custom</Button>
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
        <Button variant="glass" liquidStyle="regular" leadingIcon={<Icon name="search" size={18} />}>Regular</Button>
        <Button variant="glass" liquidStyle="clear" leadingIcon={<Icon name="image" size={18} />}>Clear</Button>
        <Button variant="glass" liquidStyle="prominent" leadingIcon={<Icon name="sun" size={18} />}>Prominent</Button>
        <Button variant="glass" liquidStyle="regular" elevation="med">Elevated</Button>
        <Button variant="glass" liquidStyle="clear" fullWidth leadingIcon={<Icon name="download" size={20} />}>Download video</Button>
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Button',
  description: 'Button atom — Liquid Glass. 6 canonical variants (primary, glass, outline, ghost, success, destructive) + 3 aliases (secondary, primarySubtle, link). 4 sizes (sm/md/lg/xl). 2 orientations. 8 states (default, hover, focus, pressed, active, disabled, loading, error). Pill shape, caustic highlights, smoked-blue glass, no idle motion. Token-driven, theme-agnostic.',
  level: 'atoms',
  category: 'Action',
  group: 'Shared UI — Action',
  order: 10,
};
