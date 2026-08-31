import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/types';
import type { BilingualCue } from '@/entities/media';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { CardCreatorQueueItem } from '@/features/cardCreator/ui/mountCardCreatorDialog';

export type UniversalPanelTab = 'dictionary' | 'settings' | 'studyModes';

export interface UniversalPanelController {
  readonly open: (tab?: UniversalPanelTab) => Promise<void>;
  readonly close: () => void;
  readonly switchTab: (tab: UniversalPanelTab) => Promise<void>;
  readonly isOpen: () => boolean;
  readonly sendToCard: (prefill: DictionaryPanelPrefill) => Promise<void>;
  readonly unmount: () => void;
}

/** Prefill/context sent to the Dictionary tab's integrated Card Creator.
 *  Extends the popup prefill with optional subtitle capture context
 *  (video, cue, pre-captured media, queue, initial action). */
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
}
