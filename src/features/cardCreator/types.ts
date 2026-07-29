import type { BilingualCue } from '@/entities/media';
import type { MediaFile } from './media/mediaFile';

/** Card Creator action hint.
 *  - 'quick-add' = popup dictionary Quick Add (hardcoded as Add mode for now),
 *  - 'quick-update' = subtitle cluster quick-update (focus Update button),
 *  - 'edit-card' = subtitle cluster edit-card (neutral). */
export type CardCreatorAction = 'quick-add' | 'quick-update' | 'edit-card';

/** Pre-fill data from the popup dictionary (term + definitions + translation + media URLs).
 *  When present, `useCardCreatorState` uses these instead of empty strings. */
export interface CardCreatorPrefill {
  readonly targetWord?: string;
  readonly definitions?: string;
  readonly sentenceTranslation?: string;
  readonly sentence?: string;
  /** Word audio URLs (Forvo/TTS) selected in the popup — fetched + stored as MediaFile. */
  readonly wordAudioUrls?: readonly string[];
  /** Sentence audio URLs (Forvo/TTS) selected in the popup — fetched + stored as MediaFile. */
  readonly sentenceAudioUrls?: readonly string[];
  /** Image URLs (Google Images) selected in the popup — fetched + stored as MediaFile. */
  readonly imageUrls?: readonly string[];
}

/** A single item in the Send to Card queue (I+N review flow).
 *  Each item represents one unknown/tracking word from the current subtitle
 *  line, with its dictionary definitions pre-looked-up. Media (screenshot +
 *  sentence audio) is shared across all items — captured once before the
 *  dialog opens. */
export interface CardCreatorQueueItem {
  readonly term: string;
  readonly definitions: string;
  readonly status: 'unknown' | 'tracking';
}

/** Context for opening the card creator (video + cue + languages + prefill).
 *  video + cue are optional — when absent (popup dictionary text-reading case),
 *  media capture is skipped and prefill provides text fields. */
export interface CardCreatorOpenContext {
  /** The video element to capture media from (optional). */
  readonly video?: HTMLVideoElement;
  /** The current subtitle cue (for sentence text + audio timing). Optional. */
  readonly cue?: BilingualCue;
  /** Source language code (e.g. 'en'). */
  readonly sourceLang: string;
  /** Target/native language code (e.g. 'vi'). */
  readonly targetLang: string;
  /** Media captured BEFORE the dialog opens (screenshot + sentence audio). */
  readonly initialMedia?: readonly MediaFile[];
  /** Popup dictionary pre-fill (term + definitions + translation). */
  readonly prefill?: CardCreatorPrefill;
  /** Send to Card queue (I+N review flow). When present with ≥2 items, the
   *  dialog opens with a right sidebar. N=1 → no sidebar. */
  readonly queue?: readonly CardCreatorQueueItem[];
}

/** Toast notification. */
export interface Toast {
  readonly id: number;
  readonly kind: 'success' | 'error' | 'warning';
  readonly message: string;
}
