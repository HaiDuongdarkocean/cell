import type { PopupCardCreatorPrefill } from '@/entities/dictionary';

export type MiningQueueKind = 'term' | 'sentence';

/** Input a surface sends to QUEUE_ADD — background assigns id, dedupeKey and
 *  createdAt so normalization lives in one place. */
export interface MiningQueueInput {
  readonly kind: MiningQueueKind;
  readonly term?: string;
  readonly pos?: string;
  readonly langCode: string;
  readonly sentence: string;
  readonly translation?: string;
  readonly sourceLabel?: string;
  readonly videoId?: string;
  readonly cueIndex?: number;
  readonly cueStart?: number;
  /** Serializable subset of PopupCardCreatorPrefill (media bytes stripped). */
  readonly snapshot?: PopupCardCreatorPrefill;
}

export interface MiningQueueItem extends MiningQueueInput {
  readonly id: string;
  /** Normalized identity used for save dedupe (spec REQ-1/REQ-2 rules). */
  readonly dedupeKey: string;
  readonly createdAt: number;
}

/** Lean row returned by QUEUE_LIST — no lookupResult/media lists (spec §Data
 *  projection split keeps list payloads small at ≤500 items). */
export interface MiningQueueRow {
  readonly id: string;
  readonly kind: MiningQueueKind;
  readonly term?: string;
  readonly pos?: string;
  readonly sentence: string;
  readonly sourceLabel?: string;
  readonly cueStart?: number;
  readonly createdAt: number;
}

export const MINING_QUEUE_CAP = 500;
