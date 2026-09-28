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
import { AudioPanel } from '@/features/audio/ui/AudioPanel';

import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { Dictionary } from '@/features/dictionaryPopup';
import { Toggle } from '@/shared/ui/Toggle';
import { Label } from '@/shared/ui/Label';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { isShortcutConflict } from '@/entities/settings/lib/shortcutConflicts';
import { getActiveProfileSettings } from '@/entities/settings';
import { LanguageProfilePanel } from './LanguageProfilePanel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { HintIcon } from '@/shared/ui/HintIcon';
import { Card } from '@/shared/ui/Card';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { SettingsRow } from '@/shared/ui/SettingsRow';

import { NavItem } from '@/shared/ui/NavItem';
import { Navigation } from '@/shared/ui/Navigation';
import { Sidebar } from '@/shared/ui/Sidebar';
import { VStack } from '@/shared/ui/Stack';
import { BREAKPOINTS } from '@/shared/lib/tokens';

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
};

const SHORTCUT_GROUPS: readonly { label: MessageKey; actions: readonly ShortcutAction[] }[] = [
  { label: 'settings.shortcuts.group.navigation', actions: ['prev-cue', 'next-cue', 'replay-cue', 'play-pause', 'prev-vocab-token', 'next-vocab-token'] },
  { label: 'settings.shortcuts.group.toggle', actions: ['toggle-overlay', 'toggle-panel', 'toggle-translate', 'toggle-player-mode'] },
  { label: 'settings.shortcuts.group.generate', actions: ['generate-native'] },
  { label: 'settings.shortcuts.group.cardCreator', actions: ['quick-update', 'edit-card'] },
];

export function SettingsDialogContent({ settings, onChange, className, showSidebarHeader = true, navMode = 'auto' }: SettingsDialogContentProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<string>('general');
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

  const navOrientation = navMode === 'horizontal' || containerWidth < BREAKPOINTS.medium ? 'horizontal' : 'vertical';
  const sidebarExpanded = containerWidth >= SIDEBAR_LABEL_MIN_WIDTH;
  const activeProfile = getActiveProfileSettings(settings);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  const uiLanguageOptions = [
    { value: 'auto', label: t('settings.uiLanguage.auto') },
    { value: 'en', label: t('settings.uiLanguage.en') },
    { value: 'vi', label: t('settings.uiLanguage.vi') },
  ];

  const sidebarItems: { id: string; label: string; icon: string }[] = [
    { id: 'general', label: t('settings.nav.general'), icon: 'settings' },
    { id: 'languageProfile', label: t('settings.nav.languageProfile'), icon: 'languages' },
    { id: 'resources', label: t('settings.nav.resources'), icon: 'library' },
    { id: 'media', label: t('settings.nav.media'), icon: 'video' },
    { id: 'block', label: t('settings.nav.block'), icon: 'captions' },
    { id: 'dictionaryPopup', label: t('settings.nav.dictionaryPopup'), icon: 'bookOpen' },
    { id: 'wordBadge', label: t('settings.nav.wordBadge'), icon: 'move' },
    { id: 'audio', label: t('settings.nav.audio'), icon: 'audioWave' },
    { id: 'localPlayer', label: t('settings.nav.localPlayer'), icon: 'playRoundedRect' },
    { id: 'download', label: t('settings.nav.download'), icon: 'download' },
    { id: 'shortcuts', label: t('settings.nav.shortcuts'), icon: 'slidersHorizontal' },
    { id: 'theme', label: t('settings.nav.theme'), icon: 'sun' },
  ];

  return (
        <div
          ref={wrapperRef}
          className={[styles.popoverBody, navOrientation === 'vertical' ? styles.vertical : styles.horizontal, className].filter(Boolean).join(' ')}
        >
          {/* === Sidebar — SSOT Sidebar container + Navigation organism === */}
          <Sidebar
            ariaLabel="Settings sidebar"
            collapsed={navOrientation === 'vertical' && !sidebarExpanded}
            orientation={navOrientation}
            header={showSidebarHeader ? 'Settings' : undefined}
            className={styles.sidebarWidth}
          >
            <Navigation
              ariaLabel="Settings sections"
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
                  icon={item.icon}
                  label={item.label}
                  tooltip={item.label}
                  aria-label={item.label}
                />
              ))}
            </Navigation>
          </Sidebar>

          {/* === Main column (cards, scrollable) === */}
          <div className={styles.mainCol} ref={mainColRef}>

            {/* === Card 0: General === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.general = el; }}
              className={styles.sectionCard}
              data-section="general"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.general.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.general.desc')}</Text>
              </div>
              <VStack className={styles.cardBody}>
                <SettingsRow dense stacked>
                  <Label className={styles.rowLabel} size="sm" htmlFor="set-ui-language">
                    {t('settings.uiLanguage.label')}
                    <HintIcon
                      hint={t('settings.uiLanguage.hint')}
                      ariaLabel={t('settings.uiLanguage.hintAria')}
                    />
                  </Label>
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

                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    {t('settings.general.showDictPopup')}
                    <HintIcon
                      hint={t('settings.general.showDictPopup.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.general.showDictPopup')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.dictionaryPopup?.enabled ?? true}
                    onChange={(next) => {
                      const dp = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
                      onChange({ ...settings, dictionaryPopup: { ...dp, enabled: next } });
                    }}
                    ariaLabel={t('settings.general.showDictPopup')}
                  />
                </SettingsRow>
              </VStack>
            </Card>

            {/* === Card 1: Language Profile === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.languageProfile = el; }}
              className={styles.sectionCard}
              data-section="languageProfile"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.languageProfile.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.languageProfile.desc')}</Text>
              </div>
              <VStack className={styles.cardBody}>
                <LanguageProfilePanel settings={settings} onChange={onChange} />
              </VStack>
            </Card>

            {/* === Card 11: Resources === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.resources = el; }}
              className={styles.sectionCard}
              data-section="resources"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.resources.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.resources.desc')}</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
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
              </VStack>
            </Card>

            {/* === Card 2: Media Selection === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.media = el; }}
              className={styles.sectionCard}
              data-section="media"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.media.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.media.desc')}</Text>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <SettingsRow dense>
                  <span className={styles.rowLabel}>
                    {t('settings.media.autoSelect')}
                    <HintIcon
                      hint={t('settings.media.autoSelect.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.media.autoSelect')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.autoSelectEnabled}
                    onChange={(next) => update('autoSelectEnabled', next)}
                    ariaLabel={t('settings.media.autoSelect')}
                  />
                </SettingsRow>

                {settings.autoSelectEnabled && (
                  <SettingsRow dense divider stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-subtitle-lang">{t('settings.media.subtitleLanguages')}</Label>
                    <MultiSelect
                      testId="subtitle-lang-multiselect"
                      options={SUBTITLE_LANGUAGES}
                      selectedValues={settings.selectedSubtitleLanguages}
                      onChange={(values) => update('selectedSubtitleLanguages', values)}
                      exclusiveValues={['all']}
                      popularValues={['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de']}
                    />
                  </SettingsRow>
                )}
              </VStack>
            </Card>

            {/* === Card 3: Subtitle Block === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.block = el; }}
              className={styles.sectionCard}
              data-section="block"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.block.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.block.desc')}</Text>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <SettingsRow dense>
                  <span className={styles.rowLabel}>
                    {t('settings.block.autoLoad')}
                    <HintIcon
                      hint={t('settings.block.autoLoad.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.block.autoLoad')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.subtitleOverlayAutoLoad}
                    onChange={(next) => update('subtitleOverlayAutoLoad', next)}
                    ariaLabel={t('settings.block.autoLoad')}
                  />
                </SettingsRow>

                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    {t('settings.block.autoLoadAsr')}
                    <HintIcon
                      hint={t('settings.block.autoLoadAsr.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.block.autoLoadAsr')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.subtitleOverlayAutoLoadAsr}
                    onChange={(next) => update('subtitleOverlayAutoLoadAsr', next)}
                    ariaLabel={t('settings.block.autoLoadAsr')}
                    disabled={!settings.subtitleOverlayAutoLoad}
                  />
                </SettingsRow>

                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    {t('settings.block.autoTranslate')}
                    <HintIcon
                      hint={t('settings.block.autoTranslate.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.block.autoTranslate')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.subtitleOverlayAutoTranslate}
                    onChange={(next) => update('subtitleOverlayAutoTranslate', next)}
                    ariaLabel={t('settings.block.autoTranslate')}
                    disabled={!settings.subtitleOverlayAutoLoad}
                  />
                </SettingsRow>
              </VStack>
            </Card>

            {/* === Card 7: Dictionary Popup === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.dictionaryPopup = el; }}
              className={styles.sectionCard}
              data-section="dictionaryPopup"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>
                  {t('settings.dictionaryPopup.title')}
                  <HintIcon
                    hint={t('settings.dictionaryPopup.saveHint')}
                    ariaLabel={t('settings.hint.aria', [t('settings.dictionaryPopup.title')])}
                  />
                </Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.dictionaryPopup.desc')}</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <DictionaryPopupSettingsPanel
                  settings={settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS}
                  onChange={(dp) => onChange({ ...settings, dictionaryPopup: dp })}
                />
              </VStack>
            </Card>

            {/* === Card 7.2: Word badge === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.wordBadge = el; }}
              className={styles.sectionCard}
              data-section="wordBadge"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>
                  {t('settings.wordBadge.title')}
                  <HintIcon
                    hint={t('settings.wordBadge.hint')}
                    ariaLabel={t('settings.hint.aria', [t('settings.wordBadge.title')])}
                  />
                </Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.wordBadge.desc')}</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <WordBadgeSettingsPanel
                  badgePointerTrigger={settings.dictionaryPopup?.badgePointerTrigger ?? DEFAULT_DICTIONARY_POPUP_SETTINGS.badgePointerTrigger}
                  onChange={(badge) => {
                    const dp = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
                    onChange({ ...settings, dictionaryPopup: { ...dp, badgePointerTrigger: badge } });
                  }}
                />
              </VStack>
            </Card>

            {/* === Card 7.4: Audio (merged Pronunciation + Local Pronunciation + TTS Voices) === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.audio = el; }}
              className={styles.sectionCard}
              data-section="audio"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.audio.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.audio.desc')}</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <AudioPanel
                  pronunciation={settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS}
                  tts={settings.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS}
                  targetLang={activeProfile?.resourceLangCode ?? settings.subtitleOverlayTargetLanguage ?? 'en'}
                  onPronunciationChange={(p) => onChange({ ...settings, pronunciation: p })}
                  onTtsChange={(tts) => onChange({ ...settings, dictionaryPopup: { ...(settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS), tts } })}
                />
              </VStack>
            </Card>

            {/* === Card 8: Local Player === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.localPlayer = el; }}
              className={styles.sectionCard}
              data-section="localPlayer"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.localPlayer.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.localPlayer.desc')}</Text>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <SettingsRow dense>
                  <span className={styles.rowLabel}>
                    {t('settings.localPlayer.subtitleMatch')}
                    <HintIcon
                      hint={t('settings.localPlayer.subtitleMatch.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.localPlayer.subtitleMatch')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.localPlayerSettings.subtitleMatchEnabled}
                    onChange={(next) => onChange({ ...settings, localPlayerSettings: { ...settings.localPlayerSettings, subtitleMatchEnabled: next } })}
                    ariaLabel={t('settings.localPlayer.subtitleMatch')}
                  />
                </SettingsRow>
                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    {t('settings.localPlayer.resumePrompt')}
                    <HintIcon
                      hint={t('settings.localPlayer.resumePrompt.hint')}
                      ariaLabel={t('settings.hint.aria', [t('settings.localPlayer.resumePrompt')])}
                    />
                  </span>
                  <Toggle
                    checked={settings.localPlayerSettings.resumePromptEnabled}
                    onChange={(next) => onChange({ ...settings, localPlayerSettings: { ...settings.localPlayerSettings, resumePromptEnabled: next } })}
                    ariaLabel={t('settings.localPlayer.resumePrompt')}
                  />
                </SettingsRow>
              </VStack>
            </Card>

            {/* === Card 5: Download === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.download = el; }}
              className={styles.sectionCard}
              data-section="download"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.download.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.download.desc')}</Text>
              </div>
              <div className={styles.downloadCardBody}>
                <VStack gap="3" className={styles.downloadGroup}>
                  <div className={styles.downloadGroupTitle}>{t('settings.download.group.concurrency')}</div>
                  <SettingsRow dense stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-concurrent">{t('settings.download.concurrent')}</Label>
                    <Select
                      id="set-concurrent"
                      className={styles.select}
                      data-cell-id="concurrent-select"
                      value={String(settings.concurrentDownloads)}
                      options={[1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
                      onChange={(val) => update('concurrentDownloads', Number(val))}
                    />
                  </SettingsRow>
                </VStack>

                <VStack gap="3" className={styles.downloadGroup}>
                  <div className={styles.downloadGroupTitle}>{t('settings.download.group.formatQuality')}</div>
                  <VStack columns={2} responsive gapResponsive={{ mobile: '2', desktop: '4' }}>
                    <SettingsRow dense stacked>
                      <Label className={styles.rowLabel} size="sm" htmlFor="set-format">{t('settings.download.format')}</Label>
                      <Select
                        id="set-format"
                        className={styles.select}
                        data-cell-id="format-select"
                        value={settings.preferredVideoFormat}
                        options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: t(PREFERRED_FORMAT_LABEL_KEYS[f]) }))}
                        onChange={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
                      />
                    </SettingsRow>
                    <SettingsRow dense stacked>
                      <Label className={styles.rowLabel} size="sm" htmlFor="set-quality">{t('settings.download.quality')}</Label>
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
                </VStack>

                <VStack gap="3" className={styles.downloadGroup}>
                  <div className={styles.downloadGroupTitle}>{t('settings.download.group.conversion')}</div>
                  <SettingsRow dense stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-convert">{t('settings.download.convert')}</Label>
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
                  <SettingsRow dense stacked>
                    <span className={styles.rowLabel}>
                      {t('settings.download.parallel')}
                      <HintIcon
                        hint={t('settings.download.parallel.hint')}
                        ariaLabel={t('settings.hint.aria', [t('settings.download.parallel')])}
                      />
                    </span>
                    <Select
                      className={styles.select}
                      data-cell-id="parallel-select"
                      value={settings.parallelConversion}
                      options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: t(PARALLEL_LABEL_KEYS[m]) }))}
                      onChange={(val) => update('parallelConversion', val as ParallelConversionMode)}
                    />
                  </SettingsRow>
                  {settings.parallelConversion === 'manual' && (
                    <SettingsRow dense stacked className={styles.childField}>
                      <Label className={styles.rowLabel} size="sm" htmlFor="set-workers">{t('settings.download.workers')}</Label>
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
                </VStack>

                <VStack gap="3" className={styles.downloadGroup}>
                  <div className={styles.downloadGroupTitle}>{t('settings.download.group.filename')}</div>
                  <SettingsRow dense stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-filename-source">{t('settings.download.filenameSource')}</Label>
                    <Select
                      id="set-filename-source"
                      className={styles.select}
                      data-cell-id="filename-source-select"
                      value={settings.filenameSource}
                      options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: t(FILENAME_SOURCE_LABEL_KEYS[m]) }))}
                      onChange={(val) => update('filenameSource', val as FilenameSource)}
                    />
                  </SettingsRow>
                </VStack>
              </div>
            </Card>

            {/* === Card 4: Keyboard Shortcuts === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.shortcuts = el; }}
              className={styles.sectionCard}
              data-section="shortcuts"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.shortcuts.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.shortcuts.desc')}</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <div className={styles.shortcutSection}>
                  {SHORTCUT_GROUPS.map((group) => (
                    <VStack key={group.label} gap="1" className={styles.shortcutGroupWrap}>
                      <div className={styles.groupLabel}>{t(group.label)}</div>
                      <VStack columns={2} responsive gap="2" className={styles.shortcutGroup}>
                        {group.actions.map((action) => {
                          const shortcut = settings.keyboardShortcuts.find((s) => s.action === action);
                          const currentValue = shortcut
                            ? { key: shortcut.key, ctrl: shortcut.ctrl, shift: shortcut.shift, alt: shortcut.alt }
                            : { key: '' };
                          const conflict = isShortcutConflict(settings.keyboardShortcuts, action);
                          const actionLabel = t(SHORTCUT_ACTION_LABELS[action]);
                          return (
                            <div key={action} className={styles.shortcutField}>
                              <Label className={styles.rowLabel} size="sm" htmlFor={`set-shortcut-${action}`}>{actionLabel}</Label>
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
                                />
                                {conflict && (
                                  <span
                                    className={styles.conflictDot}
                                    title={t('settings.shortcuts.conflict.title')}
                                    aria-label={t('settings.shortcuts.conflict.aria')}
                                  />
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </VStack>
                    </VStack>
                  ))}
                </div>
              </VStack>
            </Card>

            {/* === Card 9: Theme === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.theme = el; }}
              className={styles.sectionCard}
              data-section="theme"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.theme.title')}</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>{t('settings.theme.desc')}</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <ThemePanel />
              </VStack>
            </Card>

          </div>
        </div>
  );
}
