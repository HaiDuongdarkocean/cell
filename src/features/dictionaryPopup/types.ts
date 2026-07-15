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
export type AudioSourceKind = 'community' | 'system-tts' | 'cloud-tts';
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
  | 'LOOKUP'
  | 'LOOKUP_CANCEL'
  | 'LOOKUP_RESULT';

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

export type WorkerRequestMessage =
  | WorkerLookupMessage
  | WorkerCancelMessage
  | WorkerHydrateChunkMessage
  | WorkerHydrateDoneMessage;

export interface WorkerLookupResultMessage {
  readonly type: 'LOOKUP_RESULT';
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: LookupResult;
  readonly error?: string;
}

export type WorkerResponseMessage = WorkerLookupResultMessage | WorkerReadyMessage;
