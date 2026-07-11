/**
 * CardCreatorDialog — desktop modal wrapper around CardCreatorDialogContent.
 *
 * Uses the shared `Dialog` component as the shell (overlay, focus management,
 * Esc to close) with the Card Creator body inside.
 */
import type { ReactElement } from 'react';
import { Dialog } from '@/shared/ui/Dialog';
import type { CardCreatorSettings } from '@/entities/settings';
import type { BilingualCue } from '@/entities/media';
import type { MediaFile } from '../media/mediaFile';
import { CardCreatorDialogContent } from './CardCreatorDialogContent';
import { useCardCreatorState, type OpenContext } from './useCardCreatorState';

interface CardCreatorDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** Card Creator settings (URL, defaults). */
  settings: CardCreatorSettings;
  /** Context for media extraction (video + cue + languages + pre-captured media). */
  openContext: { video: HTMLVideoElement; cue: BilingualCue; sourceLang: string; targetLang: string; initialMedia?: readonly MediaFile[] } | null;
  /** Initial action hint ('quick-update' pre-selects Update, 'edit-card' is neutral). */
  initialAction?: 'quick-update' | 'edit-card';
}

export function CardCreatorDialog({
  open,
  onOpenChange,
  settings,
  openContext,
  initialAction,
}: CardCreatorDialogProps): ReactElement | null {
  // Always call the hook (rules of hooks). When closed, openContext is null
  // and the hook no-ops its data loading.
  const ctx: OpenContext | null = open ? openContext : null;
  const state = useCardCreatorState(settings, ctx, initialAction);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Card Creator"
      showCloseButton
      data-testid="card-creator-dialog"
    >
      <CardCreatorDialogContent
        state={state}
        variant="desktop"
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
