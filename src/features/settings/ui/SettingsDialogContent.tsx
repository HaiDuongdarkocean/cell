import { useRef, useState, useEffect } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction } from '@/entities/media';
import type { UiLanguagePreference } from '@/entities/settings';
import { t, type MessageKey, setUiLanguageOverride } from '@/shared/i18n';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_PRONUNCIATION_SETTINGS,
  DEFAULT_TTS_SETTINGS,
} from '@/shared/config/config';
import { SUBTITLE_LANGUAGES } from '@/shared/config/languageRegistry';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';
import { WordBadgeSettingsPanel } from './WordBadgeSettingsPanel';
import { AudioPanel } from '@/features/audio';

import { ThemePanel } from '@/features/theme';
import { ResourcesPanel } from '@/features/dictionary';
import { SyncPanel } from '@/features/sync';
import { AnkiStatusSyncPanel } from '@/features/ankiStatusSync';
import { Dictionary } from '@/features/dictionaryPopup';
import { Toggle } from '@/shared/ui/Toggle';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { isShortcutConflict } from '@/entities/settings/lib/shortcutConflicts';
import { getActiveProfileSettings } from '@/entities/settings';
import { LanguageProfilePanel } from './LanguageProfilePanel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { SettingsSection } from '@/shared/ui/SettingsSection';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsRow } from '@/shared/ui/SettingsRow';

import { NavItem } from '@/shared/ui/NavItem';
import { Navigation } from '@/shared/ui/Navigation';
import { Sidebar } from '@/shared/ui/Sidebar';
import { VStack } from '@/shared/ui/Stack';
import { observeScrollDirection } from '@/shared/lib/dom/observeScrollDirection';

import styles from './SettingsDialog.module.css';

export interface SettingsDialogContentProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  className?: string;
  showSidebarHeader?: boolean;
  navMode?: 'auto' | 'horizontal';
}

const SIDEBAR_LABEL_MIN_WIDTH = 768;
const QUALITY_OPTIONS: readonly VideoQuality[] = ['highest', '1080p', '720p', '480p', '360p', 'lowest', 'auto'];
const QUALITY_LABEL_KEYS: Partial<Record<VideoQuality, MessageKey>> = {
  highest: 'settings.download.quality.highest',
  lowest: 'settings.download.quality.lowest',
  auto: 'settings.download.quality.auto',
};

const CONVERT_OPTIONS: readonly ConvertToMp4Mode[] = ['always', 'small-only', 'never'];
const CONVERT_LABEL_KEYS: Record<ConvertToMp4Mode, MessageKey> = {
  always: 'settings.download.convert.always',
  'small-only': 'settings.download.convert.smallOnly',
  never: 'settings.download.convert.never',
};

const PARALLEL_OPTIONS: readonly ParallelConversionMode[] = ['off', 'auto', 'manual'];
const PARALLEL_LABEL_KEYS: Record<ParallelConversionMode, MessageKey> = {
  off: 'settings.download.parallel.off',
  auto: 'settings.download.parallel.auto',
  manual: 'settings.download.parallel.manual',
};

const WORKER_OPTIONS = [2, 3, 4, 5, 6];

const FILENAME_SOURCE_OPTIONS: readonly FilenameSource[] = ['title-fallback', 'title-only', 'url-only'];
const FILENAME_SOURCE_LABEL_KEYS: Record<FilenameSource, MessageKey> = {
  'title-fallback': 'settings.download.filenameSource.titleFallback',
  'title-only': 'settings.download.filenameSource.titleOnly',
  'url-only': 'settings.download.filenameSource.urlOnly',
};

const PREFERRED_FORMAT_OPTIONS: readonly ('mp4' | 'm3u8')[] = ['m3u8', 'mp4'];
const PREFERRED_FORMAT_LABEL_KEYS: Record<'mp4' | 'm3u8', MessageKey> = {
  m3u8: 'settings.download.format.m3u8',
  mp4: 'settings.download.format.mp4',
};

const SHORTCUT_ACTION_LABELS: Record<ShortcutAction, MessageKey> = {
  'prev-cue': 'settings.shortcuts.action.prevCue',
  'next-cue': 'settings.shortcuts.action.nextCue',
  'replay-cue': 'settings.shortcuts.action.replayCue',
  'play-pause': 'settings.shortcuts.action.playPause',
  'toggle-overlay': 'settings.shortcuts.action.toggleOverlay',
  'toggle-panel': 'settings.shortcuts.action.togglePanel',
  'toggle-translate': 'settings.shortcuts.action.toggleTranslate',
  'generate-native': 'settings.shortcuts.action.generateNative',
  'toggle-player-mode': 'settings.shortcuts.action.togglePlayerMode',
  'quick-update': 'settings.shortcuts.action.quickUpdate',
  'edit-card': 'settings.shortcuts.action.editCard',
  'next-vocab-token': 'settings.shortcuts.action.nextVocabToken',
  'prev-vocab-token': 'settings.shortcuts.action.prevVocabToken',
  'toggle-universal-panel': 'settings.shortcuts.action.toggleUniversalPanel',
  'open-dictionary-search': 'settings.shortcuts.action.openDictionarySearch',
};

const SHORTCUT_GROUPS: readonly { label: MessageKey; actions: readonly ShortcutAction[] }[] = [
  { label: 'settings.shortcuts.group.navigation', actions: ['prev-cue', 'next-cue', 'replay-cue', 'play-pause', 'prev-vocab-token', 'next-vocab-token'] },
  { label: 'settings.shortcuts.group.toggle', actions: ['toggle-overlay', 'toggle-panel', 'toggle-translate', 'toggle-player-mode', 'toggle-universal-panel'] },
  { label: 'settings.shortcuts.group.generate', actions: ['generate-native'] },
  { label: 'settings.shortcuts.group.dictionary', actions: ['open-dictionary-search'] },
  { label: 'settings.shortcuts.group.cardCreator', actions: ['quick-update', 'edit-card'] },
];

export function SettingsDialogContent({ settings, onChange, className, showSidebarHeader = true, navMode = 'auto' }: SettingsDialogContentProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<string>('languageProfile');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainColRef = useRef<HTMLDivElement>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1280);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const win = el.ownerDocument?.defaultView;
    if (!win || typeof win.ResizeObserver !== 'function') return;

    const update = (entries: ResizeObserverEntry[]): void => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0) setContainerWidth(width);
    };
    const ro = new win.ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const navOrientation = navMode === 'horizontal' || containerWidth < SIDEBAR_LABEL_MIN_WIDTH ? 'horizontal' : 'vertical';
  const sidebarExpanded = containerWidth >= SIDEBAR_LABEL_MIN_WIDTH;
  const activeProfile = getActiveProfileSettings(settings);

  useEffect(() => {
    if (navOrientation !== 'horizontal') return;
    const wrapper = wrapperRef.current;
    const main = mainColRef.current;
    const sidebar = wrapper?.querySelector<HTMLElement>('aside[data-orientation]');
    if (!wrapper || !main || !sidebar) return;

    const NAV_HIDE_CLEARANCE_PX = 16;
    const safeScrollDistance = sidebar.getBoundingClientRect().height + NAV_HIDE_CLEARANCE_PX;

    const showNav = (): void => {
      delete wrapper.dataset.navHidden;
      sidebar.inert = false;
      sidebar.removeAttribute('aria-hidden');
    };
    const hideNav = (): void => {
      wrapper.dataset.navHidden = 'true';
      sidebar.inert = true;
      sidebar.setAttribute('aria-hidden', 'true');
    };

    const stop = observeScrollDirection(main, {
      threshold: 8,
      cooldownMs: 300,
      swipeThreshold: 20,
      canChange: (direction) => {
        if (direction === 'up') return true;
        const active = (wrapper.getRootNode() as Document | ShadowRoot).activeElement;
        return main.scrollHeight - main.clientHeight > safeScrollDistance && !sidebar.contains(active);
      },
      onDirection: (direction) => {
        if (direction === 'down') hideNav();
        else showNav();
      },
    });
    return () => {
      stop();
      showNav();
    };
  }, [navOrientation]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  const uiLanguageOptions = [
    { value: 'auto', label: t('settings.uiLanguage.auto') },
    { value: 'en', label: t('settings.uiLanguage.en') },
    { value: 'vi', label: t('settings.uiLanguage.vi') },
  ];

  const sidebarItems: { id: string; label: string; icon: string }[] = [
    { id: 'languageProfile', label: t('settings.nav.languageProfile'), icon: 'languages' },
    { id: 'resources', label: t('settings.nav.resources'), icon: 'library' },
    { id: 'media', label: t('settings.nav.media'), icon: 'video' },
    { id: 'block', label: t('settings.nav.block'), icon: 'captions' },
    { id: 'dictionaryPopup', label: t('settings.nav.dictionaryPopup'), icon: 'bookOpen' },
    { id: 'wordBadge', label: t('settings.nav.wordBadge'), icon: 'move' },
    { id: 'audio', label: t('settings.nav.audio'), icon: 'audioWave' },
    { id: 'download', label: t('settings.nav.download'), icon: 'download' },
    { id: 'shortcuts', label: t('settings.nav.shortcuts'), icon: 'slidersHorizontal' },
    { id: 'theme', label: t('settings.nav.theme'), icon: 'sun' },
    { id: 'sync', label: t('settings.nav.sync'), icon: 'navRepeat' },
  ];

  const sectionRef = (id: string) => (el: HTMLElement | null) => { sectionRefs.current[id] = el; };

  return (
        <div
          ref={wrapperRef}
          className={[styles.popoverBody, navOrientation === 'vertical' ? styles.vertical : styles.horizontal, className].filter(Boolean).join(' ')}
        >
          {/* === Sidebar — SSOT Sidebar container + Navigation organism === */}
          <Sidebar
            ariaLabel={t('settings.sidebar.aria')}
            collapsed={navOrientation === 'vertical' && !sidebarExpanded}
            orientation={navOrientation}
            header={showSidebarHeader ? t('settings.title') : undefined}
            className={styles.sidebarWidth}
          >
            <Navigation
              ariaLabel={t('settings.sidebar.navAria')}
              orientation={navOrientation}
              activeId={activeSection}
              onActiveChange={setActiveSection}
              contentRef={mainColRef}
              sectionRefs={sectionRefs}
            >
              {sidebarItems.map((item) => (
                <NavItem
                  key={item.id}
                  data-section-id={item.id}
                  icon={navOrientation === 'vertical' ? item.icon : undefined}
                  label={item.label}
                  tooltip={item.label}
                  aria-label={item.label}
                />
              ))}
            </Navigation>
          </Sidebar>

          {/* === Main column (flat section bands, scrollable) === */}
          <div className={styles.mainCol} ref={mainColRef}>

            {/* === Language Profile === */}
            <SettingsSection
              ref={sectionRef('languageProfile')}
              headingLevel={3}
              title={t('settings.languageProfile.title')}
              description={t('settings.languageProfile.desc')}
              data-section="languageProfile"
            >
              <LanguageProfilePanel settings={settings} onChange={onChange} />
            </SettingsSection>

            {/* === Resources === */}
            <SettingsSection
              ref={sectionRef('resources')}
              headingLevel={3}
              title={t('settings.resources.title')}
              description={t('settings.resources.desc')}
              data-section="resources"
            >
              {settings.languageProfiles.length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={<Icon name="languages" size="lg" />}
                  title={t('settings.resources.noProfile.title')}
                  description={t('settings.resources.noProfile.desc')}
                  action={
                    <Button
                      type="button"
                      size="sm"
                      data-cell-id="resources-goto-profiles"
                      onClick={() => {
                        setActiveSection('languageProfile');
                        sectionRefs.current.languageProfile?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {t('settings.resources.noProfile.cta')}
                    </Button>
                  }
                />
              ) : (
                <ResourcesPanel
                  langCode={activeProfile?.resourceLangCode ?? settings.subtitleOverlayTargetLanguage ?? 'en'}
                  frequencyBands={settings.frequencyBands}
                  onFrequencyBandsChange={(bands) => update('frequencyBands', bands)}
                  lookupPanel={
                    <Dictionary
                      variant="integrated"
                      langCode={activeProfile?.resourceLangCode ?? settings.subtitleOverlayTargetLanguage ?? 'en'}
                      sourceLang={activeProfile?.resourceLangCode ?? settings.subtitleOverlayTargetLanguage ?? 'en'}
                      targetLang={activeProfile?.native ?? settings.universalNativeLanguage}
                      isOpen={false}
                    />
                  }
                />
              )}
            </SettingsSection>

            {/* === Media Selection === */}
            <SettingsSection
              ref={sectionRef('media')}
              headingLevel={3}
              title={t('settings.media.title')}
              description={t('settings.media.desc')}
              data-section="media"
            >
              <SettingsRow
                dense
                title={t('settings.media.autoSelect')}
                description={t('settings.media.autoSelect.hint')}
              >
                <Toggle
                  checked={settings.autoSelectEnabled}
                  onChange={(next) => update('autoSelectEnabled', next)}
                  ariaLabel={t('settings.media.autoSelect')}
                />
              </SettingsRow>

              {settings.autoSelectEnabled && (
                <SettingsRow
                  dense
                  divider
                  stacked
                  child
                  title={t('settings.media.subtitleLanguages')}
                  labelFor="subtitle-lang-multiselect"
                >
                  <MultiSelect
                    id="subtitle-lang-multiselect"
                    testId="subtitle-lang-multiselect"
                    options={SUBTITLE_LANGUAGES}
                    selectedValues={settings.selectedSubtitleLanguages}
                    onChange={(values) => update('selectedSubtitleLanguages', values)}
                    exclusiveValues={['all']}
                    popularValues={['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de']}
                  />
                </SettingsRow>
              )}

              <SettingsGroup label={t('settings.localPlayer.title')}>
                <SettingsRow
                  dense
                  title={t('settings.localPlayer.subtitleMatch')}
                  description={t('settings.localPlayer.subtitleMatch.hint')}
                >
                  <Toggle
                    checked={settings.localPlayerSettings.subtitleMatchEnabled}
                    onChange={(next) => onChange({ ...settings, localPlayerSettings: { ...settings.localPlayerSettings, subtitleMatchEnabled: next } })}
                    ariaLabel={t('settings.localPlayer.subtitleMatch')}
                  />
                </SettingsRow>
                <SettingsRow
                  dense
                  divider
                  title={t('settings.localPlayer.resumePrompt')}
                  description={t('settings.localPlayer.resumePrompt.hint')}
                >
                  <Toggle
                    checked={settings.localPlayerSettings.resumePromptEnabled}
                    onChange={(next) => onChange({ ...settings, localPlayerSettings: { ...settings.localPlayerSettings, resumePromptEnabled: next } })}
                    ariaLabel={t('settings.localPlayer.resumePrompt')}
                  />
                </SettingsRow>
              </SettingsGroup>
            </SettingsSection>

            {/* === Subtitle Block === */}
            <SettingsSection
              ref={sectionRef('block')}
              headingLevel={3}
              title={t('settings.block.title')}
              data-section="block"
            >
              <SettingsRow
                dense
                title={t('settings.block.autoLoad')}
                description={t('settings.block.autoLoad.hint')}
              >
                <Toggle
                  checked={settings.subtitleOverlayAutoLoad}
                  onChange={(next) => update('subtitleOverlayAutoLoad', next)}
                  ariaLabel={t('settings.block.autoLoad')}
                />
              </SettingsRow>

              <SettingsRow
                dense
                divider
                title={t('settings.block.autoLoadAsr')}
              >
                <Toggle
                  checked={settings.subtitleOverlayAutoLoadAsr}
                  onChange={(next) => update('subtitleOverlayAutoLoadAsr', next)}
                  ariaLabel={t('settings.block.autoLoadAsr')}
                  disabled={!settings.subtitleOverlayAutoLoad}
                />
              </SettingsRow>

              <SettingsRow
                dense
                divider
                title={t('settings.block.autoTranslate')}
                description={t('settings.block.autoTranslate.hint')}
              >
                <Toggle
                  checked={settings.subtitleOverlayAutoTranslate}
                  onChange={(next) => update('subtitleOverlayAutoTranslate', next)}
                  ariaLabel={t('settings.block.autoTranslate')}
                  disabled={!settings.subtitleOverlayAutoLoad}
                />
              </SettingsRow>

              <SettingsRow
                dense
                divider
                title={t('settings.block.showReadings')}
                description={t('settings.block.showReadings.hint')}
              >
                <Toggle
                  checked={settings.showReadings}
                  onChange={(next) => update('showReadings', next)}
                  ariaLabel={t('settings.block.showReadings')}
                />
              </SettingsRow>

              <SettingsRow
                dense
                divider
                title={t('settings.block.showWordTranslations')}
                description={t('settings.block.showWordTranslations.hint')}
              >
                <Toggle
                  checked={settings.showWordTranslations}
                  onChange={(next) => update('showWordTranslations', next)}
                  ariaLabel={t('settings.block.showWordTranslations')}
                />
              </SettingsRow>
            </SettingsSection>

            {/* === Dictionary Popup === */}
            <SettingsSection
              ref={sectionRef('dictionaryPopup')}
              headingLevel={3}
              title={t('settings.dictionaryPopup.title')}
              description={t('settings.dictionaryPopup.desc')}
              data-section="dictionaryPopup"
            >
              <SettingsRow
                dense
                title={t('settings.dictionaryPopup.enabled')}
                description={t('settings.dictionaryPopup.enabled.hint')}
              >
                <Toggle
                  checked={settings.dictionaryPopup?.enabled ?? true}
                  onChange={(next) => {
                    const dp = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
                    onChange({ ...settings, dictionaryPopup: { ...dp, enabled: next } });
                  }}
                  ariaLabel={t('settings.dictionaryPopup.enabled')}
                />
              </SettingsRow>
              <DictionaryPopupSettingsPanel
                settings={settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS}
                onChange={(dp) => onChange({ ...settings, dictionaryPopup: dp })}
              />
            </SettingsSection>

            {/* === Word badge === */}
            <SettingsSection
              ref={sectionRef('wordBadge')}
              headingLevel={3}
              title={t('settings.wordBadge.title')}
              description={t('settings.wordBadge.desc')}
              hint={t('settings.wordBadge.hint')}
              hintAriaLabel={t('settings.hint.aria', [t('settings.wordBadge.title')])}
              data-section="wordBadge"
            >
              <WordBadgeSettingsPanel
                badgePointerTrigger={settings.dictionaryPopup?.badgePointerTrigger ?? DEFAULT_DICTIONARY_POPUP_SETTINGS.badgePointerTrigger}
                onChange={(badge) => {
                  const dp = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
                  onChange({ ...settings, dictionaryPopup: { ...dp, badgePointerTrigger: badge } });
                }}
              />
            </SettingsSection>

            {/* === Audio (merged Pronunciation + Local Pronunciation + TTS Voices) === */}
            <SettingsSection
              ref={sectionRef('audio')}
              headingLevel={3}
              title={t('settings.audio.title')}
              description={t('settings.audio.desc')}
              data-section="audio"
            >
              <AudioPanel
                pronunciation={settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS}
                tts={settings.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS}
                targetLang={activeProfile?.resourceLangCode ?? settings.subtitleOverlayTargetLanguage ?? 'en'}
                onPronunciationChange={(p) => onChange({ ...settings, pronunciation: p })}
                onTtsChange={(tts) => onChange({ ...settings, dictionaryPopup: { ...(settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS), tts } })}
              />
            </SettingsSection>

            {/* === Download === */}
            <SettingsSection
              ref={sectionRef('download')}
              headingLevel={3}
              title={t('settings.download.title')}
              data-section="download"
            >
              <SettingsGroup label={t('settings.download.group.concurrency')}>
                <SettingsRow dense stacked title={t('settings.download.concurrent')} labelFor="set-concurrent">
                  <Select
                    id="set-concurrent"
                    className={styles.select}
                    data-cell-id="concurrent-select"
                    value={String(settings.concurrentDownloads)}
                    options={[1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
                    onChange={(val) => update('concurrentDownloads', Number(val))}
                  />
                </SettingsRow>
              </SettingsGroup>

              <SettingsGroup label={t('settings.download.group.formatQuality')}>
                <VStack columns={2} responsive gapResponsive={{ mobile: '2', desktop: '4' }}>
                  <SettingsRow dense stacked title={t('settings.download.format')} labelFor="set-format">
                    <Select
                      id="set-format"
                      className={styles.select}
                      data-cell-id="format-select"
                      value={settings.preferredVideoFormat}
                      options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: t(PREFERRED_FORMAT_LABEL_KEYS[f]) }))}
                      onChange={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
                    />
                  </SettingsRow>
                  <SettingsRow dense stacked title={t('settings.download.quality')} labelFor="set-quality">
                    <Select
                      id="set-quality"
                      className={styles.select}
                      data-cell-id="quality-select"
                      value={settings.defaultQuality}
                      options={QUALITY_OPTIONS.map((q) => ({ value: q, label: QUALITY_LABEL_KEYS[q] ? t(QUALITY_LABEL_KEYS[q]!) : q }))}
                      onChange={(val) => update('defaultQuality', val as VideoQuality)}
                    />
                  </SettingsRow>
                </VStack>
              </SettingsGroup>

              <SettingsGroup label={t('settings.download.group.conversion')}>
                <SettingsRow dense stacked title={t('settings.download.convert')} labelFor="set-convert">
                  <Select
                    id="set-convert"
                    className={styles.select}
                    data-cell-id="convert-select"
                    value={settings.convertToMp4}
                    options={CONVERT_OPTIONS.map((m) => ({
                      value: m,
                      label: m === 'small-only'
                        ? t(CONVERT_LABEL_KEYS[m], [Math.round(MAX_CONVERT_BYTES / 1024 / 1024)])
                        : t(CONVERT_LABEL_KEYS[m]),
                    }))}
                    onChange={(val) => update('convertToMp4', val as ConvertToMp4Mode)}
                  />
                </SettingsRow>
                <SettingsRow
                  dense
                  stacked
                  title={t('settings.download.parallel')}
                  description={t('settings.download.parallel.hint')}
                  labelFor="set-parallel"
                >
                  <Select
                    id="set-parallel"
                    className={styles.select}
                    data-cell-id="parallel-select"
                    value={settings.parallelConversion}
                    options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: t(PARALLEL_LABEL_KEYS[m]) }))}
                    onChange={(val) => update('parallelConversion', val as ParallelConversionMode)}
                  />
                </SettingsRow>
                {settings.parallelConversion === 'manual' && (
                  <SettingsRow dense stacked child title={t('settings.download.workers')} labelFor="set-workers">
                    <Select
                      id="set-workers"
                      className={styles.select}
                      data-cell-id="workers-select"
                      value={String(settings.manualWorkerCount)}
                      options={WORKER_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                      onChange={(val) => update('manualWorkerCount', Math.max(MIN_PARALLEL_WORKERS, Math.min(MAX_PARALLEL_WORKERS, Number(val))))}
                    />
                  </SettingsRow>
                )}
              </SettingsGroup>

              <SettingsGroup label={t('settings.download.group.filename')}>
                <SettingsRow dense stacked title={t('settings.download.filenameSource')} labelFor="set-filename-source">
                  <Select
                    id="set-filename-source"
                    className={styles.select}
                    data-cell-id="filename-source-select"
                    value={settings.filenameSource}
                    options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: t(FILENAME_SOURCE_LABEL_KEYS[m]) }))}
                    onChange={(val) => update('filenameSource', val as FilenameSource)}
                  />
                </SettingsRow>
              </SettingsGroup>
            </SettingsSection>

            {/* === Keyboard Shortcuts === */}
            <SettingsSection
              ref={sectionRef('shortcuts')}
              headingLevel={3}
              title={t('settings.shortcuts.title')}
              data-section="shortcuts"
            >
              <div className={styles.shortcutSection}>
                {SHORTCUT_GROUPS.map((group) => (
                  <SettingsGroup key={group.label} label={t(group.label)}>
                    <VStack columns={2} responsive gap="2">
                      {group.actions.map((action) => {
                        const shortcut = settings.keyboardShortcuts.find((s) => s.action === action);
                        const currentValue = shortcut
                          ? { key: shortcut.key, ctrl: shortcut.ctrl, shift: shortcut.shift, alt: shortcut.alt }
                          : { key: '' };
                        const conflict = isShortcutConflict(settings.keyboardShortcuts, action);
                        const actionLabel = t(SHORTCUT_ACTION_LABELS[action]);
                        return (
                          <SettingsRow
                            key={action}
                            dense
                            title={actionLabel}
                            labelFor={`set-shortcut-${action}`}
                            className={styles.shortcutField}
                          >
                            <span className={styles.shortcutInputWrap}>
                              <ShortcutInput
                                id={`set-shortcut-${action}`}
                                data-cell-id={`shortcut-${action}`}
                                value={currentValue}
                                onChange={(newShortcut) => {
                                  const updated = settings.keyboardShortcuts.map((s) =>
                                    s.action === action
                                      ? { ...s, key: newShortcut.key, ctrl: newShortcut.ctrl, shift: newShortcut.shift, alt: newShortcut.alt }
                                      : s,
                                  );
                                  update('keyboardShortcuts', updated);
                                }}
                                aria-label={actionLabel}
                                aria-invalid={conflict || undefined}
                                aria-describedby={conflict ? `shortcut-conflict-${action}` : undefined}
                              />
                              {conflict && (
                                <span
                                  id={`shortcut-conflict-${action}`}
                                  className={styles.conflictDot}
                                  title={t('settings.shortcuts.conflict.title')}
                                  role="img"
                                  aria-label={t('settings.shortcuts.conflict.aria')}
                                />
                              )}
                            </span>
                          </SettingsRow>
                        );
                      })}
                    </VStack>
                  </SettingsGroup>
                ))}
              </div>
            </SettingsSection>

            {/* === Appearance === */}
            <SettingsSection
              ref={sectionRef('theme')}
              headingLevel={3}
              title={t('settings.theme.title')}
              data-section="theme"
            >
              <SettingsRow
                dense
                stacked
                title={t('settings.uiLanguage.label')}
                description={t('settings.uiLanguage.hint')}
                labelFor="set-ui-language"
              >
                <Select
                  id="set-ui-language"
                  className={styles.select}
                  value={settings.uiLanguage ?? 'auto'}
                  options={uiLanguageOptions}
                  onChange={(value) => {
                    const next = value as UiLanguagePreference;
                    setUiLanguageOverride(next);
                    update('uiLanguage', next);
                  }}
                  data-cell-id="settings-ui-language"
                  aria-label={t('settings.uiLanguage.label')}
                />
              </SettingsRow>
              <ThemePanel />
            </SettingsSection>

            {/* === Sync === */}
            <SettingsSection
              ref={sectionRef('sync')}
              headingLevel={3}
              title={t('settings.sync.title')}
              hint={t('settings.sync.privacy')}
              hintAriaLabel={t('settings.hint.aria', [t('settings.sync.title')])}
              data-section="sync"
            >
              <SyncPanel settings={settings} />
              <AnkiStatusSyncPanel settings={settings} onChange={onChange} />
            </SettingsSection>

          </div>
        </div>
  );
}
