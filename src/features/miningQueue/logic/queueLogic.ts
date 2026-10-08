// queueLogic — pure helpers for the mining queue (spec mining-queue.md).
//
// Dedupe identity:
//   term item     → 'term' + normalized term + normalized sentence
//   sentence item → 'sentence' + normalized sentence + videoId
// Cap: at most MINING_QUEUE_CAP queued rows; oldest (smallest createdAt)
// evict first.

import type {
  MiningQueueInput,
  MiningQueueItem,
  MiningQueueRow,
} from '@/entities/miningQueue';
import { MINING_QUEUE_CAP } from '@/entities/miningQueue';
import type { PopupCardCreatorPrefill, AudioItem } from '@/entities/dictionary';
import type { BilingualCue } from '@/entities/media';

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function queueDedupeKey(input: MiningQueueInput): string {
  const sentence = normalizeText(input.sentence);
  if (input.kind === 'sentence') {
    return `sentence|${sentence}|${input.videoId ?? ''}`;
  }
  return `term|${normalizeText(input.term ?? '')}|${sentence}`;
}

/** Strip the non-serializable / heavyweight parts of a prefill before it is
 *  persisted: media bytes never enter the queue (spec snapshot strip rules —
 *  `AudioItem.audioBytes`/`audioBytesB64`, live `video`/`initialMedia`/`cue`
 *  refs, `MediaFile` blobs); URLs and item metadata persist. */
export function stripSnapshot(
  prefill: PopupCardCreatorPrefill,
): PopupCardCreatorPrefill {
  const audioItems = (prefill.audioItems ?? []).map((item) => {
    const clone = { ...(item as AudioItem & { audioBytesB64?: unknown }) };
    delete clone.audioBytes;
    delete clone.audioBytesB64;
    return clone;
  });
  const { audioItems: _omit, ...rest } = prefill;
  const stripped = rest as PopupCardCreatorPrefill & Record<string, unknown>;
  delete stripped.video;
  delete stripped.initialMedia;
  delete stripped.cue;
  return audioItems.length || prefill.audioItems
    ? { ...stripped, audioItems }
    : { ...stripped };
}

/** Build a full queue item from an input (id + dedupeKey + createdAt assigned
 *  in one place — the background store). */
export function buildQueueItem(
  input: MiningQueueInput,
  id: string,
  createdAt: number,
): MiningQueueItem {
  return {
    ...input,
    snapshot: input.snapshot ? stripSnapshot(input.snapshot) : undefined,
    id,
    dedupeKey: queueDedupeKey(input),
    createdAt,
  };
}

export function queueItemFromCue(
  cue: BilingualCue,
  langCode: string,
  source: { sourceLabel?: string; videoId?: string },
): MiningQueueInput {
  return {
    kind: 'sentence',
    langCode,
    sentence: cue.targetText,
    translation: cue.nativeText || undefined,
    sourceLabel: source.sourceLabel,
    videoId: source.videoId,
    cueIndex: cue.index,
    cueStart: cue.start,
  };
}

/** Ids to evict so at most `cap` rows remain — oldest createdAt first.
 *  Ties break by id so eviction order is deterministic. */
export function evictOverflow(
  items: readonly Pick<MiningQueueItem, 'id' | 'createdAt'>[],
  cap: number = MINING_QUEUE_CAP,
): readonly string[] {
  if (items.length <= cap) return [];
  const sorted = [...items].sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return sorted.slice(0, items.length - cap).map((i) => i.id);
}

/** Lean projection stored rows → list rows (no lookupResult/media lists). */
export function toQueueRow(item: MiningQueueItem): MiningQueueRow {
  return {
    id: item.id,
    kind: item.kind,
    term: item.term,
    pos: item.pos,
    sentence: item.sentence,
    sourceLabel: item.sourceLabel,
    cueStart: item.cueStart,
    createdAt: item.createdAt,
  };
}
