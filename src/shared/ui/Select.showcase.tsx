import { useState, useId, type ReactElement, type ReactNode } from 'react';
import { Select } from './Select';
import styles from './Select.showcase.module.css';

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '中文', disabled: true },
  { value: 'ja', label: '日本語' },
];

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
  const [value, setValue] = useState('en');
  const [value2, setValue2] = useState('');

  return (
    <div className={styles.root}>
      <Section
        title="Single select"
        caption="Default state, empty selection, and a disabled option. The menu opens from the trigger and matches the design system scrollable pattern."
      >
        <Select options={OPTIONS} value={value} onChange={setValue} placeholder="Choose a language" />
        <Select options={OPTIONS} value={value2} onChange={setValue2} placeholder="Choose a language" />
      </Section>

      <Section
        title="Validation & state"
        caption="Error and disabled states. Error highlights the trigger border; disabled dims the control."
      >
        <Select options={OPTIONS} value={value2} onChange={setValue2} error placeholder="Select with error" />
        <Select options={OPTIONS} value="" onChange={() => {}} disabled placeholder="Disabled select" />
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Select',
  description: 'Single-select dropdown with a button trigger, scrollable listbox, disabled options, and error state. Themed to match the design system inputs.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  order: 21,
};
