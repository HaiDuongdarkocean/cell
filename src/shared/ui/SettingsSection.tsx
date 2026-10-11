import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { Heading } from './Heading';
import { Text } from './Text';
import { HintIcon } from './HintIcon';
import styles from './SettingsSection.module.css';

export interface SettingsSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Section title, rendered as a Heading. */
  title: ReactNode;
  /** Supporting line under the title. */
  description?: ReactNode;
  /** Optional ⓘ popover attached to the title for secondary explanation. */
  hint?: string;
  hintAriaLabel?: string;
  /** Semantic heading level (visual size stays `size=3`). Default: 3. */
  headingLevel?: 2 | 3 | 4 | 5;
  /** Section body — SettingsRow / SettingsGroup / embedded panel content. */
  children?: ReactNode;
}

/**
 * SettingsSection — flat settings-page band: title + description + body rows,
 * separated from siblings by whitespace and a hairline. Replaces the boxed
 * card recipe; forwards ref + data-section for scroll-sync anchors.
 */
export const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(function SettingsSection(
  { title, description, hint, hintAriaLabel, headingLevel = 3, children, className, ...rest },
  ref: Ref<HTMLElement>,
): React.JSX.Element {
  const cls = [styles.section, className ?? ''].filter(Boolean).join(' ');
  return (
    <section ref={ref} className={cls} {...rest}>
      <div className={styles.header}>
        <Heading level={headingLevel} size={3} className={styles.title}>
          {title}
          {hint && <HintIcon hint={hint} ariaLabel={hintAriaLabel ?? ''} />}
        </Heading>
        {description && (
          <Text as="p" variant="supporting" color="secondary" className={styles.description}>
            {description}
          </Text>
        )}
      </div>
      {children && <div className={styles.body}>{children}</div>}
    </section>
  );
});
