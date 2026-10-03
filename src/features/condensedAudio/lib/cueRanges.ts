import type { CueRange } from '@/entities/condensedAudio';

export function displayableCueRanges(
  cues: readonly { start: number; end: number; text: string }[],
): CueRange[] {
  return cues
    .filter((c) => c.text.trim().length > 0)
    .map((c) => ({ startMs: c.start, endMs: c.end }));
}

export function normalizeCueRanges(
  ranges: readonly CueRange[],
  padMs: number,
  durationMs: number,
): CueRange[] {
  const pad = Math.max(0, padMs);
  const sorted = ranges
    .filter((r) => r.endMs > r.startMs)
    .map((r) => ({
      startMs: Math.max(0, Math.floor(r.startMs) - pad),
      endMs: Math.min(durationMs > 0 ? durationMs : Number.MAX_SAFE_INTEGER, Math.ceil(r.endMs) + pad),
    }))
    .filter((r) => r.endMs > r.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const merged: CueRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.startMs <= last.endMs) {
      merged[merged.length - 1] = { startMs: last.startMs, endMs: Math.max(last.endMs, range.endMs) };
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function rangesTotalMs(ranges: readonly CueRange[]): number {
  return ranges.reduce((sum, r) => sum + Math.max(0, r.endMs - r.startMs), 0);
}

const ATRIM_MAX_RANGES = 400;

export function buildCondenseFilter(ranges: readonly CueRange[]): string {
  const parts: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < ranges.length; i += 1) {
    const r = ranges[i]!;
    const startSec = (r.startMs / 1000).toFixed(3);
    const endSec = (r.endMs / 1000).toFixed(3);
    parts.push(`[0:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[a${i}]`);
    labels.push(`[a${i}]`);
  }
  parts.push(`${labels.join('')}concat=n=${ranges.length}:v=0:a=1[out]`);
  return parts.join(';');
}

export function chunkRanges(ranges: readonly CueRange[], maxPerChunk = ATRIM_MAX_RANGES): CueRange[][] {
  const chunks: CueRange[][] = [];
  for (let i = 0; i < ranges.length; i += maxPerChunk) {
    chunks.push(ranges.slice(i, i + maxPerChunk));
  }
  return chunks;
}
