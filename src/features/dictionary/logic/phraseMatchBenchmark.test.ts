import fs from 'node:fs';
import path from 'node:path';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  deserializePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';
import {
  matchPhrase,
  tokenizeSentence,
  type PhraseMatchRequest,
} from '@/features/dictionary/logic/phraseMatcher';
import type { PhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';

const TEST_VERBS = new Set([
  'be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick',
  'put', 'hit', 'come', 'look', 'get', 'start', 'go', 'make', 'do', 'have',
  'see', 'know', 'think', 'say', 'tell', 'find', 'call', 'try', 'ask', 'seem',
  'feel', 'leave', 'work', 'keep', 'let', 'begin', 'show', 'hear', 'play',
  'turn', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write',
  'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue',
  'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop',
  'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk',
  'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait',
  'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach',
  'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report', 'decide',
  'pull', 'return', 'explain', 'hope', 'develop', 'receive', 'agree', 'support',
  'produce', 'eat', 'cover', 'catch', 'draw', 'choose', 'point', 'save',
  'design', 'arrive', 'visit',
]);

function loadFixtureIndex(): { index: PhraseIndex; blob: ArrayBuffer; inputs: PhraseIndexInput[] } {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../data/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
  );
  const entries = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { term?: string }[];
  const seen = new Set<string>();
  const inputs: PhraseIndexInput[] = [];
  let nextId = 0;
  for (const e of entries) {
    const term = String(e.term ?? '').trim().normalize('NFC').toLowerCase();
    if (!term || term.split(/\s+/).length < 2 || seen.has(term)) continue;
    seen.add(term);
    const parsed = parsePhraseTemplate(term, { inflectableLiterals: TEST_VERBS });
    if (parsed.status !== 'supported') continue;
    inputs.push({
      templateId: nextId++,
      sourceTerm: parsed.sourceTerm,
      normalizedTerm: parsed.normalizedTerm,
      nodes: parsed.nodes,
      fixedTokenCount: parsed.fixedTokenCount,
      minSurfaceTokens: parsed.minSurfaceTokens,
      maxSurfaceTokens: parsed.maxSurfaceTokens,
      frequencyRank: 0,
    });
  }
  const index = compilePhraseIndex(inputs);
  const blob = serializePhraseIndex(index);
  return { index, blob, inputs };
}

describe('phraseMatch benchmark (ADR-037 §11)', () => {
  let fixture: { index: PhraseIndex; blob: ArrayBuffer; inputs: PhraseIndexInput[] };

  beforeAll(() => {
    fixture = loadFixtureIndex();
  }, 30000);

  it('compiles 34k terms in under 2s', () => {
    const start = performance.now();
    compilePhraseIndex(fixture.inputs);
    const elapsed = performance.now() - start;
    console.log(`compilePhraseIndex: ${elapsed.toFixed(1)}ms for ${fixture.inputs.length} terms`);
    expect(elapsed).toBeLessThan(2000);
  });

  it('serializes to under 8MB', () => {
    console.log(`blob size: ${(fixture.blob.byteLength / 1024 / 1024).toFixed(2)}MB`);
    expect(fixture.blob.byteLength).toBeLessThan(8 * 1024 * 1024);
  });

  it('deserializes in under 300ms', () => {
    const start = performance.now();
    deserializePhraseIndex(fixture.blob);
    const elapsed = performance.now() - start;
    console.log(`deserializePhraseIndex: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(300);
  });

  it('matches a simple phrase in under 30ms (P06: kick the bucket)', () => {
    const index = fixture.index;
    const request: PhraseMatchRequest = {
      sentence: 'The old man kicked the bucket.',
      cursorOffset: 12, // "kicked"
    };
    // Warm up.
    matchPhrase(request, index);
    const start = performance.now();
    const result = matchPhrase(request, index);
    const elapsed = performance.now() - start;
    console.log(`matchPhrase (kick the bucket): ${elapsed.toFixed(2)}ms, match=${result?.dictionaryTerm ?? 'null'}`);
    // Latency budget for a 34k-template fixture with high-frequency anchors
    // ('the' has 1137 postings). Candidate cap + anchor-overlap sort is
    // O(candidates × anchors) — still well under 30ms.
    expect(elapsed).toBeLessThan(30);
  });

  it('matches a complex phrase in under 30ms (P01: be (right) under your nose)', () => {
    const index = fixture.index;
    // Ensure the template is in the index.
    const request: PhraseMatchRequest = {
      sentence: 'The answer was right under my nose.',
      cursorOffset: 11,
    };
    const start = performance.now();
    const result = matchPhrase(request, index);
    const elapsed = performance.now() - start;
    console.log(`matchPhrase (be under your nose): ${elapsed.toFixed(2)}ms, result=${result?.dictionaryTerm ?? 'null'}`);
    // This may not match if the fixture doesn't contain this exact template.
    // The benchmark is about latency, not correctness here.
    expect(elapsed).toBeLessThan(30);
  });

  it('returns null quickly for a sentence with no phrase (under 30ms)', () => {
    const index = fixture.index;
    const request: PhraseMatchRequest = {
      sentence: 'The quick brown fox jumps over the lazy dog.',
      cursorOffset: 4,
    };
    const start = performance.now();
    matchPhrase(request, index);
    const elapsed = performance.now() - start;
    console.log(`matchPhrase (no match): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(30);
  });

  it('tokenizes a 50-word sentence in under 1ms', () => {
    const sentence = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ') + '.';
    const start = performance.now();
    tokenizeSentence(sentence);
    const elapsed = performance.now() - start;
    console.log(`tokenizeSentence (50 words): ${elapsed.toFixed(3)}ms`);
    expect(elapsed).toBeLessThan(1);
  });
});
