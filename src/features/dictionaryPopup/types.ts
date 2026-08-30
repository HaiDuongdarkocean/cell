// Popup Dictionary contracts — spec §9.1, §9.4.
//
// Boundary types for lookup, worker transport, Quick Add, and word status.
// No logic here — pure type module. Zod validation lives in ./schema.ts.
// Settings v14 types (DictionaryPopupSettings, CardCreatorSettingsV14) live in
// `@/entities/settings/types.ts` and are added in Task 3.2.

import type { PhraseMatch } from '@/features/dictionary/logic/phraseMatcher';

// === Logic output → UI input ===

export type ReadingKind = 'ipa' | 'pinyin' | 'none';
export type WordStatus = 'unknown' | 'known' | 'tracking' | 'ignore';
export type TriggerMode = 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt';
export type PopupTab = 'audio' | 'image' | 'translate' | 'links';
export type SrsDestination = 'anki';
export type AudioSourceKind = 'community' | 'system-tts' | 'cloud-tts' | 'local';
export type AudioKind = 'word' | 'sentence';
export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'error';
export type MatchSource = 'dictionary' | 'plugin' | 'fallback';

// === Lookup request / result ===

export interface LookupRequest {
  readonly term: string;
  readonly langCode: string;
  readonly contextSentence: string;
  /** UTF-16 character offset of hovered token; worker derives token index. */
  readonly cursorOffset: number;
  /** true khi user bôi đen text: bỏ qua plugin phraseMatch, dùng term verbatim + lemma only. */
  readonly fallback?: boolean;
}

export interface DefinitionEntry {
  readonly id: string;
  readonly pos?: string;
  readonly text: string;
  readonly examples: readonly string[];
  /** 'Cambridge', 'CC-CEDICT', ... */
  readonly source: string;
  /** Server hint; UI selection state ở Zustand, không persist LookupResult (O10). */
  readonly defaultSelected: boolean;
}

export interface AudioItem {
  readonly id: string;
  readonly kind: AudioKind;
  readonly source: AudioSourceKind;
  /** 'Forvo · US native', 'System TTS · Female' */
  readonly label: string;
  readonly accentId?: string;
  readonly state: AudioState;
  readonly url?: string;
  /** Server hint; UI selection state ở Zustand (O10). */
  readonly defaultSelected: boolean;
}

export interface ImageItem {
  readonly id: string;
  readonly alt: string;
  readonly src: string;
  /** Server hint (O10). */
  readonly defaultSelected: boolean;
}

export interface ExternalDictLink {
  readonly id: string;
  readonly name: string;
  /** Đã fill {term}/{lang}. */
  readonly url: string;
}

export interface LookupResult {
  readonly term: string;
  readonly langCode: string;
  /** Primary reading (Chinese multi-pronunciation: chọn primary theo dict entry order, secondary trong definitions). */
  readonly reading: string;
  readonly readingKind: ReadingKind;
  readonly frequency: { readonly rank: number; readonly source: string } | null;
  readonly status: WordStatus;
  readonly partsOfSpeech: readonly string[];
  readonly definitions: readonly DefinitionEntry[];
  /** Raw definition strings from DB (1 per dictEntry), with <br> + N. markers intact. */
  readonly rawDefinitions: readonly string[];
  /** Structurally valid match only; null → normal dictionary fallback. */
  readonly detectedPhrase: PhraseMatch | null;
  readonly matchSource: MatchSource;
}

// === Quick Add ===

export interface QuickAddPayload {
  readonly term: string;
  readonly langCode: string;
  /** User đã tick. */
  readonly definitions: readonly DefinitionEntry[];
  readonly audios: readonly AudioItem[];
  readonly images: readonly ImageItem[];
  /** Default '' nếu chưa mở Translate. */
  readonly translation: string;
  /** Default = LookupRequest.contextSentence. */
  readonly sentence: string;
  readonly status: WordStatus;
  /** MVP: chỉ 'anki'. Cell Memory thêm lại khi scheduler ready. */
  readonly destination: SrsDestination;
}

// === Worker transport (spec §9.4 A) — NOT in MV3 fan-out ===
//
// Content script ↔ lookup worker. requestId routes responses; LOOKUP_CANCEL
// drops the result if the requestId is already cancelled.

export type WorkerMessageType =
  | 'WORKER_READY'
  | 'HYDRATE_CHUNK'
  | 'HYDRATE_DONE'
  | 'PUSH_DEFINITION'
  | 'LOOKUP'
  | 'LOOKUP_CANCEL'
  | 'LOOKUP_RESULT'
  | 'LOOKUP_RESULT_APPEND';

export interface WorkerMessageBase {
  readonly type: WorkerMessageType;
  readonly requestId: string;
}

export interface WorkerLookupMessage extends WorkerMessageBase {
  readonly type: 'LOOKUP';
  readonly payload: LookupRequest;
}

export interface WorkerCancelMessage extends WorkerMessageBase {
  readonly type: 'LOOKUP_CANCEL';
}

export interface WorkerReadyMessage extends WorkerMessageBase {
  readonly type: 'WORKER_READY';
}

export interface WorkerHydrateChunkMessage extends WorkerMessageBase {
  readonly type: 'HYDRATE_CHUNK';
  /** Resource this blob belongs to. */
  readonly resourceId: number;
  /** Transferable ArrayBuffer — the compiled phrase blob for this resource. */
  readonly payload: ArrayBuffer;
}

export interface WorkerHydrateDoneMessage extends WorkerMessageBase {
  readonly type: 'HYDRATE_DONE';
}

/**
 * Background → worker: push a dictionary entry for a term after an IDB miss
 * (spec §9.5 step 4). The worker inserts it into the definitions LRU; if the
 * LRU exceeds the 10k cap, the least-recently-used entry is evicted.
 */
export interface WorkerPushDefinitionMessage extends WorkerMessageBase {
  readonly type: 'PUSH_DEFINITION';
  /** The term this entry resolves. */
  readonly term: string;
  /** Serialized dictionary entries for the term (usually 1, can be many senses). */
  readonly entries: readonly unknown[];
}

export type WorkerRequestMessage =
  | WorkerLookupMessage
  | WorkerCancelMessage
  | WorkerHydrateChunkMessage
  | WorkerHydrateDoneMessage
  | WorkerPushDefinitionMessage;

export interface WorkerLookupResultMessage {
  readonly type: 'LOOKUP_RESULT';
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: LookupResult;
  readonly error?: string;
}

/** Worker → host: append an additional candidate to an existing popup. */
export interface WorkerLookupAppendMessage {
  readonly type: 'LOOKUP_RESULT_APPEND';
  readonly requestId: string;
  readonly result: LookupResult;
}

export type WorkerResponseMessage = WorkerLookupResultMessage | WorkerLookupAppendMessage | WorkerReadyMessage;

// === MV3 message payloads (spec §9.4 B — content/background fan-out) ===
// Payload luôn có tabId khi response fan-out (AGENTS.md MV3 rule).

export interface WordStatusGetPayload {
  readonly tabId: number;
  readonly term: string;
  readonly langCode: string;
}

export interface WordStatusSetPayload extends WordStatusGetPayload {
  readonly status: WordStatus;
}

/** Cached tab panel data for a single term. Persists across popup close/open
 *  within the same page; cleared when the content script unloads. */
export interface TabPanelCache {
  audioItems: AudioItem[];
  audioSelection: Map<string, boolean>;
  /** ID of community audio item owned by header play button.
   *  Audio tab excludes this from its list to avoid duplication. */
  headerAudioId: string | null;
  imageItems: ImageItem[];
  imageSelection: Map<string, boolean>;
  translations: Map<string, { translation: string; selected: boolean }>;
}

export interface FetchCommunityAudioPayload {
  readonly tabId: number;
  readonly term: string;
  readonly langCode: string;
  readonly kind: AudioKind;
}

export interface FetchCommunityAudioResponse {
  readonly items: readonly AudioItem[];
}

export interface FetchImagesPayload {
  readonly tabId: number;
  readonly term: string;
  readonly langCode: string;
  readonly maxResults?: number;
}

export interface FetchImagesResponse {
  readonly items: readonly ImageItem[];
}

export interface TtsSpeakPayload {
  readonly tabId: number;
  readonly text: string;
  readonly langCode: string;
  readonly rate?: number;
  readonly pitch?: number;
  readonly voiceName?: string;
}

export interface TtsFetchAudioPayload {
  readonly tabId: number;
  readonly text: string;
  readonly langCode: string;
}

export interface TtsFetchAudioResponse {
  readonly url: string;
}

export interface QuickAddPayloadMessage extends QuickAddPayload {
  readonly tabId: number;
}

export interface QuickAddFieldError {
  readonly field: string;
  readonly message: string;
}

export interface QuickAddResponse {
  readonly ok: boolean;
  readonly noteId?: number;
  readonly error?: string;
  readonly fieldErrors?: readonly QuickAddFieldError[];
}

// === Popup controller / Card Creator prefill contracts ===
//
// These types are shared between the legacy popupDictionaryController and the
// React `PopupDictionary` path. Keeping them in this pure type module lets us
// delete the legacy UI files without breaking downstream consumers.

/** Pre-fill data extracted from the popup dictionary for the Card Creator.
 *  Built from the lookup result + selections + context sentence + translation.
 *  Word audio, sentence audio and image are treated as mandatory: at least one
 *  of each is always included (selected first, then fallback to first available). */
export interface PopupCardCreatorPrefill {
  readonly term: string;
  readonly langCode: string;
  readonly reading: string;
  readonly definitions: readonly { readonly pos?: string; readonly text: string }[];
  /** Raw definition strings from DB (with <br> + N. markers intact). */
  readonly rawDefinitions: readonly string[];
  readonly contextSentence: string;
  readonly translation?: string;
  readonly wordAudioUrls?: readonly string[];
  readonly sentenceAudioUrls?: readonly string[];
  readonly imageUrls?: readonly string[];
}

export type PopupCardCreatorAction = 'quick-add' | 'edit-card';

/** Result returned by the onCardCreatorAction callback. */
export interface OnCardCreatorActionResult {
  /** If true, the popup stays open after the action (e.g. when sending to the
   *  universal panel, the popup stays open until the user explicitly closes it). */
  readonly stayOpen?: boolean;
}

export type OnCardCreatorAction = (
  action: PopupCardCreatorAction,
  prefill: PopupCardCreatorPrefill,
) => OnCardCreatorActionResult | void;

/** Callback to Quick Add directly (bypass dialog). Wired by content script. */
export type OnQuickAddDirect = (prefill: PopupCardCreatorPrefill) => void;
