import type { ReactElement } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { Icon } from '@/shared/icons/Icon';
import { langToCountry } from '@/shared/config/langToCountry';
import styles from './FlagIcon.module.css';

export interface FlagIconProps {
  /** Language code (ISO 639-1 or BCP 47 variant, e.g. 'vi', 'en', 'zh-hans'). */
  readonly lang: string;
  /** Flag width/height in px. If omitted, fills the parent container. */
  readonly size?: number;
  /** Extra class names. */
  readonly className?: string;
  /** Alt/title text for accessibility. */
  readonly title?: string;
}

/**
 * FlagIcon — renders a country flag SVG for a language code.
 *
 * Uses `country-flag-icons` (250+ SVG flags, ~1KB each). Maps ISO 639-1
 * language → ISO 3166-1 country via `langToCountry`. Languages without a
 * primary country (Latin, Esperanto, etc.) fall back to the `languages` icon.
 *
 * The flag is clipped to a circle via CSS so it works as an avatar.
 */
export function FlagIcon({
  lang,
  size,
  className,
  title,
}: FlagIconProps): ReactElement {
  const countryCode = langToCountry(lang);
  const FlagComponent = countryCode ? (Flags as Record<string, Flags.FlagComponent | undefined>)[countryCode] : undefined;

  if (!FlagComponent) {
    return <Icon name="languages" size={size ?? 20} className={className} aria-label={title} />;
  }

  return (
    <span
      className={`${styles.wrapper} ${className ?? ''}`.trim()}
      style={size ? { width: size, height: size } : undefined}
      role="img"
      aria-label={title ?? `Flag for ${lang}`}
    >
      <FlagComponent
        className={styles.flag}
        title={title}
        preserveAspectRatio="xMidYMid slice"
      />
    </span>
  );
}
