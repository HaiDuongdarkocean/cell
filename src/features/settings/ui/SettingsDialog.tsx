import { useEffect, useRef, useState } from 'react';
import type { Settings, VideoQuality, ConvertToMp4Mode, ParallelConversionMode, FilenameSource, ShortcutAction, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { CardCreatorSettings } from '@/entities/settings';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  MAX_CONVERT_BYTES,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
} from '@/shared/config/config';
// ADR-029: language dropdown lists now come from the single-source-of-truth
// registry. The hardcoded SUBTITLE_LANGUAGES + OVERLAY_LANGUAGE_OPTIONS arrays
// that used to live here (~200 lines) have been removed.
import {
  SUBTITLE_LANGUAGES,
  OVERLAY_LANGUAGE_OPTIONS,
} from '@/shared/config/languageRegistry';
import { MultiSelect } from './MultiSelect';
import { SubtitleStylePanel } from './SubtitleStylePanel';
import { SubtitleBlockSettingsPanel } from './SubtitleBlockSettingsPanel';
import { NavClusterSettingsPanel } from './NavClusterSettingsPanel';
import { CardCreatorSettingsPanel } from './CardCreatorSettingsPanel';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';
import { TokenizeSettingsPanel, type TokenizePanelState } from './TokenizeSettingsPanel';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { TtsVoiceManagerPanel, DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Toggle } from '@/shared/ui/Toggle';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { Select } from '@/shared/ui/Select';
import { HintIcon } from '@/shared/ui/HintIcon';

import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  /** ADR-061: Tokenize section — only provided when mounted in the orbital
   *  badge panel (content-script). Popup/sidepanel/options don't have
   *  tokenize runtime state, so these stay undefined there. */
  readonly tokenizeState?: TokenizePanelState;
  readonly onToggleTokenize?: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
  readonly onOpenDictionary?: () => void;
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
  'toggle-overlay': 'Toggle overlay',
  'toggle-panel': 'Toggle panel',
  'toggle-translate': 'Toggle auto-translate',
  'generate-native': 'Generate native subtitle',
  'quick-update': 'Card Creator: Quick update',
  'edit-card': 'Card Creator: Edit card',
};

const SHORTCUT_ACTION_ORDER: readonly ShortcutAction[] = [
  'prev-cue', 'next-cue', 'replay-cue', 'toggle-overlay', 'toggle-panel', 'toggle-translate',
  'generate-native', 'quick-update', 'edit-card',
];

/**
 * Language dropdown lists (ADR-029): derived from the single-source-of-truth
 * languageRegistry.ts. The hardcoded arrays that used to live here (~200 lines)
 * have been removed. SUBTITLE_LANGUAGES includes "all"; OVERLAY_LANGUAGE_OPTIONS
 * includes "None" + BCP 47 variants (zh-hans, zh-hant).
 */
export function SettingsDialog({ isOpen, settings, onChange, onClose, tokenizeState, onToggleTokenize, onOpenDictionary }: SettingsDialogProps): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // ADR-013: tab state for Target/Native style panel (kept here so tab switch
  // preserves state — panel unmounts/remounts would lose unsaved slider drag)

  // Active section for sidebar highlight (YouTube/Google style pill active)
  const [activeSection, setActiveSection] = useState<string>('media');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainColRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll sidebar to keep active item visible when activeSection changes
  // (from IntersectionObserver on scroll or from sidebar click).
  useEffect(() => {
    const item = activeItemRef.current;
    if (!item) return;
    item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeSection]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // IntersectionObserver: update active sidebar item on scroll
  // Guard for jsdom (test env) which lacks IntersectionObserver — sidebar still works via click
  useEffect(() => {
    if (!isOpen) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const mainCol = mainColRef.current;
    if (!mainCol) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section');
            if (id) setActiveSection(id);
          }
        });
      },
      { root: mainCol, rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isOpen]);

  if (!isOpen) return <div />;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  // ADR-025: partial update cho subtitle block settings
  const updateBlock = (partial: Partial<SubtitleBlockSettings>): void => {
    const current = settings.subtitleBlockSettings ?? DEFAULT_SUBTITLE_BLOCK_SETTINGS;
    onChange({ ...settings, subtitleBlockSettings: { ...current, ...partial } });
  };

  // ADR-018, ADR-025: partial update cho nav cluster settings (flat keys)
  const updateNavCluster = (partial: Partial<NavClusterSettings>): void => {
    const flat: Record<string, unknown> = {};
    if (partial.enabled !== undefined) flat.navClusterEnabled = partial.enabled;
    if (partial.buttonSize !== undefined) flat.navClusterButtonSize = partial.buttonSize;
    if (partial.textOpacity !== undefined) flat.navClusterTextOpacity = partial.textOpacity;
    if (partial.bgOpacity !== undefined) flat.navClusterButtonBgOpacity = partial.bgOpacity;
    onChange({ ...settings, ...flat } as Settings);
  };

  // schema v10: partial update cho Card Creator settings
  const updateCardCreator = (partial: Partial<CardCreatorSettings>): void => {
    const current = settings.cardCreator;
    onChange({ ...settings, cardCreator: { ...current, ...partial } });
  };

  // ADR-013, ADR-025: partial update cho overlay style (target or native)
  const updateOverlayStyle = (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void => {
    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    const defaultStyle = role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE;
    const current = settings[key] ?? defaultStyle;
    onChange({ ...settings, [key]: { ...defaultStyle, ...current, ...partial } });
  };

  const resetOverlayStyle = (role: 'target' | 'native'): void => {
    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    const defaults = role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE;
    onChange({ ...settings, [key]: defaults });
  };

  const handleSidebarClick = (sectionId: string): void => {
    const target = sectionRefs.current[sectionId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  const sidebarItems: { id: string; label: string }[] = [
    ...(tokenizeState ? [{ id: 'tokenize', label: 'Tokenize' }] : []),
    { id: 'media', label: 'Media' },
    { id: 'block', label: 'Block' },
    { id: 'target', label: 'Target' },
    { id: 'native', label: 'Native' },
    { id: 'cluster', label: 'Cluster' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'download', label: 'Download' },
    { id: 'cardCreator', label: 'Card Creator' },
    { id: 'dictionaryPopup', label: 'Dictionary Popup' },
    { id: 'theme', label: 'Theme' },
    { id: 'tts', label: 'TTS Voices' },
    { id: 'resources', label: 'Resources' },
  ];

  return (
    <>
      {/* Overlay */}
      <div className={`${styles.overlay} ${styles.open}`} onClick={onClose} />

      {/* Popover — 480px, sidebar + cards (YouTube/M3 style) */}
      <div
        className={`${styles.popover} ${styles.open}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={styles.popoverHeader}>
          <h3 id="settings-title" className={styles.popoverTitle}>Settings</h3>
          <IconButton
            ref={closeButtonRef}
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
          >
            <Icon name="x" className={styles.icon} />
          </IconButton>
        </div>

        <div className={styles.popoverBody}>
          {/* === Sidebar (left, 120px) — YouTube/Google style pill active === */}
          <nav className={styles.sidebar} aria-label="Settings sections" ref={sidebarRef}>
            <div className={styles.sidebarLabel}>Sections</div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                ref={activeSection === item.id ? activeItemRef : undefined}
                type="button"
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

            {/* === Card 0: Tokenize (ADR-061 — orbital panel only) === */}
          {tokenizeState && (
            <section
              ref={(el) => { sectionRefs.current.tokenize = el; }}
              className={styles.section}
              data-section="tokenize"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Tokenize</h4>
                <Toggle
                  checked={tokenizeState.enabled}
                  onChange={() => onToggleTokenize?.('enabled')}
                  ariaLabel="Toggle tokenize page"
                  title={`Tokenize page: ${tokenizeState.enabled ? 'ON' : 'OFF'}`}
                />
              </div>
              <p className={styles.sectionDescription}>Tokenize the current page for vocabulary lookup.</p>
              <div className={styles.sectionBody}>
                <TokenizeSettingsPanel
                  state={tokenizeState}
                  onToggle={(key) => onToggleTokenize?.(key)}
                  onOpenDictionary={onOpenDictionary}
                />
              </div>
            </section>
          )}

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

                <SubtitleBlockSettingsPanel
                  settings={settings.subtitleBlockSettings ?? DEFAULT_SUBTITLE_BLOCK_SETTINGS}
                  onChange={updateBlock}
                />
              </div>
            </section>

            {/* === Card 3: Target === */}
            <section
              ref={(el) => { sectionRefs.current.target = el; }}
              className={styles.section}
              data-section="target"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Target</h4>
                <Toggle
                  checked={(settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET).visible}
                  onChange={(next) => updateOverlayStyle('target', { visible: next })}
                  ariaLabel="Toggle target subtitle visibility"
                  title={`Target visible: ${(settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET).visible ? 'ON' : 'OFF'}`}
                />
              </div>
              <p className={styles.sectionDescription}>Appearance for the target subtitle layer.</p>
              <div className={styles.sectionBody}>
                <SubtitleStylePanel
                  role="target"
                  style={settings.subtitleOverlayTargetStyle ?? DEFAULT_OVERLAY_STYLE_TARGET}
                  onChange={(partial) => updateOverlayStyle('target', partial)}
                  onReset={() => resetOverlayStyle('target')}
                  defaultStyle={DEFAULT_OVERLAY_STYLE_TARGET}
                />
              </div>
            </section>

            {/* === Card 4: Native === */}
            <section
              ref={(el) => { sectionRefs.current.native = el; }}
              className={styles.section}
              data-section="native"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Native</h4>
                <Toggle
                  checked={(settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE).visible}
                  onChange={(next) => updateOverlayStyle('native', { visible: next })}
                  ariaLabel="Toggle native subtitle visibility"
                  title={`Native visible: ${(settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE).visible ? 'ON' : 'OFF'}`}
                />
              </div>
              <p className={styles.sectionDescription}>Appearance for the native subtitle layer.</p>
              <div className={styles.sectionBody}>
                <SubtitleStylePanel
                  role="native"
                  style={settings.subtitleOverlayNativeStyle ?? DEFAULT_OVERLAY_STYLE_NATIVE}
                  onChange={(partial) => updateOverlayStyle('native', partial)}
                  onReset={() => resetOverlayStyle('native')}
                  defaultStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
                />
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
                          data-testid={`shortcut-${action}`}
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

            {/* === Card 6: Cluster === */}
            <section
              ref={(el) => { sectionRefs.current.cluster = el; }}
              className={styles.section}
              data-section="cluster"
            >
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Cluster</h4>
                <Toggle
                  checked={settings.navClusterEnabled}
                  onChange={(next) => updateNavCluster({ enabled: next })}
                  ariaLabel="Toggle navigation cluster"
                  title={`Navigation cluster: ${settings.navClusterEnabled ? 'ON' : 'OFF'}`}
                />
              </div>
              <p className={styles.sectionDescription}>Navigation buttons inside the subtitle block.</p>
              <div className={styles.sectionBody}>
                <NavClusterSettingsPanel
                  settings={{
                    enabled: settings.navClusterEnabled,
                    buttonSize: settings.navClusterButtonSize,
                    textOpacity: settings.navClusterTextOpacity,
                    bgOpacity: settings.navClusterButtonBgOpacity,
                  }}
                  onChange={updateNavCluster}
                />
              </div>
            </section>

            {/* === Card 7: Download === */}
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
                    data-testid="concurrent-select"
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
                      data-testid="format-select"
                      value={settings.preferredVideoFormat}
                      options={PREFERRED_FORMAT_OPTIONS.map((f) => ({ value: f, label: PREFERRED_FORMAT_LABELS[f] }))}
                      onChange={(val) => update('preferredVideoFormat', val as 'mp4' | 'm3u8')}
                    />
                  </SettingField>
                  <SettingField label="Default quality" htmlFor="set-quality">
                    <Select
                      data-testid="quality-select"
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
                    data-testid="convert-select"
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
                    data-testid="parallel-select"
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
                      data-testid="workers-select"
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
                    data-testid="filename-source-select"
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
                <ResourcesPanel langCode={settings.subtitleOverlayTargetLanguage || 'en'} />
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}

/* === Setting field wrapper === */
function SettingField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}


