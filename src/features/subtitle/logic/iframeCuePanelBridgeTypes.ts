// Bridge types for the iframe-hosted cue panel ('t' / split view).
//
// The panel surface cannot live in the player iframe — position:fixed is
// clipped to the iframe's viewport — so the child frame serializes state and
// the top frame renders SubtitlePanel/MobileCueChrome, relaying actions back.
// Same shape as iframeManagerBridge.

import type { BilingualCue } from '@/entities/media';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type { StudyMode } from '@/entities/studyMode';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import type { IconCatalogKey } from '@/shared/icons';
import type { AnnotationDisplayMode, KeyboardShortcut } from '@/entities/settings';

export const CUE_PANEL_STATE_MSG = '__Tihoka_CUE_PANEL_STATE';
export const CUE_PANEL_ACTION_MSG = '__Tihoka_CUE_PANEL_ACTION';

/** Serializable mirror of the CueListTokenize data members — callbacks are
 *  reconstructed on the host as CUE_PANEL_ACTION relays. */
export interface SerializedCueTokenize {
  langCode: string;
  readingDisplay?: AnnotationDisplayMode;
  glossDisplay?: AnnotationDisplayMode;
  glossTargetLanguage?: string;
  selectedTerms?: string[];
}

export interface SerializedCuePanelState {
  open: boolean;
  cues: BilingualCue[];
  currentTimeMs: number;
  offsetMs: number;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  playbackSpeed: PlaybackSpeed;
  practiceMode: SubtitlePracticeMode;
  activeModeId: string | null;
  customModes: readonly StudyMode[];
  tokenize: SerializedCueTokenize | null;
  panelBlurred: boolean;
  ocrEnabled: boolean;
  generateNativeEnabled: boolean;
  interactionLocked: boolean;
  filename?: string;
  pageUrl: string;
  pageTitle: string;
  /** Resolved keyboard bindings — the host relays matching keydowns back as
   *  'keydown' actions so hotkeys work while focus is on the top document. */
  shortcuts?: KeyboardShortcut[];
}

export type CuePanelAction =
  | 'close'
  | 'toggle'
  | 'keydown'
  | 'seek'
  | 'prev'
  | 'next'
  | 'repeat'
  | 'rewind'
  | 'forward'
  | 'playPause'
  | 'previousCue'
  | 'replayCue'
  | 'continueCue'
  | 'practiceMode'
  | 'playbackSpeed'
  | 'studyMode'
  | 'saveCue'
  | 'quickAdd'
  | 'editCard'
  | 'toggleOcr'
  | 'generateNative'
  | 'toggleManager'
  | 'toggleInteractionLock'
  | 'tokenClick'
  | 'tokenHover'
  | 'tokenCtrlClick';

export interface CuePanelActionMessage {
  action: CuePanelAction;
  [key: string]: unknown;
}
