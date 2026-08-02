/**
 * CardCreatorBottomSheet — mobile bottom-sheet wrapper around
 * CardCreatorDialogContent. Uses the shared `BottomSheet` component.
 *
 * On mobile (Kiwi/Edge Android), the Card Creator opens as a bottom sheet
 * that slides up from the bottom of the viewport, with a drag handle and
 * 75vh max height. Content is the same as desktop but with stacked layout.
 */
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import type { CardCreatorSettings } from '@/entities/settings';
import type { CardCreatorOpenContext } from '../types';
import type { MediaFile } from '../media/mediaFile';
import { CardCreatorDialogContent } from './CardCreatorDialogContent';
import { useCardCreatorState } from './useCardCreatorState';
import { clearAnkiConnectPrefetch } from '../service/cardCreatorPrefetch';

interface CardCreatorBottomSheetProps {
  /** Whether the bottom sheet is open. */
  open: boolean;
  /** Called when the sheet should close. */
  onOpenChange: (open: boolean) => void;
  /** Card Creator settings (URL, defaults). */
  settings: CardCreatorSettings;
  /** Context for media extraction (video + cue + languages + pre-captured media). */
  openContext: CardCreatorOpenContext | null;
  /** Initial action hint ('quick-add' = popup Quick Add, 'quick-update' pre-selects Update, 'edit-card' is neutral). */
  initialAction?: 'quick-add' | 'quick-update' | 'edit-card';
  /** Register a callback to push media files into the open dialog (background fetch). */
  registerAddMedia?: (cb: ((kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[]) => void) | null) => void;
  /** Register a callback to push text field updates into the open dialog (background fetch). */
  registerUpdateText?: (cb: ((key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void) | null) => void;
}

export function CardCreatorBottomSheet({
  open,
  onOpenChange,
  settings,
  openContext,
  initialAction,
  registerAddMedia,
  registerUpdateText,
}: CardCreatorBottomSheetProps): ReactElement | null {
  const ctx: CardCreatorOpenContext | null = open ? openContext : null;
  const state = useCardCreatorState(settings, ctx, initialAction);

  useEffect(() => {
    if (!open || !registerAddMedia) return;
    registerAddMedia(state.addFiles);
    return () => registerAddMedia(null);
  }, [open, registerAddMedia, state.addFiles]);

  useEffect(() => {
    if (!open || !registerUpdateText) return;
    registerUpdateText(state.updateField);
    return () => registerUpdateText(null);
  }, [open, registerUpdateText, state.updateField]);

  if (!open) return null;

  const handleOpenChange = (next: boolean): void => {
    if (!next) clearAnkiConnectPrefetch();
    onOpenChange(next);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Card Creator"
      centerTitle
      data-cell-id="card-creator-bottom-sheet"
    >
      <CardCreatorDialogContent
        state={state}
        variant="mobile"
        onCancel={() => handleOpenChange(false)}
      />
    </BottomSheet>
  );
}
