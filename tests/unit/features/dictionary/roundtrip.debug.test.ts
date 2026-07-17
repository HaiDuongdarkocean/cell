import fs from 'node:fs';
import path from 'node:path';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  deserializePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';

describe('DEBUG roundtrip full Cambridge fixture', () => {
  it('serializes and deserializes without throwing', () => {
    const fixturePath = path.resolve(
      __dirname,
      '../../../../tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
    );
    const entries = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { term?: string }[];
    const seen = new Set<string>();
    const inputs: PhraseIndexInput[] = [];
    let nextId = 0;
    for (const e of entries) {
      const term = String(e.term ?? '').trim().normalize('NFC').toLowerCase();
      if (!term || term.split(/\s+/).length < 2 || seen.has(term)) continue;
      seen.add(term);
      const parsed = parsePhraseTemplate(term);
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
    const buffer = serializePhraseIndex(index);
    const restored = deserializePhraseIndex(buffer);

    expect(restored.termCount).toBe(index.termCount);
    expect(restored.templates.length).toBe(index.templates.length);
  }, 30000);
});
