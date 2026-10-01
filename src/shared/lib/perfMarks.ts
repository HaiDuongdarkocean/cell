import { isDevMode } from '@/shared/lib/env/devMode';
import { isCellDebug } from '@/shared/lib/cellDebug';

function active(): boolean {
  return isDevMode || isCellDebug();
}

const LOOKUP_POINTS = ['dispatch', 'response', 'render'] as const;
const AUDIO_POINTS = ['start', 'applied', 'render'] as const;

export function markLookup(point: (typeof LOOKUP_POINTS)[number], requestId: string): void {
  if (active()) performance.mark(`cell:lookup:${point}:${requestId}`);
}

export function markAudio(point: (typeof AUDIO_POINTS)[number], term: string): void {
  if (active()) performance.mark(`cell:audio:${point}:${term}`);
}

function measure(name: string, from: string, to: string): void {
  try {
    const entry = performance.measure(name, from, to);
    console.debug(`[perf] ${name}: ${entry.duration.toFixed(1)}ms`);
  } catch {
    // Missing start/end mark (aborted path, gate flipped mid-flight) — skip silently.
  }
}

export function measureLookup(
  from: (typeof LOOKUP_POINTS)[number],
  to: (typeof LOOKUP_POINTS)[number],
  requestId: string,
): void {
  if (!active()) return;
  measure(`cell:lookup:${from}→${to}:${requestId}`, `cell:lookup:${from}:${requestId}`, `cell:lookup:${to}:${requestId}`);
}

export function measureAudio(
  from: (typeof AUDIO_POINTS)[number],
  to: (typeof AUDIO_POINTS)[number],
  term: string,
): void {
  if (!active()) return;
  measure(`cell:audio:${from}→${to}:${term}`, `cell:audio:${from}:${term}`, `cell:audio:${to}:${term}`);
}

export function clearLookupMarks(requestId: string): void {
  if (!active()) return;
  for (const point of LOOKUP_POINTS) performance.clearMarks(`cell:lookup:${point}:${requestId}`);
}

export function clearAudioMarks(term: string): void {
  if (!active()) return;
  for (const point of AUDIO_POINTS) performance.clearMarks(`cell:audio:${point}:${term}`);
}
