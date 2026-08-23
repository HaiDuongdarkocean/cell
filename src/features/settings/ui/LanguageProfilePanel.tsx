import { useMemo, useState } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Dialog } from '@/shared/ui/Dialog';
import { Toggle } from '@/shared/ui/Toggle';
import { Alert } from '@/shared/ui/Alert';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_SETTINGS,
} from '@/shared/config/config';
import type { LanguageProfile, Settings } from '@/entities/settings';
import {
  buildProfileName,
  generateProfileId,
  getActiveProfileSettings,
  resolveProfile,
  validateLanguageProfile,
} from '@/entities/settings';
import styles from './SettingsDialog.module.css';

interface LanguageProfilePanelProps {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
}

type DialogMode = 'add' | 'edit' | null;

interface Draft {
  readonly mode: DialogMode;
  readonly editingId: string | null;
  readonly target: string;
  readonly native: string;
  readonly useUniversalNative: boolean;
  readonly duplicateFromActive: boolean;
}

const DEFAULT_DRAFT: Draft = {
  mode: null,
  editingId: null,
  target: '',
  native: '',
  useUniversalNative: true,
  duplicateFromActive: false,
};

function recomputeOrder(profiles: LanguageProfile[]): LanguageProfile[] {
  return profiles.map((p, index) => ({ ...p, order: index + 1 }));
}

export function LanguageProfilePanel({ settings, onChange }: LanguageProfilePanelProps): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  const profiles = useMemo(
    () => [...(settings.languageProfiles ?? [])].sort((a, b) => a.order - b.order),
    [settings.languageProfiles],
  );
  const active = useMemo(() => getActiveProfileSettings(settings), [settings]);

  const targetLabel = (code: string) =>
    OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;

  const openAdd = (): void => {
    setDraft({
      ...DEFAULT_DRAFT,
      mode: 'add',
      target: '',
      native: '',
      useUniversalNative: true,
    });
    setValidationMessages([]);
  };

  const openEdit = (profile: LanguageProfile): void => {
    setDraft({
      mode: 'edit',
      editingId: profile.id,
      target: profile.target,
      native: profile.native || settings.universalNativeLanguage,
      useUniversalNative: profile.native === '',
      duplicateFromActive: false,
    });
    setValidationMessages([]);
  };

  const closeDialog = (): void => {
    setDraft(DEFAULT_DRAFT);
    setValidationMessages([]);
  };

  const saveProfile = (): void => {
    const resolvedNative = draft.useUniversalNative ? '' : draft.native;
    const names = settings.languageProfiles
      .filter((p) => p.id !== draft.editingId)
      .map((p) => p.name);

    if (draft.mode === 'add') {
      const validation = validateLanguageProfile(
        { target: draft.target, native: resolvedNative },
        settings.universalNativeLanguage,
        settings.languageProfiles,
      );
      if (!validation.valid) {
        setValidationMessages(validation.messages);
        return;
      }

      const base = draft.duplicateFromActive && active ? active : undefined;
      const name = buildProfileName(resolvedNative, settings.universalNativeLanguage, draft.target, names);
      const newProfile: LanguageProfile = {
        id: generateProfileId(),
        target: draft.target,
        native: resolvedNative,
        name,
        order: settings.languageProfiles.length + 1,
        subtitleOverlayTargetStyle: base?.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET,
        subtitleOverlayNativeStyle: base?.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE,
        subtitleOverlayAutoLoad: base?.subtitleOverlayAutoLoad ?? DEFAULT_SETTINGS.subtitleOverlayAutoLoad,
        subtitleOverlayAutoLoadAsr: base?.subtitleOverlayAutoLoadAsr ?? DEFAULT_SETTINGS.subtitleOverlayAutoLoadAsr,
        subtitleOverlayAutoTranslate:
          base?.subtitleOverlayAutoTranslate ?? DEFAULT_SETTINGS.subtitleOverlayAutoTranslate,
        dictionaryPopup: base?.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
        resourceIds: base?.resourceIds ?? [],
      };
      const updated = recomputeOrder([...settings.languageProfiles, newProfile]);
      onChange({
        ...settings,
        languageProfiles: updated,
        activeProfileId: settings.activeProfileId ?? newProfile.id,
      });
      closeDialog();
      return;
    }

    if (draft.mode === 'edit' && draft.editingId) {
      const validation = validateLanguageProfile(
        { target: draft.target, native: resolvedNative },
        settings.universalNativeLanguage,
        settings.languageProfiles,
        draft.editingId,
      );
      if (!validation.valid) {
        setValidationMessages(validation.messages);
        return;
      }

      const updated = recomputeOrder(
        settings.languageProfiles.map((p) =>
          p.id === draft.editingId
            ? {
                ...p,
                native: resolvedNative,
                name: buildProfileName(resolvedNative, settings.universalNativeLanguage, p.target, names),
              }
            : p,
        ),
      );
      onChange({ ...settings, languageProfiles: updated });
      closeDialog();
    }
  };

  const deleteProfile = (id: string): void => {
    const remaining = settings.languageProfiles.filter((p) => p.id !== id);
    const nextActive =
      settings.activeProfileId === id
        ? (remaining[0]?.id ?? null)
        : settings.activeProfileId;
    onChange({
      ...settings,
      languageProfiles: recomputeOrder(remaining),
      activeProfileId: nextActive,
    });
  };

  const setActive = (id: string): void => {
    onChange({ ...settings, activeProfileId: id });
  };

  const move = (id: string, direction: -1 | 1): void => {
    const index = profiles.findIndex((p) => p.id === id);
    if (index < 0) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= profiles.length) return;
    const reordered = [...profiles];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    onChange({ ...settings, languageProfiles: recomputeOrder(reordered) });
  };

  const canAdd = profiles.length === 0 || (profiles.length > 0 && active !== null);

  return (
    <>
      <SettingsRow dense stacked>
        <label className={styles.rowLabel} htmlFor="set-universal-native-lang">Universal native language</label>
        <SearchableSelect
          testId="universal-native-language"
          dataTestId="universal-native-language"
          value={settings.universalNativeLanguage}
          options={OVERLAY_LANGUAGE_OPTIONS}
          onChange={(val) => onChange({ ...settings, universalNativeLanguage: val })}
          ariaLabel="Select universal native language"
        />
      </SettingsRow>

      <div className={styles.profileList} role="list" aria-label="Language profiles">
        {profiles.map((profile, index) => {
          const resolved = resolveProfile(profile, settings.universalNativeLanguage);
          const isActive = settings.activeProfileId === profile.id;
          return (
            <div
              key={profile.id}
              className={styles.profileItem}
              role="listitem"
              aria-current={isActive ? 'true' : undefined}
            >
              <HStack align="center" gap="2" className={styles.profileRow}>
                <HStack align="center" gap="2" className={styles.profileInfo}>
                  <span className={styles.profileName} title={profile.name}>
                    {profile.name}
                  </span>
                  <span className={styles.profileMeta}>
                    {targetLabel(resolved.target)} → {targetLabel(resolved.native)}
                  </span>
                </HStack>
                <HStack align="center" gap="1" className={styles.profileActions}>
                  <IconButton
                    type="button"
                    size="sm"
                    variant={isActive ? 'solid' : 'ghost'}
                    active={isActive}
                    aria-label={isActive ? 'Active profile' : 'Set as active'}
                    title={isActive ? 'Active' : 'Set active'}
                    onClick={() => setActive(profile.id)}
                    disabled={isActive}
                  >
                    <Icon name={isActive ? 'check' : 'check'} size={16} />
                  </IconButton>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Edit profile"
                    title="Edit"
                    onClick={() => openEdit(profile)}
                  >
                    <Icon name="pencil" size={16} />
                  </IconButton>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="danger"
                    aria-label="Delete profile"
                    title="Delete"
                    onClick={() => deleteProfile(profile.id)}
                    disabled={profiles.length === 1 && isActive}
                  >
                    <Icon name="trash" size={16} />
                  </IconButton>
                </HStack>
              </HStack>
              <HStack align="center" gap="1" className={styles.profileReorder}>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Move up"
                  title="Move up"
                  onClick={() => move(profile.id, -1)}
                  disabled={index === 0}
                >
                  <Icon name="moveVertical" size={16} />
                </IconButton>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Move down"
                  title="Move down"
                  onClick={() => move(profile.id, 1)}
                  disabled={index === profiles.length - 1}
                >
                  <Icon name="moveVertical" size={16} />
                </IconButton>
              </HStack>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={openAdd}
        disabled={!canAdd}
        data-cell-id="add-language-profile"
      >
        <Icon name="plus" size={16} />
        Add profile
      </Button>

      <Dialog
        open={draft.mode !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={draft.mode === 'add' ? 'Add language profile' : 'Edit language profile'}
        showCloseButton
        data-cell-id="language-profile-dialog"
        footer={
          <HStack justify="end" gap="2">
            <Button type="button" variant="ghost" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveProfile}
              disabled={draft.mode === 'add' && !draft.target}
              data-cell-id="save-language-profile"
            >
              Save
            </Button>
          </HStack>
        }
      >
        <VStack gap="3" className={styles.profileDialogBody}>
          {validationMessages.length > 0 && (
            <Alert
              variant="error"
              title="Validation error"
              description={validationMessages.join(' ')}
              data-cell-id="language-profile-validation"
            />
          )}

          {draft.mode === 'edit' ? (
            <SettingsRow dense stacked>
              <label className={styles.rowLabel}>Target language</label>
              <div className={styles.profileReadonly}>{targetLabel(draft.target)}</div>
            </SettingsRow>
          ) : (
            <SettingsRow dense stacked>
              <label className={styles.rowLabel} htmlFor="set-profile-target">Target language *</label>
              <SearchableSelect
                testId="profile-target-language"
                dataTestId="profile-target-language"
                value={draft.target}
                options={OVERLAY_LANGUAGE_OPTIONS.filter((o) => o.value !== '')}
                onChange={(val) => setDraft((d) => ({ ...d, target: val }))}
                ariaLabel="Select target language"
              />
            </SettingsRow>
          )}

          <SettingsRow dense stacked>
            <HStack align="center" justify="between">
              <label className={styles.rowLabel}>Native language</label>
              <Toggle
                checked={draft.useUniversalNative}
                onChange={(checked) => setDraft((d) => ({ ...d, useUniversalNative: checked }))}
                ariaLabel="Use universal native language"
                size="sm"
              />
            </HStack>
            <SearchableSelect
              testId="profile-native-language"
              dataTestId="profile-native-language"
              value={draft.useUniversalNative ? '' : draft.native}
              options={OVERLAY_LANGUAGE_OPTIONS}
              onChange={(val) => setDraft((d) => ({ ...d, native: val }))}
              ariaLabel="Select native override"
              disabled={draft.useUniversalNative}
              menuAlign="right"
            />
            <span className={styles.profileHint}>
              {draft.useUniversalNative
                ? `Uses universal native (${targetLabel(settings.universalNativeLanguage)})`
                : 'Overrides the universal native for this profile only'}
            </span>
          </SettingsRow>

          {draft.mode === 'add' && active && (
            <SettingsRow dense>
              <Toggle
                checked={draft.duplicateFromActive}
                onChange={(checked) => setDraft((d) => ({ ...d, duplicateFromActive: checked }))}
                ariaLabel="Duplicate settings from active profile"
                size="sm"
              />
              <span className={styles.profileHint}>Duplicate settings from {active.name}</span>
            </SettingsRow>
          )}
        </VStack>
      </Dialog>
    </>
  );
}
