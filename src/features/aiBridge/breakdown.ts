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

const NUMBER_RE = /#(\d+)\s*[:.)-]?\s*|(?:^|(?<=\n))\s*(\d{1,2})\s*[.:)]?\s+/g;
const LABEL_RE = /^(Chunk|Meaning|Explanation)\s*[:：]\s*/i;

function clean(segment: string): string {
  return segment.replace(LABEL_RE, '').trim().replace(/\s*[;,]\s*$/, '');
}

export function parseBreakdown(answer: string, minChunks = 2): BreakdownChunk[] {
  const marks = [...answer.matchAll(NUMBER_RE)];
  const chunks: { text: string; meaning?: string; explanation?: string }[] = [];
  let current: { text: string; meaning?: string; explanation?: string } | null = null;
  for (let i = 0; i < marks.length; i++) {
    const n = Number(marks[i][1] ?? marks[i][2]);
    const text = answer.slice(
      marks[i].index + marks[i][0].length,
      i + 1 < marks.length ? marks[i + 1].index : undefined,
    );
    const role = ((n - 1) % 3) + 1;
    if (role === 1 || !current) {
      if (current?.text) chunks.push(current);
      current = { text: clean(text) };
      continue;
    }
    if (role === 2) current.meaning = clean(text);
    else current.explanation = clean(text);
  }
  if (current?.text) chunks.push(current);
  return chunks.length >= minChunks ? chunks : [];
}
