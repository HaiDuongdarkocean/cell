import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction } from '@/entities/media';
import type { Settings, CardCreatorSettings } from '@/entities/settings';
import { getActiveProfileSettings } from '@/entities/settings';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
} from '@/shared/config/config';
import { LanguageProfilePanel } from './LanguageProfilePanel';
// ADR-029: language dropdown lists now come from the single-source-of-truth
// registry. The hardcoded SUBTITLE_LANGUAGES + OVERLAY_LANGUAGE_OPTIONS arrays
// that used to live here (~200 lines) have been removed.
import {
  SUBTITLE_LANGUAGES,
  OVERLAY_LANGUAGE_OPTIONS,
} from '@/shared/config/languageRegistry';
import { MultiSelect } from './MultiSelect';
import { CardCreatorSettingsPanel } from './CardCreatorSettingsPanel';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';

import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { TtsVoiceManagerPanel, DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { Toggle } from '@/shared/ui/Toggle';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { Select } from '@/shared/ui/Select';
import { HintIcon } from '@/shared/ui/HintIcon';

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

const SHORTCUT_ACTION_ORDER: readonly ShortcutAction[] = [
  'prev-cue', 'next-cue', 'replay-cue', 'play-pause', 'toggle-overlay', 'toggle-panel', 'toggle-translate',
  'generate-native', 'toggle-player-mode', 'quick-update', 'edit-card',
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

  // Active section for sidebar highlight (YouTube/Google style pill active)
  const [activeSection, setActiveSection] = useState<string>('media');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainColRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Auto-scroll sidebar to keep active item visible when activeSection changes.
  // scrollSidebarToId takes a section ID and scrolls the sidebar to the
  // corresponding button. Called from IntersectionObserver callback and
  // handleSidebarClick — avoids depending on React re-render timing.
  const scrollSidebarToId = useCallback((sectionId: string) => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const item = sidebar.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
    if (!item) return;
    const itemTop = item.offsetTop - sidebar.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const viewTop = sidebar.scrollTop;
    const viewBottom = viewTop + sidebar.clientHeight;
    if (itemTop < viewTop) {
      sidebar.scrollTop = itemTop;
    } else if (itemBottom > viewBottom) {
      sidebar.scrollTop = itemBottom - sidebar.clientHeight;
    }
  }, []);

  // Also scroll on activeSection change (covers programmatic state changes).
  useLayoutEffect(() => {
    scrollSidebarToId(activeSection);
  }, [activeSection, scrollSidebarToId]);


  // IntersectionObserver: update active sidebar item on scroll
  // Guard for jsdom (test env) which lacks IntersectionObserver — sidebar still works via click
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const mainCol = mainColRef.current;
    if (!mainCol) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section');
            if (id) {
              setActiveSection(id);
              // Scroll sidebar immediately — don't wait for React re-render.
              scrollSidebarToId(id);
            }
          }
        });
      },
      // Use explicit px units for the zero margins — some Chromium builds
      // reject a bare `0` token in an IntersectionObserver rootMargin string.
      { root: mainCol, rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [scrollSidebarToId]);


  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  // schema v10: partial update cho Card Creator settings
  const updateCardCreator = (partial: Partial<CardCreatorSettings>): void => {
    const current = settings.cardCreator;
    onChange({ ...settings, cardCreator: { ...current, ...partial } });
  };

  const handleSidebarClick = (sectionId: string): void => {
    const target = sectionRefs.current[sectionId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
      scrollSidebarToId(sectionId);
    }
  };

  const sidebarItems: { id: string; label: string }[] = [
    { id: 'media', label: 'Media' },
    { id: 'block', label: 'Block' },
    { id: 'languageProfile', label: 'Language Profile' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'download', label: 'Download' },
    { id: 'cardCreator', label: 'Card Creator' },
    { id: 'dictionaryPopup', label: 'Dictionary Popup' },
    { id: 'localPlayer', label: 'Local Player' },
    { id: 'theme', label: 'Theme' },
    { id: 'tts', label: 'TTS Voices' },
    { id: 'resources', label: 'Resources' },
  ];

  return (
        <div className={[styles.popoverBody, className].filter(Boolean).join(' ')}>
          {/* === Sidebar (left, 120px) — YouTube/Google style pill active === */}
          <nav className={styles.sidebar} aria-label="Settings sections" ref={sidebarRef}>
            <div className={styles.sidebarLabel}>Sections</div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                data-section-id={item.id}
                className={`${styles.sidebarItem} ${activeSection === item.id ? styles.active : ''}`}
                onClick={() => handleSidebarClick(item.id)}
                aria-current={activeSection === item.id ? 'true' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* === Main column (cards, scrollable) === */}
          <div className={styles.mainCol} ref={mainColRef}>

            {/* === Card 1: Media Selection === */}
            <section
              ref={(el) => { sectionRefs.current.media = el; }}
              className={styles.section}
              data-section="media"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Media Selection</h4>
              </div>
              <p className={styles.sectionDescription}>Configure how media is automatically selected.</p>
              <div className={styles.sectionBody}>
                {/* Auto select media */}
                <div className={styles.field}>
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>
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
                  </div>
                </div>

                {/* Select subtitle - only shown when auto select is enabled — indented child (settings-dialog-rearrange) */}
                {settings.autoSelectEnabled && (
                  <div className={`${styles.field} ${styles.childField}`}>
                    <label className={styles.label} htmlFor="set-subtitle-lang"></label>
                    <MultiSelect
                      testId="subtitle-lang-multiselect"
                      options={SUBTITLE_LANGUAGES}
                      selectedValues={settings.selectedSubtitleLanguages}
                      onChange={(values) => update('selectedSubtitleLanguages', values)}
                      placeholder="Search languages..."
                    />
                  </div>
                )}
              </div>
            </section>

            {/* === Card 2: Subtitle Block === */}
            <section
              ref={(el) => { sectionRefs.current.block = el; }}
              className={styles.section}
              data-section="block"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Block</h4>
              </div>
              <p className={styles.sectionDescription}>Position, scale, and auto-load behavior for the unified subtitle block.</p>
              <div className={styles.sectionBody}>
                {/* Subtitle overlay auto-load */}
                <div className={styles.field}>
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>
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
                  </div>
                </div>

                {/* Auto-load YouTube ASR (auto-generated captions) — V6 */}
                <div className={styles.field}>
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>
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
                  </div>

                  {/* ADR-021: Auto-translate when native missing */}
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>
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
                  </div>
                </div>

                {/* Divider: behavior → languages (settings-dialog-rearrange) */}
                <div className={styles.divider} />

                {/* PAIR: Target + Native language (settings-dialog-rearrange) */}
                <div className={styles.pairRow}>
                  <SettingField label="Target language" htmlFor="set-overlay-lang">
                    <SearchableSelect
                      testId="overlay-target-language"
                      dataTestId="overlay-target-language"
                      value={settings.subtitleOverlayTargetLanguage}
                      options={OVERLAY_LANGUAGE_OPTIONS}
                      onChange={(val) => update('subtitleOverlayTargetLanguage', val)}
                      ariaLabel="Select Target language"
                      disabled={!settings.subtitleOverlayAutoLoad}
                    />
                  </SettingField>
                  <SettingField label="Native language" htmlFor="set-overlay-native-lang">
                    <SearchableSelect
                      testId="overlay-native-language"
                      dataTestId="overlay-native-language"
                      value={settings.subtitleOverlayNativeLanguage}
                      options={OVERLAY_LANGUAGE_OPTIONS}
                      onChange={(val) => update('subtitleOverlayNativeLanguage', val)}
                      ariaLabel="Select Native language"
                      disabled={!settings.subtitleOverlayAutoLoad}
                      menuAlign="right"
                    />
                  </SettingField>
                </div>

                {/* Divider: languages → block position */}
                <div className={styles.divider} />

                {/* ADR-025: Block position/scale/opacity moved to Subtitle Manager appearance view */}
              </div>
            </section>

            {/* === Card: Language Profile (schema v23) === */}
            <section
              ref={(el) => { sectionRefs.current.languageProfile = el; }}
              className={styles.section}
              data-section="languageProfile"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Language Profile</h4>
              </div>
              <p className={styles.sectionDescription}>Manage language pairs and per-profile dictionary resources.</p>
              <div className={styles.sectionBody}>
                <LanguageProfilePanel settings={settings} onChange={onChange} />
              </div>
            </section>

            {/* === Card 5: Keyboard Shortcuts === */}
            <section
              ref={(el) => { sectionRefs.current.shortcuts = el; }}
              className={styles.section}
              data-section="shortcuts"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Keyboard Shortcuts</h4>
              </div>
              <p className={styles.sectionDescription}>Remap keys for subtitle panel navigation actions.</p>
              <div className={styles.sectionBody}>
                {/* 2-column grid (settings-dialog-rearrange) — pair prev/next, replay/toggle-overlay */}
                <div className={styles.shortcutGrid}>
                  {SHORTCUT_ACTION_ORDER.map((action) => {
                    const shortcut = settings.keyboardShortcuts.find((s) => s.action === action);
                    const currentValue = shortcut
                      ? { key: shortcut.key, ctrl: shortcut.ctrl, shift: shortcut.shift, alt: shortcut.alt }
                      : { key: '' };
                    return (
                      <div key={action} className={styles.shortcutField}>
                        <label className={styles.label} htmlFor={`set-shortcut-${action}`}>{SHORTCUT_ACTION_LABELS[action]}</label>
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
                </div>
              </div>
            </section>

            {/* === Card 6: Download === */}
            <section
              ref={(el) => { sectionRefs.current.download = el; }}
              className={styles.section}
              data-section="download"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Download</h4>
              </div>
              <p className={styles.sectionDescription}>Download format, quality, concurrency, conversion, and filename options.</p>
              <div className={styles.sectionBody}>
                {/* === Group 1: Concurrency (settings-dialog-rearrange) === */}
                <SettingField label="Downloads at once" htmlFor="set-concurrent">
                  <Select
                    data-cell-id="concurrent-select"
                    value={String(settings.concurrentDownloads)}
                    options={[1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
                    onChange={(val) => update('concurrentDownloads', Number(val))}
                  />
                </SettingField>

                <div className={styles.divider} />

                {/* === Group 2: Format + Quality (pair) === */}
                <div className={styles.pairRow}>
                  <SettingField label="Preferred format" htmlFor="set-format">
                    <Select
                      data-cell-id="format-select"
                      value={settings.preferredVideoFormat}
                      options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: PREFERRED_FORMAT_LABELS[f] }))}
                      onChange={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
                    />
                  </SettingField>
                  <SettingField label="Default quality" htmlFor="set-quality">
                    <Select
                      data-cell-id="quality-select"
                      value={settings.defaultQuality}
                      options={QUALITY_OPTIONS.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
                      onChange={(val) => update('defaultQuality', val as VideoQuality)}
                    />
                  </SettingField>
                </div>

                <div className={styles.divider} />

                {/* === Group 3: Conversion === */}
                <SettingField label="Convert to MP4" htmlFor="set-convert">
                  <Select
                    data-cell-id="convert-select"
                    value={settings.convertToMp4}
                    options={CONVERT_OPTIONS.map((m) => ({ value: m, label: CONVERT_LABELS[m] }))}
                    onChange={(val) => update('convertToMp4', val as ConvertToMp4Mode)}
                  />
                </SettingField>

                {/* Parallel conversion — hint icon moved into label (settings-dialog-rearrange) */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="set-parallel">
                    Parallel conversion
                    <HintIcon
                      hint={`Parallel conversion: ${settings.parallelConversion} (số lượng tùy vào GPU của máy tính hiện có)`}
                      ariaLabel="Show hint for Parallel conversion"
                    />
                  </label>
                  <Select
                    data-cell-id="parallel-select"
                    value={settings.parallelConversion}
                    options={PARALLEL_OPTIONS.map((m) => ({ value: m, label: PARALLEL_LABELS[m] }))}
                    onChange={(val) => update('parallelConversion', val as ParallelConversionMode)}
                  />
                </div>

                {/* Workers (only when manual) — indented child under Parallel conversion */}
                {settings.parallelConversion === 'manual' && (
                  <div className={`${styles.field} ${styles.childField}`}>
                    <label className={styles.label} htmlFor="set-workers">Workers</label>
                    <Select
                      data-cell-id="workers-select"
                      value={String(settings.manualWorkerCount)}
                      options={WORKER_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                      onChange={(val) => update('manualWorkerCount', Math.max(MIN_PARALLEL_WORKERS, Math.min(MAX_PARALLEL_WORKERS, Number(val))))}
                    />
                  </div>
                )}

                <div className={styles.divider} />

                {/* === Group 4: Filename === */}
                <SettingField label="Filename source" htmlFor="set-filename-source">
                  <Select
                    data-cell-id="filename-source-select"
                    value={settings.filenameSource}
                    options={FILENAME_SOURCE_OPTIONS.map((m) => ({ value: m, label: FILENAME_SOURCE_LABELS[m] }))}
                    onChange={(val) => update('filenameSource', val as FilenameSource)}
                  />
                </SettingField>
              </div>
            </section>

            {/* === Card: Card Creator (Connection only, schema v10) === */}
            <section
              ref={(el) => { sectionRefs.current.cardCreator = el; }}
              className={styles.section}
              data-section="cardCreator"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Card Creator</h4>
              </div>
              <p className={styles.sectionDescription}>
                Connect to Anki via AnkiConnect. Create and update flashcards from video content.
              </p>
              <div className={styles.sectionBody}>
                <CardCreatorSettingsPanel
                  settings={settings.cardCreator}
                  onChange={updateCardCreator}
                />
              </div>
            </section>

            {/* Dictionary Popup — schema v14 */}
            <section
              ref={(el) => { sectionRefs.current.dictionaryPopup = el; }}
              className={styles.section}
              data-section="dictionaryPopup"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Dictionary Popup</h4>
              </div>
              <p className={styles.sectionDescription}>
                Hover or click words in subtitles to see definitions, audio, images, and Quick Add to Anki.
              </p>
              <div className={styles.sectionBody}>
                <DictionaryPopupSettingsPanel
                  settings={settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS}
                  onChange={(dp) => onChange({ ...settings, dictionaryPopup: dp })}
                />
              </div>
            </section>

            {/* === Local Player (spec local-video-player.md — schema v22) === */}
            <section
              ref={(el) => { sectionRefs.current.localPlayer = el; }}
              className={styles.section}
              data-section="localPlayer"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Local Player</h4>
              </div>
              <p className={styles.sectionDescription}>Configure the local video player: subtitle auto-match and resume prompt.</p>
              <div className={styles.sectionBody}>
                {/* Subtitle auto-match toggle */}
                <div className={styles.field}>
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>
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
                  </div>
                </div>

                {/* Resume prompt toggle */}
                <div className={styles.field}>
                  <div className={styles.asRow}>
                    <span className={styles.asLabel}>
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
                  </div>
                </div>
              </div>
            </section>

            {/* === Theme (migrated from options page) === */}
            <section
              ref={(el) => { sectionRefs.current.theme = el; }}
              className={styles.section}
              data-section="theme"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Theme</h4>
              </div>
              <p className={styles.sectionDescription}>Light/dark/system mode, color customization, backup, and reset.</p>
              <div className={styles.sectionBody}>
                <ThemePanel />
              </div>
            </section>

            {/* === TTS Voices (migrated from options page) === */}
            <section
              ref={(el) => { sectionRefs.current.tts = el; }}
              className={styles.section}
              data-section="tts"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>TTS Voices</h4>
              </div>
              <p className={styles.sectionDescription}>Enable TTS, select voices, and configure autoplay count.</p>
              <div className={styles.sectionBody}>
                <TtsVoiceManagerPanel
                  settings={settings.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS}
                  onSave={(tts) => onChange({ ...settings, dictionaryPopup: { ...(settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS), tts } })}
                />
              </div>
            </section>

            {/* === Resources (migrated from options page) === */}
            <section
              ref={(el) => { sectionRefs.current.resources = el; }}
              className={styles.section}
              data-section="resources"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Resources</h4>
              </div>
              <p className={styles.sectionDescription}>Import and manage dictionaries and frequency lists.</p>
              <div className={styles.sectionBody}>
                <ResourcesPanel
                  langCode={settings.subtitleOverlayTargetLanguage || 'en'}
                  resourceIds={getActiveProfileSettings(settings)?.resourceIds}
                />
              </div>
            </section>

          </div>
        </div>
  );
}

function SettingField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}


