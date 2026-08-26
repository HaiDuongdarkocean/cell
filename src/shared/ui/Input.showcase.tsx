import { useState, useId, type ReactElement, type ReactNode } from 'react';
import { Input } from './Input';
import styles from './Input.showcase.module.css';

interface SectionProps {
  title: string;
  caption: string;
  children: ReactNode;
}

function Section({ title, caption, children }: SectionProps): ReactElement {
  const id = useId();
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h3 id={id} className={styles.title}>{title}</h3>
      <p className={styles.caption}>{caption}</p>
      <div className={styles.row}>{children}</div>
    </section>
  );
}

export function Showcase(): ReactElement {
  const [value, setValue] = useState('');
  return (
    <div className={styles.root}>
      <Section
        title="Sizes"
        caption="Small for compact forms, medium as the default, large for prominent single-field flows."
      >
        <Input size="sm" placeholder="Small input" value={value} onChange={(e) => setValue(e.target.value)} />
        <Input placeholder="Default input" value={value} onChange={(e) => setValue(e.target.value)} />
        <Input size="lg" placeholder="Large input" value={value} onChange={(e) => setValue(e.target.value)} />
      </Section>

      <Section
        title="Validation & state"
        caption="Error state with a message and disabled state. Errors should be brief and actionable."
      >
        <Input placeholder="With error" value="invalid" error errorMessage="This value is not valid" />
        <Input placeholder="Disabled" disabled />
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Input',
  description: 'Controlled text input with sizes (sm, md, lg) and error state. Use for form fields and user text entry.',
  level: 'atoms',
  category: 'Input',
  group: 'Shared UI — Input',
  order: 20,
};
