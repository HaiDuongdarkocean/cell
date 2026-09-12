import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { SelectableCard } from '@/shared/ui/SelectableCard';
import { EmptyState } from '@/shared/ui/EmptyState';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
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
  generateProfileId,
  getActiveProfileSettings,
  resolveProfile,
  validateLanguageProfile,
} from '@/entities/settings';
import { ProfileForm } from './ProfileForm';
import { ProfileMenu } from './ProfileMenu';
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
  const [bannerEditing, setBannerEditing] = useState(false);
  const [bannerDraft, setBannerDraft] = useState(settings.universalNativeLanguage);

  const profiles = useMemo(
    () => [...(settings.languageProfiles ?? [])].sort((a, b) => a.order - b.order),
    [settings.languageProfiles],
  );
  const active = useMemo(() => getActiveProfileSettings(settings), [settings]);

  /* --- FLIP: animate cards sliding when the list reorders or the form
     opens/closes (siblings shift). Skipped under prefers-reduced-motion. --- */
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const prevTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    itemRefs.current.forEach((el, id) => {
      const prev = prevTops.current.get(id);
      const top = el.getBoundingClientRect().top;
      if (prev !== undefined && prev !== top && !reduceMotion) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${prev - top}px)`;
        void el.offsetHeight; // force reflow so the jump registers before animating back
        el.style.transition = 'transform var(--duration-normal) var(--ease-out)';
        el.style.transform = '';
      }
    });
    const next = new Map<string, number>();
    itemRefs.current.forEach((el, id) => next.set(id, el.getBoundingClientRect().top));
    prevTops.current = next;
  }, [profiles, form]);

  const setItemRef = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  };

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
    onChange({
      ...settings,
      languageProfiles: recomputeOrder(remaining),
      activeProfileId: nextActive,
    });
    if (form?.mode === 'edit' && form.id === id) setForm(null);
  };

  const validate = (target: string, nativeOverride: string, excludeId?: string): string[] | null => {
    const result = validateLanguageProfile(
      { target, native: nativeOverride },
      settings.universalNativeLanguage,
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
      id: generateProfileId(),
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
      resourceIds: base?.resourceIds ?? [],
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
                target,
                native: nativeOverride,
                name: buildProfileName(nativeOverride, settings.universalNativeLanguage, target, names),
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
                <div className={styles.bannerLabel}>{t('settings.profiles.banner.label')}</div>
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
              <div className={styles.bannerLabel}>{t('settings.profiles.banner.label')}</div>
              <div className={styles.bannerValue} data-testid="universal-native-banner-value">{langShort(settings.universalNativeLanguage)}</div>
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

      {/* Toolbar — the "new profile" entry point stays pinned at the top so a
          long list never pushes it out of reach. */}
      {profiles.length > 0 && (
        <div className={styles.toolbar}>
          <span className={styles.sectionLabel}>{t('settings.profiles.list.label', [profiles.length])}</span>
          <button
            type="button"
            className={styles.linkBtn}
            aria-expanded={form?.mode === 'add'}
            disabled={!canAdd}
            data-cell-id="add-language-profile"
            onClick={() => setForm(form?.mode === 'add' ? null : { mode: 'add' })}
          >
            <Icon name={form?.mode === 'add' ? 'x' : 'plus'} size="xs" />
            {form?.mode === 'add' ? t('settings.profiles.closeForm') : t('settings.profiles.new')}
          </button>
        </div>
      )}

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
        <div className={styles.list} role="radiogroup" aria-label={t('settings.profiles.list.aria')}>
          {profiles.map((profile, index) => {
            const resolved = resolveProfile(profile, settings.universalNativeLanguage);
            const isActive = settings.activeProfileId === profile.id;

            if (form?.mode === 'edit' && form.id === profile.id) {
              return (
                <div key={profile.id} ref={setItemRef(profile.id)} className={styles.item}>
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
              <div key={profile.id} ref={setItemRef(profile.id)} className={styles.item}>
                <SelectableCard
                  role="radio"
                  selected={isActive}
                  onSelect={() => setActive(profile.id)}
                  className={styles.card}
                  data-testid={`language-profile-card-${profile.id}`}
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
                      onSelect: () => deleteProfile(profile.id),
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
