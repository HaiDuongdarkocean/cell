import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Select } from '@/shared/ui/Select';
import { HintIcon } from '@/shared/ui/HintIcon';
import { FIELD_DEFS, type DownloadSettings, type SettingKey } from './mockData';
import styles from './mockup.module.css';

/** Shared props for every panel/concept in this mockup. */
export interface PanelProps {
  settings: DownloadSettings;
  onChange: (key: SettingKey, raw: string) => void;
}

interface SectionFrameProps {
  children: React.ReactNode;
  /** Remove `overflow: hidden` so sticky children (Concept C summary bar) work. */
  noClip?: boolean;
}

export function SectionFrame({ children, noClip = false }: SectionFrameProps): React.ReactElement {
  return (
    <div
      className={[styles.mksCard, noClip ? styles.mksCardNoClip : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.mksCardHeader}>
        <Heading level={4} size={4} className={styles.mksCardTitle}>
          Download
        </Heading>
        <Text as="p" color="secondary" className={styles.mksCardDesc}>
          Download format, quality, concurrency, conversion, and filename options.
        </Text>
      </div>
      <div className={styles.mksCardBody}>{children}</div>
    </div>
  );
}

/** Small uppercase group header — mirrors the production `.groupLabel`. */
export function GroupLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className={styles.mksGroupLabel}>{children}</div>;
}

interface FieldSelectProps {
  id: string;
  field: SettingKey;
  settings: DownloadSettings;
  onChange: PanelProps['onChange'];
}

/** The shared `Select` bound to a `DownloadSettings` key (raw string in/out). */
export function FieldSelect({
  id,
  field,
  settings,
  onChange,
}: FieldSelectProps): React.ReactElement {
  return (
    <div className={styles.mksSelect}>
      <Select
        id={id}
        data-cell-id={`${field}-select`}
        value={String(settings[field])}
        options={FIELD_DEFS[field].options}
        onChange={(raw) => onChange(field, raw)}
        aria-label={FIELD_DEFS[field].label}
      />
    </div>
  );
}

interface FieldRowProps {
  field: SettingKey;
  settings: DownloadSettings;
  onChange: PanelProps['onChange'];
  /** Unique prefix for the select id / label htmlFor. */
  idPrefix: string;
  /** Label above the select instead of beside it. */
  stacked?: boolean;
  divider?: boolean;
  className?: string;
}

/** Label (+ optional HintIcon) beside/above a `FieldSelect` inside a `SettingsRow`. */
export function FieldRow({
  field,
  settings,
  onChange,
  idPrefix,
  stacked = false,
  divider = false,
  className,
}: FieldRowProps): React.ReactElement {
  const def = FIELD_DEFS[field];
  const hint = def.hint?.(settings);
  const id = `${idPrefix}-${field}`;
  return (
    <SettingsRow dense stacked={stacked} divider={divider} className={className}>
      {hint ? (
        <span className={styles.mksRowLabel}>
          {def.label}
          <HintIcon hint={hint} ariaLabel={`Show hint for ${def.label}`} />
        </span>
      ) : (
        <label className={styles.mksRowLabel} htmlFor={id}>
          {def.label}
        </label>
      )}
      <FieldSelect id={id} field={field} settings={settings} onChange={onChange} />
    </SettingsRow>
  );
}
