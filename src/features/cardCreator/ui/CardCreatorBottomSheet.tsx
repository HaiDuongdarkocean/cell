/**
 * CardCreatorBottomSheet — mobile bottom-sheet wrapper around
 * CardCreatorDialogContent. Uses the shared `BottomSheet` component.
 *
 * On mobile (Kiwi/Edge Android), the Card Creator opens as a bottom sheet
 * that slides up from the bottom of the viewport, with a drag handle and
 * 75vh max height. Content is the same as desktop but with stacked layout.
 */
import type { ReactElement } from 'react';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import type { CardCreatorSettings } from '@/entities/settings';
import { CardCreatorDialogContent } from './CardCreatorDialogContent';
import { useCardCreatorState, type OpenContext } from './useCardCreatorState';

interface CardCreatorBottomSheetProps {
  /** Whether the bottom sheet is open. */
  open: boolean;
  /** Called when the sheet should close. */
  onOpenChange: (open: boolean) => void;
  /** Card Creator settings (URL, defaults). */
  settings: CardCreatorSettings;
  /** Context for media extraction (video + cue + languages + pre-captured media). */
  openContext: OpenContext | null;
  /** Initial action hint ('quick-update' pre-selects Update, 'edit-card' is neutral). */
  initialAction?: 'quick-update' | 'edit-card';
}

export function CardCreatorBottomSheet({
  open,
  onOpenChange,
  settings,
  openContext,
  initialAction,
}: CardCreatorBottomSheetProps): ReactElement | null {
  const ctx: OpenContext | null = open ? openContext : null;
  const state = useCardCreatorState(settings, ctx, initialAction);

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Card Creator"
      data-testid="card-creator-bottom-sheet"
    >
      <CardCreatorDialogContent
        state={state}
        variant="mobile"
        onCancel={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}
