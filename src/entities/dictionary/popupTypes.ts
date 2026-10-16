// Popup Dictionary contracts — spec §9.1, §9.4.
//
// Boundary types for lookup, worker transport, Quick Add, and word status.
// No logic here — pure type module. Zod validation lives in
// `@/entities/message/dictionarySchemas`.
// Settings v14 types (DictionaryPopupSettings, CardCreatorSettingsV14) live in
// `@/entities/settings/types.ts`.

import type { LookupRequest, PhraseMatch, SenseLine, SubsenseBlock, RelationGroup, RelatedEntry, InflectionGroup, EtymologyBlock, WordFamily, WordNetInfo, FrequencyGenres, PronunciationAccent } from './types';
import type { BilingualCue, MediaFile } from '@/entities/media';
import type { CardCreatorQueueItem } from '@/entities/cardCreator';

export type { LookupRequest };

// === Logic output → UI input ===

export type ReadingKind = 'ipa' | 'pinyin' | 'none';
export type WordStatus = 'unknown' | 'known' | 'tracking' | 'ignore';
/** Base-knowledge cycle only — `tracking` is an engagement flag over the base
 *  states and is never cycled into from the status pill. Card existence is a
 *  separate `hasCard` layer, never a status. Legacy persisted `learning`
 *  values coalesce to `tracking` at the read boundary. */
export const STATUS_CYCLE: readonly WordStatus[] = ['unknown', 'known', 'ignore'];
export type TriggerMode = 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt';
export type ClickModifierState = Pick<MouseEvent, 'ctrlKey' | 'shiftKey' | 'altKey'>;
export type PopupTab = 'audio' | 'image' | 'translate' | 'ai' | 'breakdown' | 'links' | 'pronunciation';
export type SrsDestination = 'anki';
export type AudioSourceKind = 'community' | 'system-tts' | 'cloud-tts' | 'local' | 'espeak';
export type AudioKind = 'word' | 'sentence';
export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'error';
export type MatchSource = 'dictionary' | 'plugin' | 'fallback';

// === Lookup request / result ===

export interface DefinitionEntry {
  readonly id: string;
  readonly pos?: string;
  /** Register/grammar/audience tags — rendered as selectable `[label]`
   *  text before the gloss. */
  readonly labels?: readonly string[];
  /** Per-sense CEFR/provider level — rendered as plain `[B1]` text. */
  readonly level?: string;
  readonly text: string;
  /** Structured sense lines when available (new imports + legacy fallback
   *  classifier) — enables per-line rendering + translation reveal. */
  readonly lines?: readonly SenseLine[];
  readonly subsenses?: readonly SubsenseBlock[];
  /** Per-sense relations — flat term lists for card text and search. */
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
  /** Labeled relation groups — keeps the provider's muted topic label
   *  (e.g. 'Exact and accurate') for display. */
  readonly synonymGroups?: readonly RelationGroup[];
  /** Selectable example rows under this definition — sense-level
   *  `role:'example'` lines hoisted at assembly + entry-level `examples`
   *  strings wrapped as SenseLines. Text/pattern/citation/translation
   *  preserved for display; only `text` ships to card fields. */
  readonly examples: readonly SenseLine[];
  /** Resource name the def came from (file name minus extension). */
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
  /** Raw audio bytes for sources that cannot provide a cross-context URL (e.g. local File System Access). */
  readonly audioBytes?: Uint8Array;
  /** Wire-carried base64 of `audioBytes` — decoded at the provider boundary and stripped before UI state. */
  readonly audioBytesB64?: string;
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

/** One frequency chip on a variant — flat `rank`/`source` shape plus
 *  optional pos-list extras surfaced on hover (total + genre breakdown). */
export interface VariantFrequency {
  readonly rank: number;
  readonly source: string;
  readonly total?: number;
  readonly genres?: FrequencyGenres;
}

/** Merged per-pos view of a term (spec pos-dictionary-variants REQ-5).
 *  Derived at lookup — never stored. `pos` is the posNormalize output;
 *  `''` is the `other` bucket (pos-less senses), always ordered last. */
export interface PosVariant {
  readonly pos: string;
  /** Accent-scoped pronunciations merged across providers —
   *  dedupe first-wins per accent. */
  readonly prons: readonly PronunciationAccent[];
  /** Frequency rows joined to this variant (pos rows + term-level
   *  fallback rows), sorted resourcePriority → rank. */
  readonly frequencies: readonly VariantFrequency[];
  /** Resolved status: `term␟pos` row ?? `term` row ?? 'unknown'. */
  readonly status: WordStatus;
  /** Senses belonging to this variant's pos, concatenated across
   *  providers in resource-priority order (never aligned). */
  readonly definitions: readonly DefinitionEntry[];
  /** First-wins stars from the highest-priority provider that has them,
   *  rendered as a `{source} ★…` chip in the frequency row. */
  readonly frequencyStars?: { readonly count: number; readonly source: string };
  readonly inflections?: readonly InflectionGroup[];
}

export interface LookupResult {
  readonly term: string;
  readonly langCode: string;
  /** Primary reading (Chinese multi-pronunciation: chọn primary theo dict entry order, secondary trong definitions). */
  readonly reading: string;
  readonly readingKind: ReadingKind;
  /** Frequency rank per imported list that contains the term — one chip per
   *  list in the header, ordered best-first (resource priority, then rank). */
  readonly frequencies: readonly { readonly rank: number; readonly source: string }[];
  readonly status: WordStatus;
  readonly partsOfSpeech: readonly string[];
  readonly definitions: readonly DefinitionEntry[];
  /** Raw definition strings from DB (1 per dictEntry), with <br> + N. markers intact. */
  readonly rawDefinitions: readonly string[];
  /** Structurally valid match only; null → normal dictionary fallback. */
  readonly detectedPhrase: PhraseMatch | null;
  /** Kind-tagged links to other entries — phrasal verbs, idioms,
   *  collocations, phrases. Merged across resources, deduped by term. */
  readonly related?: readonly RelatedEntry[];
  readonly inflections?: readonly InflectionGroup[];
  /** Entry-level CEFR/provider level (header `[B1]`). */
  readonly level?: string;
  /** 1–3 frequency stars from the highest-priority dictionary that has them,
   *  rendered as a `{source} ★…` chip in the frequency row. */
  readonly frequencyStars?: { readonly count: number; readonly source: string };
  /** Word origin — primary chain + checkable per-source variants. */
  readonly etymology?: EtymologyBlock;
  readonly wordFamily?: WordFamily;
  readonly wordNet?: WordNetInfo;
  readonly derivedTerms?: readonly string[];
  /** Per-pos merged views (pos-dictionary-variants) — absent/empty keeps
   *  the popup on today's single-variant rendering. */
  readonly variants?: readonly PosVariant[];
  readonly matchSource: MatchSource;
  readonly phraseIndexPending?: boolean;
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
  /** MVP: chỉ 'anki'. Tihoka Memory thêm lại khi scheduler ready. */
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

export interface FetchLocalAudioPayload {
  readonly tabId: number;
  readonly term: string;
  readonly langCode: string;
  readonly kind: AudioKind;
}

export interface FetchLocalAudioResponse {
  readonly items: readonly AudioItem[];
}

export type LocalAudioPermission = 'granted' | 'prompt' | 'denied' | 'none';

export interface LocalAudioStateResponse {
  readonly configured: boolean;
  readonly permission: LocalAudioPermission;
}

export interface LocalAudioBuildIndexPayload {
  readonly dslFileHandleId: string;
}

export interface LocalAudioBuildIndexResponse {
  readonly jobId: string;
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
// Shared between the React `PopupDictionary` path and the integrated
// Dictionary in the Universal Panel; kept in a pure type module so UI
// deletions don't break downstream consumers.

/** Selection snapshot cloned from the popup dictionary at sendToCard time so
 *  the integrated Dictionary in the Universal Panel can initialize with the
 *  same checked state (spec: card-creator-bottom-sheet-mobile, Task 4).
 *  All fields optional — absent when the sender has no selection state
 *  (e.g. subtitle queue actions). */
export interface PopupSelectionSnapshot {
  /** Ids of image items checked for the card (effective selection). */
  readonly selectedImageIds?: readonly string[];
  /** Ids of audio items checked for the card (effective selection). */
  readonly selectedAudioIds?: readonly string[];
  /** Ids of definitions the user explicitly ticked. */
  readonly selectedDefinitionIds?: readonly string[];
  /** Composite `defId:index` ids of example lines the user ticked.
   *  `[]` = explicit zero examples; absent = no snapshot. */
  readonly selectedExampleIds?: readonly string[];
  /** Whether the translation checkbox was selected. */
  readonly translationSelected?: boolean;
}

/** Pre-fill data extracted from the popup dictionary for the Card Creator.
 *  Built from the lookup result + selections + context sentence + translation.
 *  Word audio, sentence audio and image are treated as mandatory: at least one
 *  of each is always included (selected first, then fallback to first available). */
export interface PopupCardCreatorPrefill extends PopupSelectionSnapshot {
  readonly term: string;
  readonly langCode: string;
  /** Canonical pos of the variant the card was built from
   *  (pos-dictionary-variants); absent for term-level prefills. */
  readonly pos?: string;
  readonly reading: string;
  readonly readingKind?: ReadingKind;
  readonly definitions: readonly {
    readonly pos?: string;
    /** Register/grammar/audience tags — rendered `[label]` before the gloss. */
    readonly labels?: readonly string[];
    /** Per-sense CEFR/provider level — rendered `[B1]`. */
    readonly level?: string;
    readonly text: string;
    readonly subsenses?: readonly (SubsenseBlock & {
      /** Example sentences the user ticked for this subsense. */
      readonly selectedExamples?: readonly string[];
    })[];
    readonly synonyms?: readonly string[];
    readonly antonyms?: readonly string[];
    readonly synonymGroups?: readonly RelationGroup[];
    /** Example sentences the user ticked for this def (subset of
     *  `DefinitionEntry.examples`). `[]` = explicitly none. */
    readonly selectedExamples?: readonly string[];
  }[];
  /** Raw definition strings from DB (with <br> + N. markers intact). */
  readonly rawDefinitions: readonly string[];
  readonly contextSentence: string;
  readonly translation?: string;
  readonly wordAudioUrls?: readonly string[];
  readonly sentenceAudioUrls?: readonly string[];
  readonly imageUrls?: readonly string[];
  /** The original lookup result used to build this prefill. Carried so the
   *  integrated Dictionary can render the same candidate without re-searching. */
  readonly lookupResult?: LookupResult;
  /** Frequency ranks of the SELECTED variant (term-level rows when no
   *  variants exist) — the same chips the popup status row displayed. */
  readonly frequencies?: readonly { readonly rank: number; readonly source: string }[];
  /** First-wins stars of the selected variant, mirroring `frequencies`. */
  readonly frequencyStars?: { readonly count: number; readonly source: string };
  /** Audio items loaded for the popup candidate. Mirrors the popup's audio tab. */
  readonly audioItems?: readonly AudioItem[];
  /** Image items loaded for the popup candidate. Mirrors the popup's image tab. */
  readonly imageItems?: readonly ImageItem[];
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

/** Prefill/context sent to the Dictionary tab's integrated Card Creator.
 *  Extends the popup prefill with optional subtitle capture context
 *  (video, cue, pre-captured media, queue, initial action).
 *  Also inherits the popup selection snapshot (`selectedImageIds`,
 *  `selectedAudioIds`, `selectedDefinitionIds`, `translationSelected`) so the
 *  integrated Dictionary can initialize as an exact clone of the popup. */
export interface DictionaryPanelPrefill extends Omit<PopupCardCreatorPrefill, 'term'> {
  /** Search term for the left dictionary pane. Optional — omitted when the
   *  context has no single target word (e.g. empty subtitle queue). */
  readonly term?: string;
  /** Video element for screenshot/sentence-audio capture. */
  readonly video?: HTMLVideoElement;
  /** Current subtitle cue (target + native text + timing). */
  readonly cue?: BilingualCue;
  /** Media already captured before opening (screenshot + sentence audio). */
  readonly initialMedia?: readonly MediaFile[];
  /** I+N review queue. ≥2 items opens the queue sidebar; 1 item pre-fills
   *  the target word without showing the sidebar. */
  readonly queue?: readonly CardCreatorQueueItem[];
  /** Hint for initial focus/state. */
  readonly initialAction?: 'quick-add' | 'quick-update' | 'edit-card';
  /** True while media capture is still in flight — forwarded to
   *  CardCreatorOpenContext.mediaPending so submit stays disabled until the
   *  follow-up context lands. */
  readonly mediaPending?: boolean;
  /** Mining-queue row this prefill was replayed from — the sender removes the
   *  row after a successful submit (spec mining-queue: cardify keeps the row
   *  until the card actually saves). */
  readonly queueItemId?: string;
}
