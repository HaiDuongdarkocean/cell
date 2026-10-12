import { useMemo, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { SelectableCard } from '@/shared/ui/SelectableCard';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Dialog } from '@/shared/ui/Dialog';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { OVERLAY_LANGUAGE_OPTIONS, toIso6391, baseLangCode } from '@/shared/config/languageRegistry';
import { t } from '@/shared/i18n';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_SETTINGS,
} from '@/shared/config/config';
import type { LanguageProfile, Settings } from '@/entities/settings';
import {
  buildProfileName,
  profileIdForTarget,
  getActiveProfileSettings,
  resolveProfile,
  validateLanguageProfile,
} from '@/entities/settings';
import { ProfileForm } from './ProfileForm';
import { ProfileMenu } from './ProfileMenu';
import { Text } from '@/shared/ui/Text';
import styles from './LanguageProfilePanel.module.css';

interface LanguageProfilePanelProps {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
}

type FormState = { mode: 'add' } | { mode: 'edit'; id: string } | null;

function recomputeOrder(profiles: LanguageProfile[]): LanguageProfile[] {
  return profiles.map((p, index) => ({ ...p, order: index + 1 }));
}

const langLabel = (code: string): string =>
  OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;
const langShort = (code: string): string => langLabel(code).split(' (')[0];

export function LanguageProfilePanel({ settings, onChange }: LanguageProfilePanelProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bannerEditing, setBannerEditing] = useState(false);
  const [bannerDraft, setBannerDraft] = useState(settings.universalNativeLanguage);

  const profiles = useMemo(
    () => [...(settings.languageProfiles ?? [])].sort((a, b) => a.order - b.order),
    [settings.languageProfiles],
  );
  const active = useMemo(() => getActiveProfileSettings(settings), [settings]);
  const deleting = profiles.find((p) => p.id === deletingId);

  /* --- Mutations --- */

  const setActive = (id: string): void => {
    onChange({ ...settings, activeProfileId: id });
  };

  const move = (id: string, direction: -1 | 1): void => {
    const index = profiles.findIndex((p) => p.id === id);
    const newIndex = index + direction;
    if (index < 0 || newIndex < 0 || newIndex >= profiles.length) return;
    const reordered = [...profiles];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    onChange({ ...settings, languageProfiles: recomputeOrder(reordered) });
  };

  const deleteProfile = (id: string): void => {
    const remaining = settings.languageProfiles.filter((p) => p.id !== id);
    const nextActive =
      settings.activeProfileId === id ? (remaining[0]?.id ?? null) : settings.activeProfileId;
    // The SRS slice keeps its own profile pointer — clear the active SRS
    // ids when they reference the deleted profile so first-run doesn't
    // resolve to a collection whose profile no longer exists.
    const srs = settings.srs?.activeLanguageProfileId === id
      ? {
          ...settings.srs,
          activeLanguageProfileId: nextActive,
          activeCollectionId: null,
          activeDeckId: null,
          activeNotetypeId: null,
          defaultStudyConfigId: null,
        }
      : settings.srs;
    onChange({
      ...settings,
      languageProfiles: recomputeOrder(remaining),
      activeProfileId: nextActive,
      srs,
    });
    if (form?.mode === 'edit' && form.id === id) setForm(null);
  };

  const validate = (target: string, nativeOverride: string, excludeId?: string): string[] | null => {
    const result = validateLanguageProfile(
      { target, native: nativeOverride },
      settings.languageProfiles,
      excludeId ?? null,
    );
    if (result.valid) return null;
    // Map internal validation flags to localized copy — raw English literals
    // from the entity layer must not leak into the UI.
    return [
      result.emptyTarget ? t('settings.profiles.error.required') : '',
      result.duplicate ? t('settings.profiles.error.duplicate') : '',
    ].filter(Boolean);
  };

  const handleAdd = (target: string, nativeOverride: string, copyFromActive: boolean): string[] | null => {
    const errors = validate(target, nativeOverride);
    if (errors) return errors;

    const names = settings.languageProfiles.map((p) => p.name);
    const base = copyFromActive && active ? active : undefined;
    const newProfile: LanguageProfile = {
      id: profileIdForTarget(target),
      target,
      native: nativeOverride,
      name: buildProfileName(nativeOverride, settings.universalNativeLanguage, target, names),
      order: settings.languageProfiles.length + 1,
      subtitleOverlayTargetStyle: base?.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
      subtitleOverlayNativeStyle: base?.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
      subtitleOverlayAutoLoad: base?.subtitleOverlayAutoLoad ?? DEFAULT_SETTINGS.subtitleOverlayAutoLoad,
      subtitleOverlayAutoLoadAsr: base?.subtitleOverlayAutoLoadAsr ?? DEFAULT_SETTINGS.subtitleOverlayAutoLoadAsr,
      subtitleOverlayAutoTranslate:
        base?.subtitleOverlayAutoTranslate ?? DEFAULT_SETTINGS.subtitleOverlayAutoTranslate,
      dictionaryPopup: base?.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
      showReadings: base?.showReadings ?? (toIso6391(baseLangCode(target)) === 'zh'),
      showWordTranslations: base?.showWordTranslations ?? false,
    };
    onChange({
      ...settings,
      languageProfiles: recomputeOrder([...settings.languageProfiles, newProfile]),
      activeProfileId: settings.activeProfileId ?? newProfile.id,
    });
    setForm(null);
    return null;
  };

  const handleUpdate = (id: string, target: string, nativeOverride: string): string[] | null => {
    const errors = validate(target, nativeOverride, id);
    if (errors) return errors;

    const names = settings.languageProfiles.filter((p) => p.id !== id).map((p) => p.name);
    onChange({
      ...settings,
      languageProfiles: recomputeOrder(
        settings.languageProfiles.map((p) =>
          p.id === id
            ? {
                ...p,
                native: nativeOverride,
                name: buildProfileName(nativeOverride, settings.universalNativeLanguage, p.target, names),
              }
            : p,
        ),
      ),
    });
    setForm(null);
    return null;
  };

  const canAdd = profiles.length === 0 || active !== null;

  return (
    <div className={styles.panel}>
      {/* Universal native — global setting shared by every profile. View mode
          shows flag + value; Change swaps the whole banner into edit mode with
          a live draft preview + explicit Cancel/Save. */}
      <div className={`${styles.banner} ${bannerEditing ? styles.bannerEditing : ''}`}>
        {bannerEditing ? (
          <>
            <div className={styles.bannerRow}>
              <FlagIcon lang={bannerDraft} size={22} title={langLabel(bannerDraft)} />
              <div className={styles.bannerText}>
                <Text variant="label" color="secondary" as="div" className={styles.bannerLabel}>{t('settings.profiles.banner.label')}</Text>
                <div className={styles.bannerValue}>{langShort(bannerDraft)}</div>
              </div>
            </div>
            <SearchableSelect
              testId="universal-native-language"
              dataTestId="universal-native-language"
              options={OVERLAY_LANGUAGE_OPTIONS}
              value={bannerDraft}
              onChange={setBannerDraft}
              ariaLabel={t('settings.profiles.banner.aria')}
              placeholder={t('settings.profiles.form.search')}
            />
            <div className={styles.bannerActions}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setBannerEditing(false)}>
                {t('settings.profiles.form.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange({ ...settings, universalNativeLanguage: bannerDraft });
                  setBannerEditing(false);
                }}
              >
                {t('settings.profiles.form.save')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <FlagIcon lang={settings.universalNativeLanguage} size={22} title={langLabel(settings.universalNativeLanguage)} />
            <div className={styles.bannerText}>
              <Text variant="label" color="secondary" as="div" className={styles.bannerLabel}>{t('settings.profiles.banner.label')}</Text>
              <div className={styles.bannerValue} data-cell-id="universal-native-banner-value">{langShort(settings.universalNativeLanguage)}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setBannerDraft(settings.universalNativeLanguage);
                setBannerEditing(true);
              }}
            >
              {t('settings.profiles.banner.change')}
            </Button>
          </>
        )}
      </div>

      {form?.mode === 'add' && (
        <ProfileForm
          mode="add"
          universalNative={settings.universalNativeLanguage}
          activeName={active?.name ?? null}
          onCancel={() => setForm(null)}
          onSubmit={handleAdd}
        />
      )}

      {profiles.length === 0 && form?.mode !== 'add' ? (
        <EmptyState
          size="compact"
          icon={<Icon name="languages" size="lg" />}
          title={t('settings.profiles.empty.title')}
          description={t('settings.profiles.empty.desc')}
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => setForm({ mode: 'add' })}
            >
              <Icon name="plus" size="xs" /> {t('settings.profiles.empty.cta')}
            </Button>
          }
        />
      ) : (
        <SettingsGroup
          label={t('settings.profiles.list.label', [profiles.length])}
          action={
            <Button
              type="button"
              variant="link"
              size="sm"
              aria-expanded={form?.mode === 'add'}
              disabled={!canAdd}
              data-cell-id="add-language-profile"
              onClick={() => setForm(form?.mode === 'add' ? null : { mode: 'add' })}
            >
              <Icon name={form?.mode === 'add' ? 'x' : 'plus'} size="xs" />
              {form?.mode === 'add' ? t('settings.profiles.closeForm') : t('settings.profiles.new')}
            </Button>
          }
        >
        <div className={styles.list} role="radiogroup" aria-label={t('settings.profiles.list.aria')}>
          {profiles.map((profile, index) => {
            const resolved = resolveProfile(profile, settings.universalNativeLanguage);
            const isActive = settings.activeProfileId === profile.id;

            if (form?.mode === 'edit' && form.id === profile.id) {
              return (
                <div key={profile.id} className={styles.item}>
                  <ProfileForm
                    mode="edit"
                    universalNative={settings.universalNativeLanguage}
                    activeName={null}
                    initialTarget={profile.target}
                    initialNative={profile.native}
                    onCancel={() => setForm(null)}
                    onSubmit={(t2, n) => handleUpdate(profile.id, t2, n)}
                  />
                </div>
              );
            }

            return (
              <div key={profile.id} className={styles.item}>
                <SelectableCard
                  role="radio"
                  selected={isActive}
                  onSelect={() => setActive(profile.id)}
                  className={styles.card}
                  data-cell-id={`language-profile-card-${profile.id}`}
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
                <ProfileMenu
                  label={t('settings.profiles.menu.aria', [profile.name])}
                  items={[
                    {
                      key: 'edit',
                      label: t('settings.profiles.menu.edit'),
                      icon: 'pencil',
                      onSelect: () => setForm({ mode: 'edit', id: profile.id }),
                    },
                    {
                      key: 'up',
                      label: t('settings.profiles.menu.moveUp'),
                      icon: 'moveVertical',
                      disabled: index === 0,
                      onSelect: () => move(profile.id, -1),
                    },
                    {
                      key: 'down',
                      label: t('settings.profiles.menu.moveDown'),
                      icon: 'moveVertical',
                      disabled: index === profiles.length - 1,
                      onSelect: () => move(profile.id, 1),
                    },
                    {
                      key: 'delete',
                      label: t('settings.profiles.menu.delete'),
                      icon: 'trash',
                      danger: true,
                      disabled: profiles.length === 1 && isActive,
                      onSelect: () => setDeletingId(profile.id),
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
        </SettingsGroup>
      )}

      <Dialog
        open={deletingId !== null}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title={deleting ? t('settings.profiles.delete.title', [deleting.name]) : ''}
        showCloseButton
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {t('settings.profiles.delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              data-cell-id="profile-delete-confirm"
              onClick={() => {
                if (deletingId) deleteProfile(deletingId);
                setDeletingId(null);
              }}
            >
              {t('settings.profiles.delete.confirm')}
            </Button>
          </>
        }
        data-cell-id="profile-delete-dialog"
      >
        <Text as="p" color="secondary">
          {t('settings.profiles.delete.body')}
        </Text>
      </Dialog>
    </div>
  );
}
