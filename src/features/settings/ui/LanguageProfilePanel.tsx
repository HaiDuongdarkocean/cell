import { useMemo, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Dialog } from '@/shared/ui/Dialog';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsPanel } from '@/shared/ui/SettingsPanel';
import { SettingsRow } from '@/shared/ui/SettingsRow';
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
  validateLanguageProfile,
} from '@/entities/settings';
import { checkProfileData, wipeProfileData } from '../services/profileDataClient';
import { LanguageProfileCard, LanguageProfileCardList } from './LanguageProfileCard';
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


export function LanguageProfilePanel({ settings, onChange }: LanguageProfilePanelProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retarget, setRetarget] = useState<{ profile: LanguageProfile; newTarget: string } | null>(null);
  const [retargetNotice, setRetargetNotice] = useState<string | null>(null);

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
      readingDisplay: base?.readingDisplay ?? (toIso6391(baseLangCode(target)) === 'zh' ? 'always' : 'off'),
      glossDisplay: base?.glossDisplay ?? 'off',
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
    const newId = profileIdForTarget(target);
    onChange({
      ...settings,
      languageProfiles: recomputeOrder(
        settings.languageProfiles.map((p) =>
          p.id === id
            ? {
                ...p,
                id: newId,
                target,
                native: nativeOverride,
                name: buildProfileName(nativeOverride, settings.universalNativeLanguage, target, names),
              }
            : p,
        ),
      ),
      activeProfileId: settings.activeProfileId === id ? newId : settings.activeProfileId,
      srs: settings.srs?.activeLanguageProfileId === id
        ? { ...settings.srs, activeLanguageProfileId: newId }
        : settings.srs,
    });
    setForm(null);
    return null;
  };

  /** Edit-form gate — runs when the user picks a different target. Returns
   *  true to accept the pick silently (no data to lose), false to revert. */
  const handleTargetChange = async (profile: LanguageProfile, newTarget: string): Promise<boolean> => {
    if (newTarget === profile.target) return true;
    if (settings.languageProfiles.some((p) => p.id === profileIdForTarget(newTarget))) {
      setRetargetNotice(t('settings.profiles.retarget.dupBody', [langLabel(newTarget)]));
      return false;
    }
    try {
      const status = await checkProfileData(profile.target, profile.id);
      if (status.vocab === 0 && status.resources === 0 && !status.srs) return true;
    } catch {
      /* check failed — still warn; a missing store wipes clean anyway */
    }
    setRetarget({ profile, newTarget });
    return false;
  };

  const confirmRetarget = async (): Promise<void> => {
    const pending = retarget;
    setRetarget(null);
    if (!pending) return;
    const { profile, newTarget } = pending;
    try {
      await wipeProfileData(profile.target, profile.id);
    } catch (err) {
      setRetargetNotice(t('settings.profiles.retarget.failed', [err instanceof Error ? err.message : String(err)]));
      return;
    }
    const newId = profileIdForTarget(newTarget);
    const names = settings.languageProfiles.filter((p) => p.id !== profile.id).map((p) => p.name);
    onChange({
      ...settings,
      languageProfiles: settings.languageProfiles.map((p) =>
        p.id === profile.id
          ? { ...p, id: newId, target: newTarget, name: buildProfileName(p.native, settings.universalNativeLanguage, newTarget, names) }
          : p,
      ),
      activeProfileId: settings.activeProfileId === profile.id ? newId : settings.activeProfileId,
      srs: settings.srs?.activeLanguageProfileId === profile.id
        ? {
            ...settings.srs,
            activeLanguageProfileId: newId,
            activeCollectionId: null,
            activeDeckId: null,
            activeNotetypeId: null,
            defaultStudyConfigId: null,
          }
        : settings.srs,
    });
    setForm(null);
  };

  const canAdd = profiles.length === 0 || active !== null;

  return (
    <SettingsPanel>
      {/* Universal native — global setting shared by every profile. The select
          applies immediately (no draft/save gate): click → menu with search
          focused → pick. */}
      <SettingsGroup>
      <SettingsRow
        dense
        stacked
        title={t('settings.profiles.banner.label')}
        labelFor="universal-native-language"
      >
        <SearchableSelect
          id="universal-native-language"
          testId="universal-native-language"
          dataTestId="universal-native-language"
          options={OVERLAY_LANGUAGE_OPTIONS}
          value={settings.universalNativeLanguage}
          onChange={(v) => onChange({ ...settings, universalNativeLanguage: v })}
          ariaLabel={t('settings.profiles.banner.aria')}
          placeholder={t('settings.profiles.form.search')}
        />
      </SettingsRow>
      </SettingsGroup>

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
              data-tihoka-id="add-language-profile"
              onClick={() => setForm(form?.mode === 'add' ? null : { mode: 'add' })}
            >
              <Icon name={form?.mode === 'add' ? 'x' : 'plus'} size="xs" />
              {form?.mode === 'add' ? t('settings.profiles.closeForm') : t('settings.profiles.new')}
            </Button>
          }
        >
        {form?.mode === 'add' && (
          <ProfileForm
            mode="add"
            universalNative={settings.universalNativeLanguage}
            activeName={active?.name ?? null}
            onCancel={() => setForm(null)}
            onSubmit={handleAdd}
          />
        )}
        <LanguageProfileCardList>
          {profiles.map((profile, index) => {
            const isActive = settings.activeProfileId === profile.id;
            const noActive = !profiles.some((p) => p.id === settings.activeProfileId);

            if (form?.mode === 'edit' && form.id === profile.id) {
              return (
                <div key={profile.id} className={styles.itemForm}>
                  <ProfileForm
                    mode="edit"
                    universalNative={settings.universalNativeLanguage}
                    activeName={null}
                    initialTarget={profile.target}
                    initialNative={profile.native}
                    onTargetChange={(v) => handleTargetChange(profile, v)}
                    onCancel={() => setForm(null)}
                    onSubmit={(t2, n) => handleUpdate(profile.id, t2, n)}
                  />
                </div>
              );
            }

            return (
              <LanguageProfileCard
                key={profile.id}
                profile={profile}
                universalNative={settings.universalNativeLanguage}
                selected={isActive}
                tabIndex={isActive || (noActive && index === 0) ? 0 : -1}
                onSelect={() => setActive(profile.id)}
                data-tihoka-id={`language-profile-card-${profile.id}`}
                trailing={(
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
                        onSelect: () => setDeletingId(profile.id),
                      },
                    ]}
                  />
                )}
              />
            );
          })}
        </LanguageProfileCardList>
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
              data-tihoka-id="profile-delete-confirm"
              onClick={() => {
                if (deletingId) deleteProfile(deletingId);
                setDeletingId(null);
              }}
            >
              {t('settings.profiles.delete.confirm')}
            </Button>
          </>
        }
        data-tihoka-id="profile-delete-dialog"
      >
        <Text as="p" color="secondary">
          {t('settings.profiles.delete.body')}
        </Text>
      </Dialog>

      <Dialog
        open={retarget !== null}
        onOpenChange={(open) => { if (!open) setRetarget(null); }}
        title={retarget ? t('settings.profiles.retarget.title', [langLabel(retarget.newTarget)]) : ''}
        showCloseButton
        footer={
          <>
            <Button variant="outline" onClick={() => setRetarget(null)}>
              {t('settings.profiles.retarget.cancel')}
            </Button>
            <Button
              variant="destructive"
              data-tihoka-id="profile-retarget-confirm"
              onClick={() => void confirmRetarget()}
            >
              {t('settings.profiles.retarget.confirm')}
            </Button>
          </>
        }
        data-tihoka-id="profile-retarget-dialog"
      >
        <Text as="p" color="secondary">
          {retarget ? t('settings.profiles.retarget.body', [langLabel(retarget.profile.target)]) : ''}
        </Text>
      </Dialog>

      <Dialog
        open={retargetNotice !== null}
        onOpenChange={(open) => { if (!open) setRetargetNotice(null); }}
        title={t('settings.profiles.retarget.dupTitle')}
        showCloseButton
        footer={
          <Button variant="outline" onClick={() => setRetargetNotice(null)}>
            {t('settings.profiles.retarget.ok')}
          </Button>
        }
        data-tihoka-id="profile-retarget-notice"
      >
        <Text as="p" color="secondary">
          {retargetNotice ?? ''}
        </Text>
      </Dialog>
    </SettingsPanel>
  );
}
