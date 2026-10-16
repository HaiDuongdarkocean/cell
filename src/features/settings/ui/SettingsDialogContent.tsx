import { useRef, useState, useEffect } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction } from '@/entities/media';
import type { AnnotationDisplayMode, UiLanguagePreference } from '@/entities/settings';
import { t, type MessageKey, setUiLanguageOverride } from '@/shared/i18n';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_PRONUNCIATION_SETTINGS,
  DEFAULT_TTS_SETTINGS,
  DEFAULT_AI_BRIDGE_SETTINGS,
} from '@/shared/config/config';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';
import { AiBridgeSection } from './AiBridgeSection';
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
import { Surface } from '@/shared/ui/Surface';

import { NavItem } from '@/shared/ui/NavItem';
import { Navigation } from '@/shared/ui/Navigation';
import { Sidebar } from '@/shared/ui/Sidebar';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Stepper } from '@/shared/ui/Stepper';
import { StepperValue } from '@/shared/ui/StepperSection';
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

const CONVERT_SHORT_LABEL_KEYS: Record<ConvertToMp4Mode, MessageKey> = {
  always: 'settings.download.convert.always.short',
  'small-only': 'settings.download.convert.smallOnly.short',
  never: 'settings.download.convert.never.short',
};

const CONCURRENT_OPTIONS = [1, 2, 3, 5, 10];

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
const PREFERRED_FORMAT_SHORT_LABEL_KEYS: Record<'mp4' | 'm3u8', MessageKey> = {
  m3u8: 'settings.download.format.m3u8.short',
  mp4: 'settings.download.format.mp4.short',
};

const ANNOTATION_DISPLAY_MODES: readonly { value: AnnotationDisplayMode; label: MessageKey }[] = [
  { value: 'off', label: 'settings.wordDisplay.mode.off' },
  { value: 'always', label: 'settings.wordDisplay.mode.always' },
  { value: 'hover', label: 'settings.wordDisplay.mode.hover' },
  { value: 'i1', label: 'settings.wordDisplay.mode.i1' },
  { value: 'unknown', label: 'settings.wordDisplay.mode.unknown' },
];

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
  const [activeSection, setActiveSection] = useState<string>('wordDisplay');
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

  const resourceLang = activeProfile?.resourceLangCode ?? settings.subtitleOverlayTargetLanguage ?? 'en';

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
    { id: 'wordDisplay', label: t('settings.nav.wordDisplay'), icon: 'eye' },
    { id: 'languageProfile', label: t('settings.nav.languageProfile'), icon: 'languages' },
    { id: 'resources', label: t('settings.nav.resources'), icon: 'library' },
    { id: 'block', label: t('settings.nav.block'), icon: 'captions' },
    { id: 'dictionaryPopup', label: t('settings.nav.dictionaryPopup'), icon: 'bookOpen' },
    { id: 'aiBridge', label: t('settings.nav.aiBridge'), icon: 'atom' },
    { id: 'wordBadge', label: t('settings.nav.wordBadge'), icon: 'move' },
    { id: 'audio', label: t('settings.nav.audio'), icon: 'audioWave' },
    { id: 'download', label: t('settings.nav.download'), icon: 'download' },
    { id: 'shortcuts', label: t('settings.nav.shortcuts'), icon: 'slidersHorizontal' },
    { id: 'theme', label: t('settings.nav.theme'), icon: 'sun' },
    { id: 'cloudBackup', label: t('settings.nav.cloudBackup'), icon: 'cloud' },
    { id: 'ankiSync', label: t('settings.nav.ankiSync'), icon: 'layers' },
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

            {/* === Word display === */}
            <SettingsSection
              ref={sectionRef('wordDisplay')}
              headingLevel={3}
              title={t('settings.wordDisplay.title')}
              data-section="wordDisplay"
            >
              {(() => {
                const hoverTaken = (settings.dictionaryPopup?.triggerMode ?? 'click').startsWith('hover');
                const modeOptions = ANNOTATION_DISPLAY_MODES.map((m) => ({
                  value: m.value as string,
                  label: t(m.label),
                  disabled: hoverTaken && m.value === 'hover',
                }));
                return (
                  <SettingsGroup>
                    <SettingsRow
                      dense
                      stacked
                      title={t('settings.wordDisplay.readings')}
                      labelFor="set-reading-display"
                    >
                      <Select
                        id="set-reading-display"
                        className={styles.select}
                        data-tihoka-id="reading-display-select"
                        value={settings.readingDisplay}
                        options={modeOptions}
                        onChange={(val) => update('readingDisplay', val as AnnotationDisplayMode)}
                      />
                    </SettingsRow>
                    <SettingsRow
                      dense
                      stacked
                      title={t('settings.wordDisplay.gloss')}
                      labelFor="set-gloss-display"
                    >
                      <Select
                        id="set-gloss-display"
                        className={styles.select}
                        data-tihoka-id="gloss-display-select"
                        value={settings.glossDisplay}
                        options={modeOptions}
                        onChange={(val) => update('glossDisplay', val as AnnotationDisplayMode)}
                      />
                    </SettingsRow>
                    {hoverTaken && (
                      <SettingsRow dense title={t('settings.wordDisplay.hoverTaken')}>
                        <Button
                          type="button"
                          size="sm"
                          data-tihoka-id="worddisplay-goto-dictionary-popup"
                          onClick={() => {
                            setActiveSection('dictionaryPopup');
                            sectionRefs.current.dictionaryPopup?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                        >
                          {t('settings.nav.dictionaryPopup')}
                        </Button>
                      </SettingsRow>
                    )}
                  </SettingsGroup>
                );
              })()}
            </SettingsSection>

            {/* === Language Profile === */}
            <SettingsSection
              ref={sectionRef('languageProfile')}
              headingLevel={3}
              title={t('settings.languageProfile.title')}
              data-section="languageProfile"
            >
              <LanguageProfilePanel settings={settings} onChange={onChange} />
            </SettingsSection>

            {/* === Resources === */}
            <SettingsSection
              ref={sectionRef('resources')}
              headingLevel={3}
              title={t('settings.resources.title')}
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
                      data-tihoka-id="resources-goto-profiles"
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
                  langCode={resourceLang}
                  frequencyBands={settings.frequencyBands}
                  onFrequencyBandsChange={(bands) => update('frequencyBands', bands)}
                  lookupPanel={
                    <Surface variant="popover" className={styles.lookupSurface}>
                      <Dictionary
                        variant="integrated"
                        langCode={resourceLang}
                        sourceLang={resourceLang}
                        targetLang={activeProfile?.native ?? settings.universalNativeLanguage}
                        showHistory={false}
                        isOpen={false}
                      />
                    </Surface>
                  }
                />
              )}
            </SettingsSection>

            {/* === Subtitle Block === */}
            <SettingsSection
              ref={sectionRef('block')}
              headingLevel={3}
              title={t('settings.block.title')}
              data-section="block"
            >
              <SettingsGroup>
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
              </SettingsGroup>

            </SettingsSection>

            {/* === Dictionary Popup === */}
            <SettingsSection
              ref={sectionRef('dictionaryPopup')}
              headingLevel={3}
              title={t('settings.dictionaryPopup.title')}
              data-section="dictionaryPopup"
            >
              <SettingsGroup>
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
              </SettingsGroup>
              <DictionaryPopupSettingsPanel
                settings={settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS}
                onChange={(dp) => onChange({ ...settings, dictionaryPopup: dp })}
              />
            </SettingsSection>

            {/* === AI bridge (spec ai-bridge-dictionary) === */}
            <AiBridgeSection
              sectionRef={sectionRef('aiBridge')}
              settings={settings.aiBridge ?? DEFAULT_AI_BRIDGE_SETTINGS}
              onChange={(aiBridge) => onChange({ ...settings, aiBridge })}
            />

            {/* === Word badge === */}
            <SettingsSection
              ref={sectionRef('wordBadge')}
              headingLevel={3}
              title={t('settings.wordBadge.title')}
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
              className={styles.downloadSection}
            >
              <SettingsGroup label={t('settings.download.group.concurrency')}>
                <SettingsRow dense className={styles.dlRow} title={t('settings.download.concurrent')}>
                  <SegmentedControl
                    variant="raised"
                    className={styles.segmented}
                    ariaLabel={t('settings.download.concurrent')}
                    data-tihoka-id="concurrent-select"
                    options={CONCURRENT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                    value={String(settings.concurrentDownloads)}
                    onChange={(val) => update('concurrentDownloads', Number(val))}
                  />
                </SettingsRow>
                <SettingsRow
                  dense
                  className={styles.dlRow}
                  title={t('settings.download.parallel')}
                  hint={t('settings.download.parallel.hint')}
                  hintAriaLabel={t('settings.hint.aria', [t('settings.download.parallel')])}
                >
                  <SegmentedControl
                    variant="raised"
                    className={styles.segmented}
                    ariaLabel={t('settings.download.parallel')}
                    data-tihoka-id="parallel-select"
                    options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: t(PARALLEL_LABEL_KEYS[m]) }))}
                    value={settings.parallelConversion}
                    onChange={(val) => update('parallelConversion', val)}
                  />
                </SettingsRow>
                {settings.parallelConversion === 'manual' && (
                  <SettingsRow dense child className={styles.dlRow} title={t('settings.download.workers')}>
                    <Stepper
                      className={styles.dlStepper}
                      dataTihokaId="workers-select"
                      decreaseLabel={<Icon name="minus" size="xs" />}
                      increaseLabel={<Icon name="plus" size="xs" />}
                      decreaseAriaLabel={t('settings.download.workers.decrease')}
                      increaseAriaLabel={t('settings.download.workers.increase')}
                      decreaseDisabled={settings.manualWorkerCount <= MIN_PARALLEL_WORKERS}
                      increaseDisabled={settings.manualWorkerCount >= MAX_PARALLEL_WORKERS}
                      onDecrease={() =>
                        update('manualWorkerCount', Math.max(MIN_PARALLEL_WORKERS, settings.manualWorkerCount - 1))
                      }
                      onIncrease={() =>
                        update('manualWorkerCount', Math.min(MAX_PARALLEL_WORKERS, settings.manualWorkerCount + 1))
                      }
                    >
                      <StepperValue dataTihokaId="workers-value">{settings.manualWorkerCount}</StepperValue>
                    </Stepper>
                  </SettingsRow>
                )}
              </SettingsGroup>

              <SettingsGroup label={t('settings.download.group.output')}>
                <SettingsRow dense className={styles.dlRow} title={t('settings.download.format')}>
                  <SegmentedControl
                    variant="raised"
                    className={styles.segmented}
                    ariaLabel={t('settings.download.format')}
                    data-tihoka-id="format-select"
                    options={PREFERRED_FORMAT_OPTIONS.map((f) => ({
                      value: f,
                      label: t(PREFERRED_FORMAT_SHORT_LABEL_KEYS[f]),
                      ariaLabel: t(PREFERRED_FORMAT_LABEL_KEYS[f]),
                      title: t(PREFERRED_FORMAT_LABEL_KEYS[f]),
                    }))}
                    value={settings.preferredVideoFormat}
                    onChange={(val) => update('preferredVideoFormat', val)}
                  />
                </SettingsRow>
                <SettingsRow dense className={styles.dlRow} title={t('settings.download.quality')} labelFor="set-quality">
                  <Select
                    id="set-quality"
                    className={styles.dlSelect}
                    data-tihoka-id="quality-select"
                    value={settings.defaultQuality}
                    options={QUALITY_OPTIONS.map((q) => ({ value: q, label: QUALITY_LABEL_KEYS[q] ? t(QUALITY_LABEL_KEYS[q]!) : q }))}
                    onChange={(val) => update('defaultQuality', val as VideoQuality)}
                  />
                </SettingsRow>
                <SettingsRow dense className={styles.dlRow} title={t('settings.download.convert')}>
                  <SegmentedControl
                    variant="raised"
                    className={styles.segmented}
                    ariaLabel={t('settings.download.convert')}
                    data-tihoka-id="convert-select"
                    options={CONVERT_OPTIONS.map((m) => ({
                      value: m,
                      label: t(CONVERT_SHORT_LABEL_KEYS[m]),
                      ariaLabel:
                        m === 'small-only'
                          ? t(CONVERT_LABEL_KEYS[m], [Math.round(MAX_CONVERT_BYTES / 1024 / 1024)])
                          : t(CONVERT_LABEL_KEYS[m]),
                      title:
                        m === 'small-only'
                          ? t(CONVERT_LABEL_KEYS[m], [Math.round(MAX_CONVERT_BYTES / 1024 / 1024)])
                          : t(CONVERT_LABEL_KEYS[m]),
                    }))}
                    value={settings.convertToMp4}
                    onChange={(val) => update('convertToMp4', val)}
                  />
                </SettingsRow>
                <SettingsRow dense className={styles.dlRow} title={t('settings.download.filenameSource')} labelFor="set-filename-source">
                  <Select
                    id="set-filename-source"
                    className={styles.dlSelect}
                    data-tihoka-id="filename-source-select"
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
              description={t('settings.shortcuts.hint')}
              data-section="shortcuts"
            >
              <div className={styles.shortcutSection}>
                <div className={styles.shortcutMasonry}>
                  {SHORTCUT_GROUPS.map((group) => (
                    <Surface
                      key={group.label}
                      variant="card"
                      className={styles.shortcutCard}
                      aria-label={t(group.label)}
                    >
                      <SettingsGroup label={t(group.label)} className={styles.shortcutGroup}>
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
                              divider
                              title={actionLabel}
                              labelFor={`set-shortcut-${action}`}
                              className={styles.shortcutField}
                            >
                              <span className={styles.shortcutInputWrap}>
                                <ShortcutInput
                                  id={`set-shortcut-${action}`}
                                  data-tihoka-id={`shortcut-${action}`}
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
                      </SettingsGroup>
                    </Surface>
                  ))}
                </div>
              </div>
            </SettingsSection>

            {/* === Appearance === */}
            <SettingsSection
              ref={sectionRef('theme')}
              headingLevel={3}
              title={t('settings.theme.title')}
              data-section="theme"
            >
              <SettingsGroup>
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
                  data-tihoka-id="settings-ui-language"
                  aria-label={t('settings.uiLanguage.label')}
                />
              </SettingsRow>
              </SettingsGroup>
              <ThemePanel />
            </SettingsSection>

            {/* === Cloud backup — Google Drive === */}
            <SettingsSection
              ref={sectionRef('cloudBackup')}
              headingLevel={3}
              title={t('settings.cloudBackup.title')}
              hint={t('settings.sync.privacy')}
              hintAriaLabel={t('settings.hint.aria', [t('settings.cloudBackup.title')])}
              data-section="cloudBackup"
            >
              <SyncPanel settings={settings} />
            </SettingsSection>

            {/* === Anki sync === */}
            <SettingsSection
              ref={sectionRef('ankiSync')}
              headingLevel={3}
              title={t('settings.ankiSync.title')}
              data-section="ankiSync"
            >
              <AnkiStatusSyncPanel settings={settings} onChange={onChange} />
            </SettingsSection>

          </div>
        </div>
  );
}
