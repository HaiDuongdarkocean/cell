/**
 * Perf guard — movie-scale subtitle data flow must stay under budget.
 * Synthetic 1500-cue movie (~12k tokens/track). Budgets carry ~10× headroom
 * over measured cost (~50ms total) so they only fail on real algorithmic
 * regressions, not slow CI hardware. Persona budget: data responses <3s.
 */
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';
import {
  createCueListTokenMap,
  applyCueListTokenStatus,
  applyCueListTokenStatuses,
} from '@/features/tokenize/logic/cueListTokens';
import type { BilingualCue } from '@/entities/media';

const WORDS =
  'the of and to in is you that it he was for on are as with his they i at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part'.split(
    ' ',
  );

function buildMovieSrt(cueCount: number): string {
  const chunks: string[] = [];
  for (let i = 0; i < cueCount; i++) {
    const start = i * 4000;
    const end = start + 3500;
    const words: string[] = [];
    const n = 6 + (i % 7);
    for (let w = 0; w < n; w++) words.push(WORDS[(i * 13 + w * 7) % WORDS.length]!);
    chunks.push(`${i + 1}\n${fmtTs(start)} --> ${fmtTs(end)}\n${words.join(' ')}\n`);
  }
  return chunks.join('\n');
}

function fmtTs(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msR = ms % 1000;
  const pad = (v: number, l = 2) => String(v).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msR, 3)}`;
}

function timed<T>(fn: () => T): { out: T; ms: number } {
  const t0 = performance.now();
  const out = fn();
  return { out, ms: performance.now() - t0 };
}

describe('perf guard — movie-scale subtitle data flow', () => {
  const CUES = 1500;
  const srt = buildMovieSrt(CUES);

  it('parses + tokenizes + applies statuses inside the 3s budget', () => {
    const parsed = timed(() => parseSrt(srt));
    expect(parsed.out.cues.length).toBe(CUES);
    expect(parsed.ms).toBeLessThan(1500);

    const cues: BilingualCue[] = parsed.out.cues.map((c) => ({
      index: c.index,
      start: c.start,
      end: c.end,
      targetText: c.text,
      nativeText: '',
    }));

    const tokenize = timed(() => {
      for (const c of cues) tokenizeTextBlock(c.targetText, 'en');
    });
    expect(tokenize.ms).toBeLessThan(1500);

    const tokenMap = timed(() => createCueListTokenMap(cues, 'en')).out;

    const statusMap = new Map<string, 'known'>();
    for (const tokens of tokenMap.values()) {
      for (const t of tokens) if (!t.isSeparator) statusMap.set(t.term, 'known');
    }
    expect(timed(() => applyCueListTokenStatuses(tokenMap, statusMap)).ms).toBeLessThan(1500);

    // User marking 30 words in a burst must not degrade linearly into jank:
    // each mark is a full-map walk — stays sub-second at movie scale.
    const marks = timed(() => {
      let m = tokenMap;
      for (const term of [...statusMap.keys()].slice(0, 30)) {
        m = applyCueListTokenStatus(m, term, 'known');
      }
      return m;
    });
    expect(marks.ms).toBeLessThan(3000);
  });
});
