import { fsrs } from 'ts-fsrs';
import type { ComponentType, SrsMemoryComponent, SrsFsrsSerializedState } from '@/entities/srs/types';
import type { NormalizedAnkiCard, NormalizedAnkiRevlog } from '../model/normalized';

const DAY_MS = 86_400_000;
const LEARNING_PROGRESS = 20;
const engine = fsrs();

export interface ConvertedCardState {
  readonly components: Record<ComponentType, SrsMemoryComponent>;
  readonly fsrsState: SrsFsrsSerializedState;
  readonly progress: number;
}

export interface ConvertOptions {
  readonly crtMs: number | null; // apkg only; null on AnkiConnect
  readonly desiredRetention: number; // 0..1
  readonly now: Date;
  readonly minExplores: number;
  readonly revlog: readonly NormalizedAnkiRevlog[]; // this card's revlog, any order
}

/** Decode Anki `cards.data` memory_state blob (protobuf: field 1 fixed32 stability, field 2 fixed32 difficulty). */
export function decodeMemoryState(blob: Uint8Array): { stability: number; difficulty: number } | null {
  try {
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    let stability: number | null = null;
    let difficulty: number | null = null;
    let i = 0;
    while (i < blob.length) {
      const tag = blob[i++]!;
      const field = tag >> 3;
      const wire = tag & 7;
      if (wire === 5) {
        const v = view.getFloat32(i, true);
        i += 4;
        if (field === 1) stability = v;
        else if (field === 2) difficulty = v;
      } else if (wire === 0) {
        while (i < blob.length && blob[i++]! >= 0x80) { /* varint */ }
      } else if (wire === 2) {
        let len = 0, shift = 0;
        while (i < blob.length) { const b = blob[i++]!; len |= (b & 0x7f) << shift; shift += 7; if (b < 0x80) break; }
        i += len;
      } else if (wire === 1) {
        i += 8;
      } else {
        return null;
      }
    }
    if (stability === null || difficulty === null) return null;
    return { stability, difficulty };
  } catch {
    return null;
  }
}

function estimateStability(card: NormalizedAnkiCard): { stability: number; difficulty: number } {
  const stability = Math.max(card.ivl, 1);
  const difficulty = card.factor > 0
    ? Math.min(10, Math.max(1, Math.round(11 - card.factor / 300)))
    : 5;
  return { stability, difficulty };
}

/** Absolute due (ms epoch) for an Anki card, honoring per-queue `due` semantics. */
export function ankiDueMs(card: NormalizedAnkiCard, crtMs: number | null, lastReviewMs: number | null, nowMs: number): number {
  if (card.type === 0) return nowMs;
  if (card.queue === 1) return card.due * 1000; // unix seconds
  if (card.queue === 3 && crtMs === null) return nowMs; // day-learn on Connect: unknown anchor → due now
  if (crtMs !== null) return crtMs + card.due * DAY_MS;
  // Connect: no crt → last review + interval
  if (lastReviewMs !== null) return lastReviewMs + Math.max(card.ivl, 0) * DAY_MS;
  return nowMs;
}

/**
 * Convert one Anki card into the shared component state fanned out to all
 * three Tihoka components. Returns null for suspended cards (skipped).
 */
export function convertCardState(card: NormalizedAnkiCard, opts: ConvertOptions): ConvertedCardState | null {
  if (card.queue === -1) return null;

  const nowMs = opts.now.getTime();
  if (card.type === 0) {
    const empty: SrsFsrsSerializedState = {
      version: 1,
      due: opts.now.toISOString(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      state: 0,
    };
    return { fsrsState: empty, progress: 0, components: fanOut(empty, 0, 0, 0) };
  }

  const lastRevlog = opts.revlog.reduce<NormalizedAnkiRevlog | null>(
    (max, r) => (max === null || r.id > max.id ? r : max),
    null,
  );
  const lastReviewMs = lastRevlog?.id ?? null;
  const dueMs = ankiDueMs(card, opts.crtMs, lastReviewMs, nowMs);
  const ivl = Math.max(card.ivl, 0);
  const { stability, difficulty } = card.memoryState ?? estimateStability(card);

  const elapsedDays = Math.max(0, Math.round((nowMs - (lastReviewMs ?? dueMs - ivl * DAY_MS)) / DAY_MS));
  const retention = engine.forgetting_curve(elapsedDays, stability);
  const progress = card.type === 2
    ? Math.min(100, Math.max(0, Math.round((100 * retention) / opts.desiredRetention)))
    : LEARNING_PROGRESS;

  const state: SrsFsrsSerializedState = {
    version: 1,
    due: new Date(dueMs).toISOString(),
    stability,
    difficulty,
    elapsedDays: ivl,
    scheduledDays: ivl,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.type === 1 || card.type === 3 ? Math.floor(Math.max(card.left, 0) / 1000) : 0,
    state: card.type,
    lastReview: lastReviewMs !== null ? new Date(lastReviewMs).toISOString() : undefined,
  };

  return {
    fsrsState: state,
    progress,
    components: fanOut(state, progress, opts.minExplores, card.reps),
  };
}

function fanOut(
  fsrsState: SrsFsrsSerializedState,
  progress: number,
  exploreCount: number,
  reviewCount: number,
): Record<ComponentType, SrsMemoryComponent> {
  const comp = (type: ComponentType): SrsMemoryComponent => ({
    type,
    progress,
    exploreCount,
    fsrsState,
    reviewCount,
  });
  return { meaning: comp('meaning'), sound: comp('sound'), spelling: comp('spelling') };
}
