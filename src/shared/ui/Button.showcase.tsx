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
        title="Variants"
        caption="Primary for the main CTA. Secondary for alternatives. Outline, ghost and link for lower emphasis. Destructive for irreversible actions."
      >
        <Button variant="primary">Primary</Button>
        <Button variant="primarySubtle">Primary Subtle</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Section>

      <Section
        title="Active / toggle"
        caption="Use the active prop for toggled states on outline and ghost variants."
      >
        <Button variant="outline">Inactive</Button>
        <Button variant="outline" active>Active</Button>
        <Button variant="ghost">Ghost inactive</Button>
        <Button variant="ghost" active>Ghost active</Button>
      </Section>

      <Section
        title="Sizes"
        caption="Small for dense toolbars, medium as the default, large for prominent actions."
      >
        <Button size="sm" variant="primary">Small</Button>
        <Button size="md" variant="primary">Medium</Button>
        <Button size="lg" variant="primary">Large</Button>
      </Section>

      <Section
        title="Vertical (icon + label)"
        caption="ZaloPay-style bottom navigation: icon stacked above a short label. fullWidth keeps each item the same width."
        vertical
      >
        <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Icon name="search" size={20} />}>Search</Button>
        <Button variant="ghost" orientation="vertical" fullWidth active leadingIcon={<Icon name="eyeOff" size={20} />}>Hide</Button>
        <Button variant="primarySubtle" orientation="vertical" fullWidth leadingIcon={<Icon name="generateNative" size={20} />}>Generate</Button>
        <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Icon name="slidersHorizontal" size={20} />}>Customize</Button>
      </Section>

      <Section
        title="Liquid Glass"
        caption="Frosted glass surface that lifts on hover. Ideal for floating toolbars and panels."
      >
        <Button variant="glass">Glass</Button>
        <Button variant="glass" leadingIcon={<Icon name="zap" size={18} />}>Glass icon</Button>
      </Section>

      <Section
        title="States"
        caption="Disabled, loading, full-width and elevated (shadow) treatments."
      >
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button fullWidth>Full width</Button>
        <Button elevation="med">Elevated</Button>
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Button',
  description: 'Button atom — 7 variants (primary, primarySubtle, secondary, outline, ghost, destructive, link), 2 orientations (horizontal, vertical), 3 sizes, active toggle state. Token-driven, theme-agnostic.',
  level: 'atoms',
  category: 'Action',
  group: 'Shared UI — Action',
  order: 10,
};
