/** Sentence-breakdown answer parser — the prompt contract produces numbered
 *  triplets (`#1 chunk, #2 reworded meaning, #3 explanation`), so every third
 *  segment is one chunk. Providers that leak labels get them stripped; output
 *  that yields fewer than two chunks is treated as unparseable and rendered
 *  as plain text by the caller. */

export interface BreakdownChunk {
  readonly text: string;
  readonly meaning?: string;
  readonly explanation?: string;
}

const NUMBER_RE = /#\d+\s*[:.)-]?\s*/g;
const LABEL_RE = /^(Chunk|Meaning|Explanation)\s*[:：]\s*/i;

function clean(segment: string): string {
  return segment.replace(LABEL_RE, '').trim();
}

export function parseBreakdown(answer: string): BreakdownChunk[] {
  const segments = answer
    .split(NUMBER_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return [];
  const chunks: BreakdownChunk[] = [];
  for (let i = 0; i < segments.length; i += 3) {
    const text = clean(segments[i] ?? '');
    if (!text) continue;
    chunks.push({
      text,
      meaning: clean(segments[i + 1] ?? '') || undefined,
      explanation: clean(segments[i + 2] ?? '') || undefined,
    });
  }
  return chunks.length >= 2 ? chunks : [];
}
