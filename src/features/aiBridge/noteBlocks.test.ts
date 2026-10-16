import { describe, expect, it } from '@jest/globals';
import { formatAiNoteBlocks, mergeAiNoteBlocks, type AiNoteAnswer } from './noteBlocks';

const explain: AiNoteAnswer = { feature: 'wordExplain', provider: 'chatgpt', text: 'nuance: casual tone' };
const breakdown: AiNoteAnswer = { feature: 'sentenceBreakdown', provider: 'gemini', text: '#1 chunk' };

describe('formatAiNoteBlocks', () => {
  it('formats one labeled block per answer', () => {
    const note = formatAiNoteBlocks([explain, breakdown]);
    expect(note).toBe('AI Explain (ChatGPT):\nnuance: casual tone\n\nAI Breakdown (Gemini):\n#1 chunk');
  });

  it('returns empty string for no answers', () => {
    expect(formatAiNoteBlocks([])).toBe('');
  });
});

describe('mergeAiNoteBlocks', () => {
  it('appends to an existing note without touching user text', () => {
    const merged = mergeAiNoteBlocks('my note', [explain]);
    expect(merged).toBe('my note\n\nAI Explain (ChatGPT):\nnuance: casual tone');
  });

  it('replaces the stale block for the same feature, keeps others', () => {
    const note = 'user line\n\nAI Explain (ChatGPT):\nold\n\nAI Breakdown (Gemini):\n#1 chunk';
    const next: AiNoteAnswer = { feature: 'wordExplain', provider: 'claude', text: 'new take' };
    expect(mergeAiNoteBlocks(note, [next])).toBe(
      'user line\n\nAI Explain (Claude):\nnew take\n\nAI Breakdown (Gemini):\n#1 chunk',
    );
  });

  it('is idempotent — merging the same answers twice changes nothing', () => {
    const once = mergeAiNoteBlocks('my note', [explain, breakdown]);
    expect(mergeAiNoteBlocks(once, [explain, breakdown])).toBe(once);
  });

  it('starts a fresh block set on an empty note', () => {
    expect(mergeAiNoteBlocks('', [explain])).toBe('AI Explain (ChatGPT):\nnuance: casual tone');
  });
});
