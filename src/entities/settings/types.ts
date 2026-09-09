import type { VideoQuality } from '@/entities/video/types';
import type { OverlayStyleConfig } from '@/entities/subtitle/types';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';

// === Keyboard Shortcut Types (floating panel) ===

/** Actions mappable to keyboard shortcuts in the subtitle panel. */
export type ShortcutAction =
  | 'prev-cue'
  | 'next-cue'
  | 'replay-cue'
  | 'toggle-overlay'
  | 'toggle-panel'
  | 'toggle-translate'
  | 'generate-native'
  | 'toggle-player-mode'
  | 'quick-update'
  | 'edit-card'
  | 'play-pause';

/** A single keyboard shortcut binding: action ↔ key (with optional modifiers for combos). */
export interface KeyboardShortcut {
  readonly action: ShortcutAction;
  /** Lowercase single key, e.g. 'a', 'arrowleft'. For combo: the final key. */
  readonly key: string;
  /** Ctrl modifier (combo support, ADR-021 D7). Default false (backward compat). */
  readonly ctrl?: boolean;
  /** Shift modifier (combo support, ADR-021 D7). Default false (backward compat). */
  readonly shift?: boolean;
  /** Alt modifier (combo support, ADR-021 D7). Default false (backward compat). */
  readonly alt?: boolean;
}

// === Nav Cluster Types (ADR-018) ===

/** Nav cluster button size in px (free range 10-100, ADR-018 D2-rev). */
export type NavClusterButtonSize = number;

/** Settings slice for nav cluster (flat keys in Settings, ADR-018 D2, ADR-025). */
export interface NavClusterSettings {
  readonly enabled: boolean;
  readonly buttonSize: NavClusterButtonSize;
  readonly textOpacity: number; // 0-1, icon/text clarity inside buttons
  readonly bgOpacity: number; // 0-1, button background opacity (0=transparent, 1=solid)
}

/** Unified subtitle block settings (ADR-025). */
export interface SubtitleBlockSettings {
  readonly yOffsetPercent: number; // 0-95, top edge of block
  readonly globalScale: number; // 0.5-2
  readonly bgOpacity: number; // 0-1
}

// === Card Creator (Anki integration) — schema v10 ===

/** How media fields are merged when updating an existing note. */
export type MediaUpdateMode = 'overwrite' | 'append' | 'skip';

/** Source field keys (Cell side). Tags are NOT a mapped field — they're sent
 *  via the note's `tags` array, not mapped to an Anki note field. */
export type SourceFieldKey =
  | 'targetWord'
  | 'sentence'
  | 'sentenceTranslation'
  | 'definitions'
  | 'images'
  | 'sentenceAudios'
  | 'wordAudios'
  | 'note'
  | 'moreExample';

/** Mapping from source key → Anki field name (or "" if unmapped). */
export type FieldMapping = Partial<Record<SourceFieldKey, string>>;

/** Settings slice for Card Creator (AnkiConnect integration). */
export interface CardCreatorSettings {
  /** AnkiConnect base URL. Default `http://localhost:8765`. Mobile may use LAN IP. */
  readonly ankiConnectUrl: string;
  /** Last-used deck name (preselected in dialog). Default 'Default'. */
  readonly defaultDeck: string;
  /** Last-used note type (preselected in dialog). Default 'Cell Video Card'. */
  readonly defaultNoteType: string;
  /** Default tags string (space-separated, Anki convention). Default '' (empty — user enters tags manually). */
  readonly defaultTags: string;
  /** How media fields merge when updating an existing note. Default 'overwrite'. */
  readonly mediaUpdateMode: MediaUpdateMode;
  /** Per-field auto-complete toggle (spec §9.3.1, D7). Default all true. */
  readonly autoCompleteToggles?: Record<AutoCompletableField, boolean>;
  /** Audio fallback when community = 0/fail (spec §9.3.1). Default 'community-then-tts'. */
  readonly audioFallback?: AudioFallbackStrategy;
  /** Saved field mappings keyed by note type name (schema v29 — spec
   *  anki-config-in-settings). Edited in Settings → Card Creator; the Card
   *  Creator form reads these instead of showing per-field map selects. */
  readonly fieldMappings?: Record<string, FieldMapping>;
}

/** Field có thể auto-complete trong Quick Add (spec §9.3.1 — trục content, khác field-map routing). */
export type AutoCompletableField =
  | 'definitions'
  | 'wordAudios'
  | 'sentenceAudios'
  | 'images'
  | 'sentenceTranslation'
  | 'sentence';

/** Audio fallback strategy khi community audio = 0 hoặc fetch fail (spec §9.3.1). */
export type AudioFallbackStrategy = 'community-then-tts' | 'community-only' | 'tts-only';

/** External dictionary link template (spec §9.3). */
export interface ExternalDictLinkTemplate {
  readonly id: string;
  readonly name: string;
  /** Placeholders {term} {lang}; fill bằng encodeURIComponent(term). */
  readonly urlTemplate: string;
  /** Languages this link applies to (empty = all). */
  readonly langCodes: readonly string[];
}

/** Orbital badge pointer trigger settings (spec badge-pointer-dictionary-trigger). */
export interface BadgePointerTriggerSettings {
  /** Pointer position preset relative to the badge. */
  readonly position: 'top' | 'left' | 'right' | 'bottom' | 'center';
  /** Badge diameter in px (configurable for one-handed use). Default 36. */
  readonly size: number;
  /** Pointer diameter as a ratio of the badge size. Default 0.25. */
  readonly pointerScale: number;
}

/** A saved TTS voice row — user chọn + sắp xếp trong options page. */
export interface TtsVoiceRow {
  readonly voiceName: string;
  readonly lang: string;
  /** Sort order (1-based). Lower = higher priority. */
  readonly order: number;
}

/** Available audio sources for pronunciation, ordered by fallback priority. */
export type AudioEngineKind =
  | 'localFile'
  | 'native'
  | 'supertonic'
  | 'browserTts'
  | 'espeak';

/** Local audio package layout. */
export type LocalPackageType = 'single' | 'split';

/** Settings for the local-file pronunciation audio provider. */
export interface LocalFileAudioSettings {
  /** Package layout. 'single' = one .dsl.files.zip; 'split' = many zips by pattern. */
  readonly packageType: LocalPackageType;
  /** Persisted file-handle id for the .dsl index. */
  readonly dslFileHandleId: string | null;
  /** Persisted file-handle id for the single .dsl.files.zip (packageType 'single'). */
  readonly audioArchiveHandleId: string | null;
  /** Persisted directory-handle id for split archives (packageType 'split'). */
  readonly splitArchiveDirectoryHandleId: string | null;
  /** Filename pattern for split archives, e.g. 'ForvoEnglish_{firstLetter}.zip'. */
  readonly splitArchivePattern: string;
  /** Last time the .dsl index was (re)built. */
  readonly lastIndexedAt: number | null;
}

/** Pronunciation engine settings slice (spec ocean-pronunciation-engine). */
export interface PronunciationSettings {
  /** Ordered fallback chain for word/sentence audio. */
  readonly fallbackEngines: readonly AudioEngineKind[];
  /** Whether to download eSpeak TTS voice data on demand. */
  readonly downloadEspeakTtsData: boolean;
  /** Local Forvo/Lingvo DSL audio package settings. */
  readonly localFile: LocalFileAudioSettings;
}

/** TTS settings slice (spec popup-dictionary-4tab-logic). */
export interface TtsSettings {
  /** Master toggle. Default true. */
  readonly enabled: boolean;
  /** User-selected + ordered voices. Empty → auto-detect at runtime. */
  readonly savedVoices: readonly TtsVoiceRow[];
  /** 3 priority slots (voiceName). Legacy compat with project-reference. */
  readonly voices: readonly string[];
  /** Max voices display in popup. Default 3. */
  readonly maxDisplay: number;
  /** Auto-play count on popup open. Default 0. */
  readonly autoplayCount: number;
  /** Preferred accent for Forvo scoring: 'US' | 'UK'. Default 'US'. */
  readonly preferredAccent: 'US' | 'UK';
  /** Enable local Supertonic v3 TTS. Default false. */
  readonly localTtsEnabled: boolean;
  /** Selected local TTS language (ISO 639-1). Default 'en'. */
  readonly localTtsLanguage: string;
  /** Languages whose voice packs are downloaded. */
  readonly downloadedLanguages: readonly string[];
  /** Downloaded languages hidden from the popup language list. */
  readonly hiddenLanguages: readonly string[];
}

/** SRS destination for dictionary popup / universal panel add actions. */
export type SrsDestination = 'anki' | 'ocean-srs';

/** Ocean SRS data lifecycle / quota settings. */
export interface SrsDataLifecycleConfig {
  readonly reviewEventMaxAgeDays: number;
  readonly reviewEventMaxCount: number;
  readonly audioQuotaMb: number;
  readonly imageQuotaMb: number;
}

/** Ocean SRS settings slice (schema v27). */
export interface SrsSettingsSlice {
  readonly defaultStudyConfigId: string | null;
  readonly activeCollectionId: string | null;
  readonly activeDeckId: string | null;
  readonly activeNotetypeId: string | null;
  readonly activeLanguageProfileId: string | null;
  readonly dataLifecycle: SrsDataLifecycleConfig;
}

/** Dictionary Popup settings slice (spec §9.3 — schema v14). */
export interface DictionaryPopupSettings {
  /** Feature flag. Default false. */
  readonly enabled: boolean;
  /** Trigger mode. Default 'click'. 'orbital' was removed — the orbital badge
   *  is now always mounted when the dictionary popup is enabled. */
  readonly triggerMode: 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt';
  /** Default active tab (null = chỉ dictionary). Default null. */
  readonly defaultActiveTab: 'audio' | 'image' | 'translate' | 'links' | 'pronunciation' | null;
  /** Per-language override for default active tab. */
  readonly defaultActiveTabPerLang?: Record<string, 'audio' | 'image' | 'translate' | 'links' | 'pronunciation' | null>;
  /** SRS destination. Default 'anki'. */
  readonly srsDestination: SrsDestination;
  /** Popup width in px (popover mode). Default 560. */
  readonly popupWidthPx: number;
  /** Popup max height in px (popover mode). Default 480. */
  readonly popupMaxHeightPx: number;
  /** Sheet height in vh (bottom sheet mode). Default 72. */
  readonly popupSheetHeightVh: number;
  /** External dictionary link templates. */
  readonly externalDictLinks: readonly ExternalDictLinkTemplate[];
  /** TTS voice settings (audio tab + options page manager). */
  readonly tts?: TtsSettings;
  /** Orbital badge pointer trigger (spec badge-pointer-dictionary-trigger). */
  readonly badgePointerTrigger: BadgePointerTriggerSettings;
}

/** Local Player settings slice (spec local-video-player.md — schema v22). */
export interface LocalPlayerSettings {
  /** Auto-match subtitle files to video by filename similarity. Default true. */
  readonly subtitleMatchEnabled: boolean;
  /** Prompt to resume from last watched position on reopen. Default true. */
  readonly resumePromptEnabled: boolean;
  /** Last opened directory id (FileSystemDirectoryHandle persist key). Default null. */
  readonly lastDirectoryId: string | null;
}

// === Language Profile (schema v23) ===

/** A single language learning profile. */
export interface LanguageProfile {
  /** Stable unique id. */
  readonly id: string;
  /** Target language code (ISO 639-1 or BCP-47 variant). */
  readonly target: string;
  /** Native override; empty string means inherit from `universalNativeLanguage`. */
  readonly native: string;
  /** Auto-generated display name, e.g. "Tiếng Việt → English". */
  readonly name: string;
  /** 1-based display order, recomputed after drag/drop. */
  readonly order: number;
  readonly subtitleOverlayTargetStyle: OverlayStyleConfig;
  readonly subtitleOverlayNativeStyle: OverlayStyleConfig;
  readonly subtitleOverlayAutoLoad: boolean;
  readonly subtitleOverlayAutoLoadAsr: boolean;
  readonly subtitleOverlayAutoTranslate: boolean;
  readonly dictionaryPopup: DictionaryPopupSettings;
  /** Active dictionary/frequency resource ids for this profile's target language. */
  readonly resourceIds: number[];
}

/** Active profile with inheritance resolved. */
export interface ResolvedProfile extends Omit<LanguageProfile, 'native'> {
  /** Resolved native (profile override or universal). */
  readonly native: string;
  /** ISO 639-1 base of `target`; used for dictionary/frequency resource lookup. */
  readonly resourceLangCode: string;
}

// === Settings Types ===

/** Conversion behavior for M3U8 downloads. */
export type ConvertToMp4Mode = 'always' | 'small-only' | 'never';

/**
 * Parallel conversion scaling mode for TS→MP4 transmuxing.
 *
 * - `'auto'`   — runtime decides worker count based on file size, CPU cores,
 *                 and safety analysis. Default.
 * - `'manual'` — user specifies a worker count; runtime still clamps to safe
 *                 bounds and may fallback to sequential if input is ineligible.
 * - `'off'`    — always use the current sequential transmuxer.
 */
export type ParallelConversionMode = 'auto' | 'manual' | 'off';

/**
 * Fallback strategy when parallel conversion fails.
 *
 * - `'sequential'` — retry the entire conversion sequentially.
 * - `'save-ts'`    — skip conversion, save the `.ts` file directly.
 */
export type ParallelFallbackMode = 'sequential' | 'retry-reduced' | 'save-ts' | 'fail';

/**
 * Source for naming downloaded files (video + subtitle).
 *
 * - `'title-fallback'` — Use the detected media title; if it is empty or
 *   generic ("video", "untitled", etc.), fall back to a beautified base
 *   name extracted from the URL. Default.
 * - `'title-only'`     — Always use the detected title; if empty/generic,
 *   use "untitled" as the base name.
 * - `'url-only'`       — Always use a beautified base name extracted from
 *   the URL path, ignoring the detected title entirely.
 */
export type FilenameSource = 'title-fallback' | 'title-only' | 'url-only';

/** UI copy language. `'auto'` follows the browser UI language. */
export type UiLanguagePreference = 'auto' | 'en' | 'vi';

export interface Settings {
  /** Schema version for migration (ADR-017 D8). Current: 1. */
  readonly schemaVersion?: number;
  /**
   * Interface-language override — the language of the app's own UI copy.
   * Distinct from `universalNativeLanguage` (the learner's language used for
   * content). `'auto'` = follow `chrome.i18n.getUILanguage()`. Default: 'auto'.
   */
  readonly uiLanguage: UiLanguagePreference;
  /** Global native language. Used when a profile's `native === ''`. Default: 'vi'. */
  readonly universalNativeLanguage: string;
  /** All language profiles, sorted by `order`. */
  readonly languageProfiles: LanguageProfile[];
  /** `id` of the currently active profile, or `null` if none selected. */
  readonly activeProfileId: string | null;
  readonly concurrentDownloads: number;
  readonly defaultQuality: VideoQuality;
  /** @deprecated Use `selectedSubtitleLanguages` instead. Migrated on load. */
  readonly defaultSubtitleLanguage?: string;
  /** Multi-select subtitle languages (ISO 639-1 codes). `['all']` = any. */
  readonly selectedSubtitleLanguages: string[];
  /** When to attempt TS→MP4 conversion during M3U8 downloads. */
  readonly convertToMp4: ConvertToMp4Mode;
  /**
   * Parallel conversion scaling mode. Controls whether the offscreen
   * document attempts parallel segment-group transmuxing or uses the
   * sequential path. Default: `'auto'` (but auto only does dry-run
   * planning until experimental parallel is proven safe).
   */
  readonly parallelConversion: ParallelConversionMode;
  /**
   * User-requested worker count for manual mode. Clamped at runtime to
   * `[MIN_PARALLEL_WORKERS, MAX_PARALLEL_WORKERS]`. Default: 4.
   */
  readonly manualWorkerCount: number;
  /**
   * Fallback strategy when parallel conversion fails after partial work.
   * Default: `'save-ts'` for large files to avoid wasting time.
   */
  readonly parallelFallback: ParallelFallbackMode;
  /**
   * Number of M3U8 segments to fetch in parallel during a single download.
   * Higher values utilize network bandwidth better but risk server
   * throttling (403/429). Clamped to `[MIN_SEGMENT_CONCURRENCY,
   * MAX_SEGMENT_CONCURRENCY]`. Default: 6.
   */
  readonly segmentConcurrency: number;
  /**
   * Source for naming downloaded files. Default: `'title-fallback'`.
   */
  readonly filenameSource: FilenameSource;
  /** Preferred video format for auto-select. Fallback to other format if unavailable. */
  readonly preferredVideoFormat: 'mp4' | 'm3u8';
  /** When true, popup auto-selects media matching preferences on open. */
  readonly autoSelectEnabled: boolean;
  /** Target language for subtitle overlay (ISO 639-1 code, e.g. 'en'). Default 'en' (V4). */
  readonly subtitleOverlayTargetLanguage: string;
  /** Native language for bilingual subtitle overlay (ISO 639-1 code, e.g. 'vi'). Default 'vi' (V4). */
  readonly subtitleOverlayNativeLanguage: string;
  /** When true, subtitle overlay auto-loads from extension-detected subtitles matching target language. Default true (V4). */
  readonly subtitleOverlayAutoLoad: boolean;
  /**
   * When true, YouTube auto-generated captions (ASR, kind="asr") are eligible
   * for auto-load. When false, ASR tracks are filtered out — only manual
   * captions auto-load. Default false (V6) — anh yêu muốn tắt ASR mặc định,
   * bật thủ công khi cần. Applies to both target + native sides.
   */
  readonly subtitleOverlayAutoLoadAsr: boolean;
  /**
   * When true, if site has no native subtitle track → auto-translate target→native
   * via Google Translate unofficial endpoint (ADR-021). Background sequential prefill,
   * 0 setting params (chunk size, gap, budget hardcode). Default true (auto-dịch khi
   * native thiếu — kim chỉ nam "user vào và học thôi"). Cache per-session in-memory,
   * clear on SPA nav.
   */
  readonly subtitleOverlayAutoTranslate: boolean;
  /** Per-layer appearance config for target subtitle overlay (ADR-013, ADR-025). Independent from native. */
  readonly subtitleOverlayTargetStyle?: OverlayStyleConfig;
  /** Per-layer appearance config for native subtitle overlay (ADR-013, ADR-025). Independent from target. */
  readonly subtitleOverlayNativeStyle?: OverlayStyleConfig;
  /** User-editable preview text for target line in OverlayPreview (appearance view). Default: sample text. */
  readonly subtitlePreviewTargetText?: string;
  /** User-editable preview text for native line in OverlayPreview (appearance view). Default: sample text. */
  readonly subtitlePreviewNativeText?: string;
  /**
   * Per-site subtitle preference (ADR-014 D5). Key = origin (e.g. 'themoviebox.org'),
   * value = { [lang]: subIndex } where subIndex is 0-based index into filtered
   * matches. Fallback first-match when index out of range (B8).
   */
  readonly subtitlePreference?: Record<string, Record<string, number>>;
  /**
   * Per-URL subtitle time offset in ms (ADR-019). Key = window.location.href (full URL),
   * value = offsetMs. +offset = sub muộn hơn, -offset = sub sớm hơn.
   * Persist khi auto-commit (2 phút không action). Reset khi load sub file mới.
   */
  readonly subtitleOffset?: Record<string, number>;
  /** Keyboard shortcuts for subtitle floating panel. Default: a/d/s/w/t. */
  readonly keyboardShortcuts: KeyboardShortcut[];
  // === Nav Cluster (ADR-018, ADR-025) — flat keys, schema v3 ===
  /** Nav cluster master toggle. Default: true. */
  readonly navClusterEnabled: boolean;
  /** Nav cluster button size preset. Default: 48 (medium). */
  readonly navClusterButtonSize: NavClusterButtonSize;
  /** Nav cluster text opacity (0-1). Default: 1. */
  readonly navClusterTextOpacity: number;
  /** Nav cluster background opacity (0-1). Default: 0.2. */
  readonly navClusterButtonBgOpacity: number;
  // === Subtitle Block (ADR-025) ===
  /** Unified block settings (yOffset, globalScale, bgOpacity). Default: { yOffsetPercent: 75, globalScale: 1, bgOpacity: 0.7 }. */
  readonly subtitleBlockSettings: SubtitleBlockSettings;
  // === Card Creator (Anki integration) — schema v10 ===
  /** Card Creator settings (AnkiConnect URL, defaults, media update mode). */
  readonly cardCreator: CardCreatorSettings;
  // === Dictionary Popup (spec §9.3) — schema v14 ===
  /** Dictionary Popup settings (trigger mode, tabs, size, translate, external links). */
  readonly dictionaryPopup?: DictionaryPopupSettings;
  // === Subtitle Search (spec subtitle-search.md) — schema v21 ===
  /** API keys for subtitle search providers (SubDL, OpenSubtitles). */
  readonly subtitleApiKeys?: SubtitleApiKey[];
  // === Local Player (spec local-video-player.md) — schema v22 ===
  /** Local player settings (subtitle match, resume prompt, last directory). */
  readonly localPlayerSettings: LocalPlayerSettings;
  // === Pronunciation (spec ocean-pronunciation-engine — schema v25) ===
  /** Pronunciation engine fallback chain and eSpeak data download setting. */
  readonly pronunciation?: PronunciationSettings;
  // === Frequency bands (schema v28) ===
  /** User-configurable frequency rank thresholds for band coloring (popup + tokenize). */
  readonly frequencyBands?: FrequencyBandThresholds;
  // === Ocean Language Acquisition SRS (schema v27) ===
  /** SRS active collection/deck/study config and data lifecycle quota. */
  readonly srs: SrsSettingsSlice;
}

// === Subtitle Search API Key (schema v21) ===

export type SubtitleApiKeyProvider = 'subdl' | 'opensubtitles';
export type SubtitleApiKeyStatus = 'unverified' | 'active' | 'rate-limited' | 'invalid';

export interface SubtitleApiKey {
  readonly id: string;
  readonly provider: SubtitleApiKeyProvider;
  readonly key: string;
  readonly label?: string;
  readonly status: SubtitleApiKeyStatus;
  readonly addedAt: number;
  readonly rateLimitedUntil?: number;
}

