export type {
  CardCreatorAction,
  CardCreatorOpenContext,
  CardCreatorPrefill,
  CardCreatorQueueItem,
} from '@/entities/cardCreator';

/** Toast notification. */
export interface Toast {
  readonly id: number;
  readonly kind: 'success' | 'error' | 'warning';
  readonly message: string;
  /** Whether this toast supports an undo action (e.g. queue deletion). */
  readonly undoable?: boolean;
}
