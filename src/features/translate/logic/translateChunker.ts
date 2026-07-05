/**
 * Translate chunker — split cue indices into chunks by character budget (ADR-021 D3).
 *
 * Pure function: takes cues + indices + budget → returns array of index groups,
 * each group's total text length ≤ budget. Sequential translation processes one
 * chunk at a time (1.5s gap between requests, ADR-021 D4).
 */

import type { SrtCue } from '@/entities/media';

/**
 * Chunk cue indices by character budget.
 *
 * Walks `indices` in order, accumulating into the current chunk until adding the
 * next cue would exceed `charBudget`. Then starts a new chunk. A single cue
 * longer than budget forms its own chunk (no splitting — Google handles long
 * segments, but we keep chunks ≤ budget for normal cases).
 *
 * @param cues - Full cue array (indexed by `indices`).
 * @param indices - Ordered cue indices to chunk (e.g. [0,1,2,...,n] or seek range).
 * @param charBudget - Max total text length per chunk (default 1500, ADR-021 D3).
 * @returns Array of index groups, each group's total text ≤ charBudget (except
 *          single-cue chunks that exceed budget).
 */
export function chunkCuesByCharBudget(
  cues: readonly SrtCue[],
  indices: readonly number[],
  charBudget: number = 1500,
): number[][] {
  if (indices.length === 0) return [];

  const chunks: number[][] = [];
  let current: number[] = [];
  let chars = 0;

  for (const i of indices) {
    const cue = cues[i];
    if (!cue) continue;
    const cueChars = cue.text.length;

    // If current chunk is non-empty and adding this cue exceeds budget,
    // flush current chunk and start a new one.
    if (current.length > 0 && chars + cueChars > charBudget) {
      chunks.push(current);
      current = [];
      chars = 0;
    }

    current.push(i);
    chars += cueChars;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Build a sequential index range [start, end) for prefill from a given cue.
 *
 * @param totalCues - Total number of cues in the track.
 * @param startIdx - Start index (inclusive). Default 0 (prefill from beginning).
 * @returns Array of indices [startIdx, startIdx+1, ..., totalCues-1].
 */
export function buildSequentialIndices(
  totalCues: number,
  startIdx: number = 0,
): number[] {
  if (totalCues === 0 || startIdx >= totalCues) return [];
  const indices: number[] = [];
  for (let i = Math.max(0, startIdx); i < totalCues; i++) {
    indices.push(i);
  }
  return indices;
}
