import { useRef, useState, useEffect } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction } from '@/entities/media';
import type { CardCreatorSettings, UiLanguagePreference } from '@/entities/settings';
import { t, type MessageKey, setUiLanguageOverride } from '@/shared/i18n';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_PRONUNCIATION_SETTINGS,
} from '@/shared/config/config';
import { SUBTITLE_LANGUAGES } from '@/shared/config/languageRegistry';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import { CardCreatorSettingsPanel } from './CardCreatorSettingsPanel';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';
import { WordBadgeSettingsPanel } from './WordBadgeSettingsPanel';
import { AudioPanel } from '@/features/audio/ui/AudioPanel';

import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { Toggle } from '@/shared/ui/Toggle';
import { Label } from '@/shared/ui/Label';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { isShortcutConflict } from '@/entities/settings/lib/shortcutConflicts';
import { LanguageProfilePanel } from './LanguageProfilePanel';
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
}

const QUALITY_OPTIONS: readonly VideoQuality[] = ['highest', '1080p', '720p', '480p', '360p', 'lowest', 'auto'];
const QUALITY_LABELS: Record<VideoQuality, string> = {
  highest: 'Highest', '1080p': '1080p', '720p': '720p', '480p': '480p',
  '360p': '360p', lowest: 'Lowest', auto: 'Auto (best)',
};

const CONVERT_OPTIONS: readonly ConvertToMp4Mode[] = ['always', 'small-only', 'never'];
const CONVERT_LABELS: Record<ConvertToMp4Mode, string> = {
  always: 'Always', 'small-only': `Small only (≤${Math.round(MAX_CONVERT_BYTES / 1024 / 1024)}MB)`, never: 'Never',
};

const PARALLEL_OPTIONS: readonly ParallelConversionMode[] = ['off', 'auto', 'manual'];
const PARALLEL_LABELS: Record<ParallelConversionMode, string> = { off: 'Off', auto: 'Auto', manual: 'Manual' };

const WORKER_OPTIONS = [2, 3, 4, 5, 6];

const FILENAME_SOURCE_OPTIONS: readonly FilenameSource[] = ['title-fallback', 'title-only', 'url-only'];
const FILENAME_SOURCE_LABELS: Record<FilenameSource, string> = {
  'title-fallback': 'Title (fallback URL)',
  'title-only': 'Title only',
  'url-only': 'URL only',
};

const PREFERRED_FORMAT_OPTIONS: readonly ('mp4' | 'm3u8')[] = ['m3u8', 'mp4'];
const PREFERRED_FORMAT_LABELS: Record<'mp4' | 'm3u8', string> = {
  m3u8: 'm3u8 (HLS)', mp4: 'mp4 (direct)',
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
};

const SHORTCUT_GROUPS: readonly { label: MessageKey; actions: readonly ShortcutAction[] }[] = [
  { label: 'settings.shortcuts.group.navigation', actions: ['prev-cue', 'next-cue', 'replay-cue', 'play-pause'] },
  { label: 'settings.shortcuts.group.toggle', actions: ['toggle-overlay', 'toggle-panel', 'toggle-translate', 'toggle-player-mode'] },
  { label: 'settings.shortcuts.group.generate', actions: ['generate-native'] },
  { label: 'settings.shortcuts.group.cardCreator', actions: ['quick-update', 'edit-card'] },
];

export function SettingsDialogContent({ settings, onChange, className, showSidebarHeader = true }: SettingsDialogContentProps): React.JSX.Element {
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

  const navOrientation = containerWidth < BREAKPOINTS.medium ? 'horizontal' : 'vertical';
  const sidebarExpanded = containerWidth >= BREAKPOINTS.expanded;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  const updateCardCreator = (partial: Partial<CardCreatorSettings>): void => {
    const current = settings.cardCreator;
    onChange({ ...settings, cardCreator: { ...current, ...partial } });
  };

  const uiLanguageOptions = [
    { value: 'auto', label: t('settings.uiLanguage.auto') },
    { value: 'en', label: t('settings.uiLanguage.en') },
    { value: 'vi', label: t('settings.uiLanguage.vi') },
  ];

  const sidebarItems: { id: string; label: string; icon: string }[] = [
    { id: 'general', label: t('settings.nav.general'), icon: 'settings' },
    { id: 'languageProfile', label: 'Language Profile', icon: 'languages' },
    { id: 'media', label: 'Media', icon: 'video' },
    { id: 'block', label: 'Block', icon: 'captions' },
    { id: 'shortcuts', label: 'Shortcuts', icon: 'slidersHorizontal' },
    { id: 'download', label: 'Download', icon: 'download' },
    { id: 'cardCreator', label: 'Card Creator', icon: 'layers' },
    { id: 'dictionaryPopup', label: 'Dictionary Popup', icon: 'bookOpen' },
    { id: 'wordBadge', label: 'Word badge', icon: 'move' },
    { id: 'audio', label: 'Audio', icon: 'audioWave' },
    { id: 'localPlayer', label: 'Local Player', icon: 'playRoundedRect' },
    { id: 'theme', label: 'Theme', icon: 'sun' },
    { id: 'resources', label: 'Resources', icon: 'library' },
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
                    Show dictionary popup
                  </span>
                  <Toggle
                    checked={settings.dictionaryPopup?.enabled ?? true}
                    onChange={(next) => {
                      const dp = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
                      onChange({ ...settings, dictionaryPopup: { ...dp, enabled: next } });
                    }}
                    ariaLabel="Show dictionary popup"
                    title={`Dictionary popup: ${settings.dictionaryPopup?.enabled ? 'ON' : 'OFF'}`}
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
                <Heading level={4} size={3} className={styles.cardTitle}>Language Profile</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Manage language profiles for learning. One profile is active at a time.</Text>
              </div>
              <VStack className={styles.cardBody}>
                <LanguageProfilePanel settings={settings} onChange={onChange} />
              </VStack>
            </Card>

            {/* === Card 2: Media Selection === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.media = el; }}
              className={styles.sectionCard}
              data-section="media"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>Media Selection</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Configure how media is automatically selected.</Text>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <SettingsRow dense>
                  <span className={styles.rowLabel}>
                    Auto select media
                    <HintIcon
                      hint="Khi bật, mở popup → media tự chọn theo preference."
                      ariaLabel="Show hint for Auto select media"
                    />
                  </span>
                  <Toggle
                    checked={settings.autoSelectEnabled}
                    onChange={(next) => update('autoSelectEnabled', next)}
                    ariaLabel="Toggle auto select"
                    title={`Auto select: ${settings.autoSelectEnabled ? 'ON' : 'OFF'}`}
                  />
                </SettingsRow>

                {settings.autoSelectEnabled && (
                  <SettingsRow dense divider stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-subtitle-lang">Subtitle languages</Label>
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
                <Heading level={4} size={3} className={styles.cardTitle}>Block</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Position, scale, and auto-load behavior for the unified subtitle block.</Text>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <SettingsRow dense>
                  <span className={styles.rowLabel}>
                    Overlay auto-load
                    <HintIcon
                      hint="Khi bật, overlay tự load subtitle detect được cùng target language."
                      ariaLabel="Show hint for Overlay auto-load"
                    />
                  </span>
                  <Toggle
                    checked={settings.subtitleOverlayAutoLoad}
                    onChange={(next) => update('subtitleOverlayAutoLoad', next)}
                    ariaLabel="Toggle overlay auto-load"
                    title={`Overlay auto-load: ${settings.subtitleOverlayAutoLoad ? 'ON' : 'OFF'}`}
                  />
                </SettingsRow>

                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    Auto-load YouTube ASR
                    <HintIcon
                      hint="Khi bật, YouTube auto-generated captions (ASR) được auto-load. Khi tắt, chỉ manual captions mới auto-load. Áp dụng cho cả target + native."
                      ariaLabel="Show hint for Auto-load YouTube ASR"
                    />
                  </span>
                  <Toggle
                    checked={settings.subtitleOverlayAutoLoadAsr}
                    onChange={(next) => update('subtitleOverlayAutoLoadAsr', next)}
                    ariaLabel="Toggle auto-load YouTube ASR"
                    title={`Auto-load YouTube ASR: ${settings.subtitleOverlayAutoLoadAsr ? 'ON' : 'OFF'}`}
                    disabled={!settings.subtitleOverlayAutoLoad}
                  />
                </SettingsRow>

                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    Auto-translate when native missing
                    <HintIcon
                      hint="Khi bật, nếu site không có track native → tự dịch target→native qua Google Translate (miễn phí, không API key). Background prefill, 0 setting. Default ON."
                      ariaLabel="Show hint for Auto-translate when native missing"
                    />
                  </span>
                  <Toggle
                    checked={settings.subtitleOverlayAutoTranslate}
                    onChange={(next) => update('subtitleOverlayAutoTranslate', next)}
                    ariaLabel="Toggle auto-translate when native missing"
                    title={`Auto-translate when native missing: ${settings.subtitleOverlayAutoTranslate ? 'ON' : 'OFF'}`}
                    disabled={!settings.subtitleOverlayAutoLoad}
                  />
                </SettingsRow>
              </VStack>
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

            {/* === Card 5: Download === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.download = el; }}
              className={styles.sectionCard}
              data-section="download"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>Download</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Download format, quality, concurrency, conversion, and filename options.</Text>
              </div>
              <div className={styles.downloadCardBody}>
                <VStack gap="3" className={styles.downloadGroup}>
                  <div className={styles.downloadGroupTitle}>Concurrency</div>
                  <SettingsRow dense stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-concurrent">Downloads at once</Label>
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
                  <div className={styles.downloadGroupTitle}>Format & Quality</div>
                  <VStack columns={2} responsive gapResponsive={{ mobile: '2', desktop: '4' }}>
                    <SettingsRow dense stacked>
                      <Label className={styles.rowLabel} size="sm" htmlFor="set-format">Preferred format</Label>
                      <Select
                        id="set-format"
                        className={styles.select}
                        data-cell-id="format-select"
                        value={settings.preferredVideoFormat}
                        options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: PREFERRED_FORMAT_LABELS[f] }))}
                        onChange={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
                      />
                    </SettingsRow>
                    <SettingsRow dense stacked>
                      <Label className={styles.rowLabel} size="sm" htmlFor="set-quality">Default quality</Label>
                      <Select
                        id="set-quality"
                        className={styles.select}
                        data-cell-id="quality-select"
                        value={settings.defaultQuality}
                        options={QUALITY_OPTIONS.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
                        onChange={(val) => update('defaultQuality', val as VideoQuality)}
                      />
                    </SettingsRow>
                  </VStack>
                </VStack>

                <VStack gap="3" className={styles.downloadGroup}>
                  <div className={styles.downloadGroupTitle}>Conversion</div>
                  <SettingsRow dense stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-convert">Convert to MP4</Label>
                    <Select
                      id="set-convert"
                      className={styles.select}
                      data-cell-id="convert-select"
                      value={settings.convertToMp4}
                      options={CONVERT_OPTIONS.map((m) => ({ value: m, label: CONVERT_LABELS[m] }))}
                      onChange={(val) => update('convertToMp4', val as ConvertToMp4Mode)}
                    />
                  </SettingsRow>
                  <SettingsRow dense stacked>
                    <span className={styles.rowLabel}>
                      Parallel conversion
                      <HintIcon
                        hint={`Parallel conversion: ${settings.parallelConversion} (số lượng tùy vào GPU của máy tính hiện có)`}
                        ariaLabel="Show hint for Parallel conversion"
                      />
                    </span>
                    <Select
                      className={styles.select}
                      data-cell-id="parallel-select"
                      value={settings.parallelConversion}
                      options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: PARALLEL_LABELS[m] }))}
                      onChange={(val) => update('parallelConversion', val as ParallelConversionMode)}
                    />
                  </SettingsRow>
                  {settings.parallelConversion === 'manual' && (
                    <SettingsRow dense stacked className={styles.childField}>
                      <Label className={styles.rowLabel} size="sm" htmlFor="set-workers">Workers</Label>
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
                  <div className={styles.downloadGroupTitle}>Filename</div>
                  <SettingsRow dense stacked>
                    <Label className={styles.rowLabel} size="sm" htmlFor="set-filename-source">Filename source</Label>
                    <Select
                      id="set-filename-source"
                      className={styles.select}
                      data-cell-id="filename-source-select"
                      value={settings.filenameSource}
                      options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: FILENAME_SOURCE_LABELS[m] }))}
                      onChange={(val) => update('filenameSource', val as FilenameSource)}
                    />
                  </SettingsRow>
                </VStack>
              </div>
            </Card>

            {/* === Card 6: Card Creator === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.cardCreator = el; }}
              className={styles.sectionCard}
              data-section="cardCreator"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>Card Creator</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Connect to Anki via AnkiConnect. Create and update flashcards from video content.</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <CardCreatorSettingsPanel
                  settings={settings.cardCreator}
                  srsDestination={settings.dictionaryPopup?.srsDestination ?? 'anki'}
                  onChange={updateCardCreator}
                  onDestinationChange={(srsDestination) =>
                    onChange({
                      ...settings,
                      dictionaryPopup: { ...(settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS), srsDestination },
                    })
                  }
                />
              </VStack>
            </Card>

            {/* === Card 7: Dictionary Popup === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.dictionaryPopup = el; }}
              className={styles.sectionCard}
              data-section="dictionaryPopup"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.dictionaryPopup.title')}</Heading>
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
                <Heading level={4} size={3} className={styles.cardTitle}>{t('settings.wordBadge.title')}</Heading>
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
                <Heading level={4} size={3} className={styles.cardTitle}>Audio</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Pick an output mode, then tap any source in the pipeline to tune it.</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <AudioPanel
                  pronunciation={settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS}
                  tts={settings.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS}
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
                <Heading level={4} size={3} className={styles.cardTitle}>Local Player</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Configure the local video player: subtitle auto-match and resume prompt.</Text>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <SettingsRow dense>
                  <span className={styles.rowLabel}>
                    Subtitle auto-match
                    <HintIcon
                      hint="Khi bật, mở video → tự tìm phụ đề cùng tên trong cùng folder."
                      ariaLabel="Show hint for Subtitle auto-match"
                    />
                  </span>
                  <Toggle
                    checked={settings.localPlayerSettings.subtitleMatchEnabled}
                    onChange={(next) => onChange({ ...settings, localPlayerSettings: { ...settings.localPlayerSettings, subtitleMatchEnabled: next } })}
                    ariaLabel="Toggle subtitle auto-match"
                    title={`Subtitle auto-match: ${settings.localPlayerSettings.subtitleMatchEnabled ? 'ON' : 'OFF'}`}
                  />
                </SettingsRow>
                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    Resume prompt
                    <HintIcon
                      hint="Khi bật, mở lại video → hỏi 'Continue from X?' nếu đã xem trước đó."
                      ariaLabel="Show hint for Resume prompt"
                    />
                  </span>
                  <Toggle
                    checked={settings.localPlayerSettings.resumePromptEnabled}
                    onChange={(next) => onChange({ ...settings, localPlayerSettings: { ...settings.localPlayerSettings, resumePromptEnabled: next } })}
                    ariaLabel="Toggle resume prompt"
                    title={`Resume prompt: ${settings.localPlayerSettings.resumePromptEnabled ? 'ON' : 'OFF'}`}
                  />
                </SettingsRow>
              </VStack>
            </Card>

            {/* === Card 9: Theme === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.theme = el; }}
              className={styles.sectionCard}
              data-section="theme"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>Theme</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Light/dark/system mode.</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <ThemePanel />
              </VStack>
            </Card>

            {/* === Card 11: Resources === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.resources = el; }}
              className={styles.sectionCard}
              data-section="resources"
            >
              <div className={styles.cardHeader}>
                <Heading level={4} size={3} className={styles.cardTitle}>Resources</Heading>
                <Text as="p" color="secondary" className={styles.cardDesc}>Import and manage dictionaries and frequency lists.</Text>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <ResourcesPanel
                  langCode={settings.subtitleOverlayTargetLanguage || 'en'}
                  frequencyBands={settings.frequencyBands}
                  onFrequencyBandsChange={(bands) => update('frequencyBands', bands)}
                />
              </VStack>
            </Card>

          </div>
        </div>
  );
}


