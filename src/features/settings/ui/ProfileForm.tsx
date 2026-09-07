import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import { t } from '@/shared/i18n';
import styles from './LanguageProfilePanel.module.css';

const UNIVERSAL_SENTINEL = '__universal__';

const langLabel = (code: string): string =>
  OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;

export interface ProfileFormProps {
  /** 'add' = new profile (with Advanced); 'edit' = identity only, rendered in-place. */
  readonly mode?: 'add' | 'edit';
  readonly universalNative: string;
  /** Active profile name for the "copy settings" choice; null hides Advanced. */
  readonly activeName: string | null;
  readonly initialTarget?: string;
  /** '' = inherit universal native; undefined → default inherit (add mode). */
  readonly initialNative?: string;
  readonly onCancel: () => void;
  /** Returns validation error messages to display, or null when the save succeeded. */
  readonly onSubmit: (target: string, nativeOverride: string, copyFromActive: boolean) => string[] | null;
}

/**
 * ProfileForm — inline profile editor.
 * add: Target → Native (universal default) → Advanced (start-from copy), all progressive.
 * edit: identity only — learning settings stay in the shared sections that write
 * into the active profile.
 */
export function ProfileForm({
  mode = 'add',
  universalNative,
  activeName,
  initialTarget = '',
  initialNative,
  onCancel,
  onSubmit,
}: ProfileFormProps): React.JSX.Element {
  const isEdit = mode === 'edit';
  const [target, setTarget] = useState(initialTarget);
  const [nativeChoice, setNativeChoice] = useState(
    initialNative === undefined || initialNative === '' ? UNIVERSAL_SENTINEL : initialNative,
  );
  const [startFrom, setStartFrom] = useState<'clean' | 'copy'>('clean');
  const [advOpen, setAdvOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const nativeOptions = [
    { value: UNIVERSAL_SENTINEL, label: t('settings.profiles.form.universal', [langLabel(universalNative)]) },
    ...OVERLAY_LANGUAGE_OPTIONS.filter((o) => o.value !== ''),
  ];

  const save = (): void => {
    const errs = onSubmit(
      target,
      nativeChoice === UNIVERSAL_SENTINEL ? '' : nativeChoice,
      startFrom === 'copy',
    );
    if (errs) setErrors(errs);
  };

  return (
    <div
      className={styles.profileForm}
      role="group"
      aria-label={isEdit ? t('settings.profiles.form.editAria') : t('settings.profiles.form.addAria')}
    >
      {errors.length > 0 && (
        <div className={styles.formError} role="alert" data-cell-id="language-profile-validation">
          {errors.join(' ')}
        </div>
      )}

      <div className={styles.formField}>
        <div className={styles.formLabel}>{t('settings.profiles.form.target')} *</div>
        <SearchableSelect
          testId="profile-target-language"
          dataTestId="profile-target-language"
          options={OVERLAY_LANGUAGE_OPTIONS.filter((o) => o.value !== '')}
          value={target}
          onChange={setTarget}
          ariaLabel={t('settings.profiles.form.targetAria')}
          placeholder={t('settings.profiles.form.search')}
        />
        <div className={styles.formHint}>{t('settings.profiles.form.targetHint')}</div>
      </div>

      <div className={styles.formField}>
        <div className={styles.formLabel}>{t('settings.profiles.form.native')}</div>
        <SearchableSelect
          testId="profile-native-language"
          dataTestId="profile-native-language"
          options={nativeOptions}
          value={nativeChoice}
          onChange={setNativeChoice}
          ariaLabel={t('settings.profiles.form.nativeAria')}
        />
        <div className={styles.formHint}>{t('settings.profiles.form.nativeHint')}</div>
      </div>

      {!isEdit && activeName && (
        <div className={styles.formField}>
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={advOpen}
            onClick={() => setAdvOpen((v) => !v)}
          >
            <Icon name={advOpen ? 'chevronDown' : 'chevronRight'} size="xs" />
            {t('settings.profiles.form.advanced')}
            <span className={styles.formHint}>{t('settings.profiles.form.advancedHint')}</span>
          </button>
          {advOpen && (
            <div className={styles.choiceGrid} role="radiogroup" aria-label={t('settings.profiles.form.advanced')}>
              <button
                type="button"
                role="radio"
                aria-checked={startFrom === 'clean'}
                className={styles.choice}
                onClick={() => setStartFrom('clean')}
              >
                <span className={styles.choiceTitle}>{t('settings.profiles.form.clean')}</span>
                <span className={styles.choiceDesc}>{t('settings.profiles.form.cleanDesc')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={startFrom === 'copy'}
                className={styles.choice}
                onClick={() => setStartFrom('copy')}
              >
                <span className={styles.choiceTitle}>{t('settings.profiles.form.copy', [activeName])}</span>
                <span className={styles.choiceDesc}>{t('settings.profiles.form.copyDesc')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.formActions}>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('settings.profiles.form.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!isEdit && !target}
          data-cell-id="save-language-profile"
        >
          {isEdit ? t('settings.profiles.form.save') : t('settings.profiles.form.add')}
        </Button>
      </div>
    </div>
  );
}
