import { Button } from './Button';
import {
  Check,
  ChevronRight,
  Download,
  EyeOff,
  Search,
  SlidersHorizontal,
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
        title="Variants"
        caption="9 canonical variants, all solid. Primary is the single main action; destructive is reserved for irreversible actions; link navigates. Token-driven, theme-agnostic."
      >
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="primarySubtle">Primary Subtle</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="success">Success</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button variant="transparent">Transparent</Button>
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
        <Button variant="primary" leadingIcon={<Download size={18} aria-hidden="true" />}>Horizontal</Button>
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
        title="Surfaces"
        caption="Extreme white and black surfaces to verify the solid surfaces stay opaque and legible on both themes."
      >
        <div data-theme="light" className={styles.surfaceWhite}>
          <Button variant="primary" leadingIcon={<Download size={18} aria-hidden="true" />}>White</Button>
          <Button variant="ghost" aria-label="Close"><X size={18} aria-hidden="true" /></Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
        <div data-theme="dark" className={styles.surfaceBlack}>
          <Button variant="primary" leadingIcon={<Download size={18} aria-hidden="true" />}>Black</Button>
          <Button variant="ghost" aria-label="Close"><X size={18} aria-hidden="true" /></Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Button',
  description: 'Button atom — solid only (Liquid Glass removed 2026-09-08). 9 canonical variants (primary, secondary, primarySubtle, outline, ghost, success, destructive, link, transparent). 5 sizes (xs/sm/md/lg/xl). 2 orientations. 8 states (default, hover, focus, pressed, active, disabled, loading, error). Pill shape, theme-agnostic tokens.',
  level: 'atoms',
  category: 'Action',
  group: 'Shared UI — Action',
  order: 10,
};
