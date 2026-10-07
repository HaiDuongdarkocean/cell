export type PumpSource = 'srs' | 'queue';

export interface PumpItem {
  readonly id: string;
  readonly source: PumpSource;
  /** cardId for srs items, queueItemId for queue items. */
  readonly refId: string;
  readonly term?: string;
  readonly sentence: string;
  readonly langCode: string;
  /** Playable stored audio — objectURL / data: / https: — absent means TTS synthesis. */
  readonly audioUrl?: string;
  /** Sort key for SRS items (card.nextDue); queue items sort by createdAt desc instead. */
  readonly dueAt?: string;
  readonly createdAt?: number;
}

export interface PumpConfig {
  /** null = all decks across collections. */
  readonly deckId: string | null;
  readonly includeSubdecks: boolean;
  readonly includeQueue: boolean;
  readonly repeat: 1 | 2 | 3;
  readonly gapSeconds: 0 | 1 | 2 | 4;
  readonly shuffle: boolean;
}

export type PumpPhase = 'idle' | 'building' | 'ready' | 'playing' | 'paused' | 'done' | 'empty' | 'error';

export interface PumpState {
  readonly phase: PumpPhase;
  readonly items: readonly PumpItem[];
  readonly index: number;
  readonly repeatsDone: number;
  readonly skipped: number;
  readonly played: number;
  readonly error?: string;
}
