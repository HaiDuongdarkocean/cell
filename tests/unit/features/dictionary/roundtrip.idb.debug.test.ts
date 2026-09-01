import 'fake-indexeddb/auto';
import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import {
  serializePhraseIndex,
  deserializePhraseIndex,
  compilePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';
import { putPhraseIndex, getPhraseIndex } from '@/features/dictionary/repositories/phraseIndexRepository';

describe('DEBUG IDB roundtrip full Cambridge fixture', () => {
  beforeEach(() => {
    closeAllDBs();
  });
  beforeEach(async () => {
    await clearAllStores('en');
  });

  const fixturePath = path.resolve(
    __dirname,
    '../../../../tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
  );
  const FIXTURE_EXISTS = existsSync(fixturePath);

  (FIXTURE_EXISTS ? it : it.skip)('builds, stores, retrieves and deserializes without throwing', async () => {
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
    await putPhraseIndex('en', 1, buffer, { compilerVersion: index.compilerVersion, termCount: index.termCount });
    const stored = await getPhraseIndex('en', 1);
    expect(stored).toBeDefined();
    expect(stored!.blob.byteLength).toBe(buffer.byteLength);

    const restored = deserializePhraseIndex(stored!.blob);
    expect(restored.termCount).toBe(index.termCount);
  }, 30000);
});
