import type { CardDraft, MediaUpdateMode } from './cardDraft';
import type { CardCreatorOpenContext, CardCreatorQueueItem } from '../types';

export interface InitialDraftDefaults {
  readonly noteType: string;
  readonly deck: string;
  readonly tags: string;
  readonly mediaUpdateMode: MediaUpdateMode;
}

export interface InitialDraftPlan {
  readonly draft: CardDraft;
  readonly queueItems: readonly CardCreatorQueueItem[];
  readonly queueActiveIndex: number;
  readonly queueSidebarOpen: boolean;
  readonly activeQueueTerm: string;
}

export function buildInitialDraft(
  ctx: CardCreatorOpenContext,
  restored: CardDraft | null,
  defaults: InitialDraftDefaults,
): InitialDraftPlan {
  const initialImages = ctx.initialMedia?.filter((f) => f.kind === 'image') ?? [];
  const initialAudios = ctx.initialMedia?.filter((f) => f.kind === 'audio') ?? [];
  const prefill = ctx.prefill;
  const ctxQueue = ctx.queue;

  if (ctxQueue && ctxQueue.length >= 1) {
    const prefillTerm = prefill?.targetWord?.trim() ?? '';
    const matchIndex = prefillTerm
      ? ctxQueue.findIndex((item) => item.term.toLowerCase() === prefillTerm.toLowerCase())
      : -1;
    const activeIndex = matchIndex >= 0 ? matchIndex : 0;
    const activeItem = ctxQueue[activeIndex]!;
    const usePrefillDefinitions =
      activeItem.term.toLowerCase() === prefillTerm.toLowerCase();
    return {
      queueItems: ctxQueue,
      queueActiveIndex: activeIndex,
      queueSidebarOpen: ctxQueue.length >= 2,
      activeQueueTerm: activeItem.term,
      draft: {
        noteType: restored?.noteType ?? defaults.noteType,
        deck: restored?.deck ?? defaults.deck,
        fields: {
          targetWord: activeItem.term,
          sentence: ctx.cue?.targetText ?? prefill?.sentence ?? '',
          sentenceTranslation: ctx.cue?.nativeText ?? prefill?.sentenceTranslation ?? '',
          definitions: usePrefillDefinitions
            ? (prefill?.definitions ?? '')
            : activeItem.definitions,
          images: initialImages,
          sentenceAudios: initialAudios,
          wordAudios: [],
          note: prefill?.note ?? '',
          moreExample: prefill?.moreExample ?? '',
        },
        fieldMapping: restored?.fieldMapping ?? {},
        tags: restored?.tags ?? defaults.tags,
        mediaUpdateMode: restored?.mediaUpdateMode ?? defaults.mediaUpdateMode,
      },
    };
  }

  return {
    queueItems: [],
    queueActiveIndex: -1,
    queueSidebarOpen: false,
    activeQueueTerm: '',
    draft: {
      noteType: restored?.noteType ?? defaults.noteType,
      deck: restored?.deck ?? defaults.deck,
      fields: {
        targetWord: prefill?.targetWord ?? '',
        sentence: prefill?.sentence ?? ctx.cue?.targetText ?? '',
        sentenceTranslation: prefill?.sentenceTranslation ?? ctx.cue?.nativeText ?? '',
        definitions: prefill?.definitions ?? '',
        images: initialImages,
        sentenceAudios: initialAudios,
        wordAudios: [],
        note: prefill?.note ?? '',
        moreExample: prefill?.moreExample ?? '',
      },
      fieldMapping: restored?.fieldMapping ?? {},
      tags: restored?.tags ?? defaults.tags,
      mediaUpdateMode: restored?.mediaUpdateMode ?? defaults.mediaUpdateMode,
    },
  };
}
