import { useRef, useState } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction } from '@/entities/media';
import type { CardCreatorSettings } from '@/entities/settings';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
} from '@/shared/config/config';
// ADR-029: language dropdown lists now come from the single-source-of-truth
// registry. The hardcoded SUBTITLE_LANGUAGES + OVERLAY_LANGUAGE_OPTIONS arrays
// that used to live here (~200 lines) have been removed.
import { SUBTITLE_LANGUAGES } from '@/shared/config/languageRegistry';
import { MultiSelect } from './MultiSelect';
import { CardCreatorSettingsPanel } from './CardCreatorSettingsPanel';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';

import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { TtsVoiceManagerPanel, DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { Toggle } from '@/shared/ui/Toggle';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { LanguageProfilePanel } from './LanguageProfilePanel';
import { Select } from '@/shared/ui/Select';
import { HintIcon } from '@/shared/ui/HintIcon';
import { Card } from '@/shared/ui/Card';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Icon } from '@/shared/ui/Icon';
import { NavItem } from '@/shared/ui/NavItem';
import { Sidebar } from '@/shared/ui/Sidebar';
import { VStack } from '@/shared/ui/Stack';

import styles from './SettingsDialog.module.css';

export interface SettingsDialogContentProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  className?: string;
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

const SHORTCUT_ACTION_LABELS: Record<ShortcutAction, string> = {
  'prev-cue': 'Previous cue',
  'next-cue': 'Next cue',
  'replay-cue': 'Replay cue',
  'play-pause': 'Play / pause video',
  'toggle-overlay': 'Toggle overlay',
  'toggle-panel': 'Toggle panel',
  'toggle-translate': 'Toggle auto-translate',
  'generate-native': 'Generate native subtitle',
  'toggle-player-mode': 'Toggle Player Mode',
  'quick-update': 'Card Creator: Quick update',
  'edit-card': 'Card Creator: Edit card',
};

const SHORTCUT_GROUPS: readonly { label: string; actions: readonly ShortcutAction[] }[] = [
  { label: 'Navigation', actions: ['prev-cue', 'next-cue', 'replay-cue', 'play-pause'] },
  { label: 'Toggle', actions: ['toggle-overlay', 'toggle-panel', 'toggle-translate', 'toggle-player-mode'] },
  { label: 'Generate', actions: ['generate-native'] },
  { label: 'Card Creator', actions: ['quick-update', 'edit-card'] },
];

/**
 * Language dropdown lists (ADR-029): derived from the single-source-of-truth
 * languageRegistry.ts. The hardcoded arrays that used to live here (~200 lines)
 * have been removed. SUBTITLE_LANGUAGES includes "all"; OVERLAY_LANGUAGE_OPTIONS
 * includes "None" + BCP 47 variants (zh-hans, zh-hant).
 */

export function SettingsDialogContent({ settings, onChange, className }: SettingsDialogContentProps): React.JSX.Element {
  // ADR-013: tab state for Target/Native style panel (kept here so tab switch
  // preserves state — panel unmounts/remounts would lose unsaved slider drag)

  // Sidebar owns active state + scroll-spy + floating bg animation.
  // Consumer only provides: contentRef + sectionRefs for scroll-spy integration.
  const [activeSection, setActiveSection] = useState<string>('media');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainColRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  // schema v10: partial update cho Card Creator settings
  const updateCardCreator = (partial: Partial<CardCreatorSettings>): void => {
    const current = settings.cardCreator;
    onChange({ ...settings, cardCreator: { ...current, ...partial } });
  };

  const sidebarItems: { id: string; label: string; icon: string }[] = [
    { id: 'media', label: 'Media', icon: 'video' },
    { id: 'block', label: 'Block', icon: 'captions' },
    { id: 'languageProfile', label: 'Language Profile', icon: 'languages' },
    { id: 'shortcuts', label: 'Shortcuts', icon: 'slidersHorizontal' },
    { id: 'download', label: 'Download', icon: 'download' },
    { id: 'cardCreator', label: 'Card Creator', icon: 'layers' },
    { id: 'dictionaryPopup', label: 'Dictionary Popup', icon: 'bookOpen' },
    { id: 'localPlayer', label: 'Local Player', icon: 'playRoundedRect' },
    { id: 'theme', label: 'Theme', icon: 'sun' },
    { id: 'tts', label: 'TTS Voices', icon: 'volumeHigh' },
    { id: 'resources', label: 'Resources', icon: 'library' },
  ];

  return (
        <div className={[styles.popoverBody, className].filter(Boolean).join(' ')}>
          {/* === Sidebar — SSOT Sidebar component (responsive + collapsible) === */}
          <Sidebar
            ariaLabel="Settings sections"
            collapsible
            header="Settings"
            activeId={activeSection}
            onActiveChange={setActiveSection}
            contentRef={mainColRef}
            sectionRefs={sectionRefs}
            className={styles.sidebarWidth}
          >
            {sidebarItems.map((item) => (
              <NavItem
                key={item.id}
                data-section-id={item.id}
                icon={<Icon name={item.icon as never} size="sm" />}
                label={item.label}
                orientation="horizontal"
              />
            ))}
          </Sidebar>

          {/* === Main column (cards, scrollable) === */}
          <div className={styles.mainCol} ref={mainColRef}>

            {/* === Card 1: Media Selection === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.media = el; }}
              className={styles.sectionCard}
              data-section="media"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Media Selection</h4>
                <p className={styles.cardDesc}>Configure how media is automatically selected.</p>
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
                    <label className={styles.rowLabel} htmlFor="set-subtitle-lang">Subtitle languages</label>
                    <MultiSelect
                      testId="subtitle-lang-multiselect"
                      options={SUBTITLE_LANGUAGES}
                      selectedValues={settings.selectedSubtitleLanguages}
                      onChange={(values) => update('selectedSubtitleLanguages', values)}
                      placeholder="Search languages..."
                    />
                  </SettingsRow>
                )}
              </VStack>
            </Card>

            {/* === Card 2: Subtitle Block === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.block = el; }}
              className={styles.sectionCard}
              data-section="block"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Block</h4>
                <p className={styles.cardDesc}>Position, scale, and auto-load behavior for the unified subtitle block.</p>
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

            {/* === Card 3: Language Profile === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.languageProfile = el; }}
              className={styles.sectionCard}
              data-section="languageProfile"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Language Profile</h4>
                <p className={styles.cardDesc}>Manage language profiles for learning. One profile is active at a time.</p>
              </div>
              <VStack className={styles.cardBody}>
                <LanguageProfilePanel settings={settings} onChange={onChange} />
              </VStack>
            </Card>

            {/* === Card 4: Keyboard Shortcuts === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.shortcuts = el; }}
              className={styles.sectionCard}
              data-section="shortcuts"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Keyboard Shortcuts</h4>
                <p className={styles.cardDesc}>Remap keys for subtitle panel navigation actions.</p>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <div className={styles.shortcutSection}>
                  {SHORTCUT_GROUPS.map((group) => (
                    <VStack key={group.label} gap="1" className={styles.shortcutGroupWrap}>
                      <div className={styles.groupLabel}>{group.label}</div>
                      <VStack columns={2} responsive gap="2" className={styles.shortcutGroup}>
                        {group.actions.map((action) => {
                          const shortcut = settings.keyboardShortcuts.find((s) => s.action === action);
                          const currentValue = shortcut
                            ? { key: shortcut.key, ctrl: shortcut.ctrl, shift: shortcut.shift, alt: shortcut.alt }
                            : { key: '' };
                          return (
                            <div key={action} className={styles.shortcutField}>
                              <label className={styles.rowLabel} htmlFor={`set-shortcut-${action}`}>{SHORTCUT_ACTION_LABELS[action]}</label>
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
                                aria-label={SHORTCUT_ACTION_LABELS[action]}
                              />
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
                <h4 className={styles.cardTitle}>Download</h4>
                <p className={styles.cardDesc}>Download format, quality, concurrency, conversion, and filename options.</p>
              </div>
              <VStack gap="2" className={styles.cardBody}>
                <div className={styles.groupLabel}>Concurrency</div>
                <SettingsRow dense>
                  <label className={styles.rowLabel} htmlFor="set-concurrent">Downloads at once</label>
                  <Select
                    data-cell-id="concurrent-select"
                    value={String(settings.concurrentDownloads)}
                    options={[1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
                    onChange={(val) => update('concurrentDownloads', Number(val))}
                  />
                </SettingsRow>

                <div className={styles.groupLabel}>Format & Quality</div>
                <VStack columns={2} responsive gapResponsive={{ mobile: '2', desktop: '4' }}>
                  <SettingsRow dense stacked>
                    <label className={styles.rowLabel} htmlFor="set-format">Preferred format</label>
                    <Select
                      data-cell-id="format-select"
                      value={settings.preferredVideoFormat}
                      options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: PREFERRED_FORMAT_LABELS[f] }))}
                      onChange={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
                    />
                  </SettingsRow>
                  <SettingsRow dense stacked>
                    <label className={styles.rowLabel} htmlFor="set-quality">Default quality</label>
                    <Select
                      data-cell-id="quality-select"
                      value={settings.defaultQuality}
                      options={QUALITY_OPTIONS.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
                      onChange={(val) => update('defaultQuality', val as VideoQuality)}
                    />
                  </SettingsRow>
                </VStack>

                <div className={styles.groupLabel}>Conversion</div>
                <SettingsRow dense>
                  <label className={styles.rowLabel} htmlFor="set-convert">Convert to MP4</label>
                  <Select
                    data-cell-id="convert-select"
                    value={settings.convertToMp4}
                    options={CONVERT_OPTIONS.map((m) => ({ value: m, label: CONVERT_LABELS[m] }))}
                    onChange={(val) => update('convertToMp4', val as ConvertToMp4Mode)}
                  />
                </SettingsRow>
                <SettingsRow dense divider>
                  <span className={styles.rowLabel}>
                    Parallel conversion
                    <HintIcon
                      hint={`Parallel conversion: ${settings.parallelConversion} (số lượng tùy vào GPU của máy tính hiện có)`}
                      ariaLabel="Show hint for Parallel conversion"
                    />
                  </span>
                  <Select
                    data-cell-id="parallel-select"
                    value={settings.parallelConversion}
                    options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: PARALLEL_LABELS[m] }))}
                    onChange={(val) => update('parallelConversion', val as ParallelConversionMode)}
                  />
                </SettingsRow>
                {settings.parallelConversion === 'manual' && (
                  <SettingsRow dense divider stacked className={styles.childField}>
                    <label className={styles.rowLabel} htmlFor="set-workers">Workers</label>
                    <Select
                      data-cell-id="workers-select"
                      value={String(settings.manualWorkerCount)}
                      options={WORKER_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                      onChange={(val) => update('manualWorkerCount', Math.max(MIN_PARALLEL_WORKERS, Math.min(MAX_PARALLEL_WORKERS, Number(val))))}
                    />
                  </SettingsRow>
                )}

                <div className={styles.groupLabel}>Filename</div>
                <SettingsRow dense>
                  <label className={styles.rowLabel} htmlFor="set-filename-source">Filename source</label>
                  <Select
                    data-cell-id="filename-source-select"
                    value={settings.filenameSource}
                    options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: FILENAME_SOURCE_LABELS[m] }))}
                    onChange={(val) => update('filenameSource', val as FilenameSource)}
                  />
                </SettingsRow>
              </VStack>
            </Card>

            {/* === Card 6: Card Creator === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.cardCreator = el; }}
              className={styles.sectionCard}
              data-section="cardCreator"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Card Creator</h4>
                <p className={styles.cardDesc}>Connect to Anki via AnkiConnect. Create and update flashcards from video content.</p>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <CardCreatorSettingsPanel
                  settings={settings.cardCreator}
                  onChange={updateCardCreator}
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
                <h4 className={styles.cardTitle}>Dictionary Popup</h4>
                <p className={styles.cardDesc}>Hover or click words in subtitles to see definitions, audio, images, and Quick Add to Anki.</p>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <DictionaryPopupSettingsPanel
                  settings={settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS}
                  onChange={(dp) => onChange({ ...settings, dictionaryPopup: dp })}
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
                <h4 className={styles.cardTitle}>Local Player</h4>
                <p className={styles.cardDesc}>Configure the local video player: subtitle auto-match and resume prompt.</p>
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
                <h4 className={styles.cardTitle}>Theme</h4>
                <p className={styles.cardDesc}>Light/dark/system mode.</p>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <ThemePanel />
              </VStack>
            </Card>

            {/* === Card 10: TTS Voices === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.tts = el; }}
              className={styles.sectionCard}
              data-section="tts"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>TTS Voices</h4>
                <p className={styles.cardDesc}>Enable TTS, select voices, and configure autoplay count.</p>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <TtsVoiceManagerPanel
                  settings={settings.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS}
                  onSave={(tts) => onChange({ ...settings, dictionaryPopup: { ...(settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS), tts } })}
                />
              </VStack>
            </Card>

            {/* === Card 11: Resources === */}
            <Card
              ref={(el: HTMLDivElement) => { sectionRefs.current.resources = el; }}
              className={styles.sectionCard}
              data-section="resources"
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Resources</h4>
                <p className={styles.cardDesc}>Import and manage dictionaries and frequency lists.</p>
              </div>
              <VStack gap="0" className={styles.cardBody}>
                <ResourcesPanel langCode={settings.subtitleOverlayTargetLanguage || 'en'} />
              </VStack>
            </Card>

          </div>
        </div>
  );
}


