/** Sentence-breakdown answer parser — the prompt contract produces <chunk>
 *  elements with <text>/<meaning>/<explanation> fields. XML tags survive model
 *  variance far better than ad-hoc numbering and each closed block parses
 *  mid-stream. Older saved prompts still emit `#1/#2/#3` triplets — the
 *  numbered fallback keeps them working. Fewer than minChunks → unparseable. */

export interface BreakdownChunk {
  readonly text: string;
  readonly meaning?: string;
  readonly explanation?: string;
}

const NUMBER_RE = /#(\d+)\s*[:.)-]?\s*|(?:^|(?<=\n))\s*(\d{1,2})\s*[.:)]?\s+/g;
const LABEL_RE = /^(Chunk|Meaning|Explanation)\s*[:：]\s*/i;
const FIELD_RE = (name: string): RegExp =>
  new RegExp(`<${name}[^>]*>([\\s\\S]*?)(?:<\\/${name}>|<\\/?(?:text|meaning|explanation|chunk)[^>]*>|$)`, 'i');

function clean(segment: string): string {
  return segment.replace(LABEL_RE, '').trim().replace(/\s*[;,]\s*$/, '');
}

function field(section: string, name: string): string | undefined {
  const v = clean(FIELD_RE(name).exec(section)?.[1] ?? '');
  return v || undefined;
}

function parseXmlChunks(answer: string): BreakdownChunk[] {
  if (!/<chunk[\s>]/i.test(answer)) return [];
  const chunks: BreakdownChunk[] = [];
  for (const section of answer.split(/<chunk[^>]*>/i).slice(1)) {
    const text = field(section, 'text');
    if (text) chunks.push({ text, meaning: field(section, 'meaning'), explanation: field(section, 'explanation') });
  }
  return chunks;
}

function parseNumberedChunks(answer: string): BreakdownChunk[] {
  const marks = [...answer.matchAll(NUMBER_RE)];
  const chunks: BreakdownChunk[] = [];
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
  return chunks;
}

export function parseBreakdown(answer: string, minChunks = 2): BreakdownChunk[] {
  const chunks = parseXmlChunks(answer);
  if (chunks.length >= minChunks) return chunks;
  const numbered = parseNumberedChunks(answer);
  return numbered.length >= Math.max(minChunks, chunks.length) ? numbered : chunks;
}
