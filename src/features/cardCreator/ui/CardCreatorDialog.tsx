/**
 * CardCreatorDialog — desktop modal wrapper around CardCreatorDialogContent.
 *
 * Uses the shared `Dialog` component as the shell (overlay, focus management,
 * Esc to close) with the Card Creator body inside.
 */
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import type { CardCreatorSettings } from '@/entities/settings';
import type { CardCreatorOpenContext } from '../types';
import type { MediaFile } from '../media/mediaFile';
import { CardCreatorDialogContent } from './CardCreatorDialogContent';
import { useCardCreatorState } from './useCardCreatorState';
import { t } from '@/shared/i18n';
import { clearAnkiConnectPrefetch } from '../service/cardCreatorPrefetch';

interface CardCreatorDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** Card Creator settings (URL, defaults). */
  settings: CardCreatorSettings;
  /** Context for media extraction (video + cue + languages + pre-captured media + popup prefill). */
  openContext: CardCreatorOpenContext | null;
  /** Initial action hint ('quick-add' = popup Quick Add, 'quick-update' pre-selects Update, 'edit-card' is neutral). */
  initialAction?: 'quick-add' | 'quick-update' | 'edit-card';
  /** Register a callback to push media files into the open dialog (background fetch). */
  registerAddMedia?: (cb: ((kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[]) => void) | null) => void;
  /** Register a callback to push text field updates into the open dialog (background fetch). */
  registerUpdateText?: (cb: ((key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void) | null) => void;
}

export function CardCreatorDialog({
  open,
  onOpenChange,
  settings,
  openContext,
  initialAction,
  registerAddMedia,
  registerUpdateText,
}: CardCreatorDialogProps): ReactElement | null {
  // Always call the hook (rules of hooks). When closed, openContext is null
  // and the hook no-ops its data loading.
  const ctx: CardCreatorOpenContext | null = open ? openContext : null;
  const state = useCardCreatorState(settings, ctx, initialAction);

  // Register callbacks so the mount controller can push background-fetched
  // media + text into the open dialog without re-rendering from scratch.
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

  // Queue toggle icon — only rendered when N ≥ 2.
  const hasQueue = state.queueItems.length >= 2;
  const headerExtra = hasQueue ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={state.toggleQueueSidebar}
      aria-label={state.queueSidebarOpen ? t('cardCreator.queue.hide') : t('cardCreator.queue.show')}
      data-cell-id="cc-queue-toggle"
    >
      <Icon name="panelRight" />
    </Button>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('cardCreator.title')}
      showCloseButton
      centerTitle
      headerExtra={headerExtra}
      data-cell-id="card-creator-dialog"
    >
      <CardCreatorDialogContent state={state} variant="desktop" />
    </Dialog>
  );
}
