import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { SelectableCard } from '@/shared/ui/SelectableCard';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import { handleRadioGroupKeyDown } from '@/shared/lib/dom/radioGroupKeyNav';
import { t } from '@/shared/i18n';
import { resolveProfile, type LanguageProfile } from '@/entities/settings';
import styles from './LanguageProfileCard.module.css';

const langLabel = (code: string): string =>
  OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;
const langShort = (code: string): string => langLabel(code).split(' (')[0];

export interface LanguageProfileCardProps {
  readonly profile: LanguageProfile;
  /** Resolves `profile.native` when it is empty ('' = inherit). */
  readonly universalNative: string;
  readonly selected: boolean;
  readonly tabIndex?: number;
  readonly onSelect: () => void;
  /** Trailing slot next to the card (e.g. the settings kebab). Omit for
   *  quick-pick rows. */
  readonly trailing?: ReactNode;
  readonly 'data-tihoka-id'?: string;
}

/**
 * LanguageProfileCard — the one profile row: radio dot, native→target flags,
 * target name + native meta. Settings list and the universal-panel quick
 * switcher render this same component so a design change lands in both.
 */
export function LanguageProfileCard({
  profile,
  universalNative,
  selected,
  tabIndex,
  onSelect,
  trailing,
  'data-tihoka-id': dataTihokaId,
}: LanguageProfileCardProps): React.JSX.Element {
  const resolved = resolveProfile(profile, universalNative);
  return (
    <div className={styles.item}>
      <SelectableCard
        role="radio"
        selected={selected}
        tabIndex={tabIndex}
        onSelect={onSelect}
        className={styles.card}
        data-tihoka-id={dataTihokaId}
      >
        <span className={styles.radio} aria-hidden="true" />
        <span className={styles.flags}>
          <FlagIcon lang={resolved.native} size={20} title={langLabel(resolved.native)} />
          <Icon name="chevronRight" size="xs" />
          <FlagIcon lang={resolved.target} size={28} title={langLabel(resolved.target)} />
        </span>
        <span className={styles.cardText}>
          <span className={styles.cardName}>{langLabel(resolved.target)}</span>
          <span className={styles.cardMeta}>
            {profile.native
              ? t('settings.profiles.card.nativeCustom', [langShort(resolved.native)])
              : t('settings.profiles.card.native', [langShort(resolved.native)])}
          </span>
        </span>
      </SelectableCard>
      {trailing}
    </div>
  );
}

/** Radio-group wrapper shared by both list consumers — keeps the roving
 *  arrow-key behaviour and aria-label identical everywhere. */
export function LanguageProfileCardList({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <div
      className={styles.list}
      role="radiogroup"
      aria-label={t('settings.profiles.list.aria')}
      onKeyDown={handleRadioGroupKeyDown}
    >
      {children}
    </div>
  );
}
