// Manual test CLI: npx tsx _manual_test_multi.ts "sentence" "targetWord"
//
// Tests lookupOrchestratorMulti — returns ALL phrase match candidates.
// Seeds Cambridge dictionary + phrase index into fake-indexeddb, then calls
// the real orchestrator. Prints each candidate's term + definition count.
//
// Examples:
//   npx tsx _manual_test_multi.ts "I couldn't open the door to get out," "get"
//   npx tsx _manual_test_multi.ts "Take off your shoes." "Take"
//   npx tsx _manual_test_multi.ts "He burned off the excess fuel." "burned"

import 'fake-indexeddb/auto';
import * as fs from 'node:fs';
import { lookupOrchestratorMulti } from './src/features/dictionaryPopup/logic/lookupOrchestrator';
import { closeAllDBs, clearAllStores } from './src/features/dictionary/repositories/baseRepository';
import { addResource } from './src/features/dictionary/repositories/resourceRepository';
import { addDictionaryEntry, bulkInsertDictionaryEntries } from './src/features/dictionary/repositories/dictionaryRepository';
import { putPhraseIndex } from './src/features/dictionary/repositories/phraseIndexRepository';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  type PhraseIndexInput,
} from './src/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from './src/features/dictionary/logic/phraseTemplateParser';
import { tokenizeSentence } from './src/features/dictionary/logic/phraseMatcher';

// --- Chrome stub ---
global.chrome = {
  storage: {
    local: {
      get: (_keys: string | string[] | null) => Promise.resolve({}),
      set: (_items: Record<string, unknown>) => Promise.resolve(),
    },
  },
} as unknown as typeof chrome;

// --- Build index from Cambridge JSON ---
function buildIndexInputs(): PhraseIndexInput[] {
  const data = JSON.parse(
    fs.readFileSync('tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json', 'utf8'),
  );
  const terms = new Set<string>();
  for (const e of data) {
    if (e.term && e.term.includes(' ')) terms.add(e.term);
    if (e.altterm && e.altterm.includes(' ')) terms.add(e.altterm);
  }
  const firstWords = new Set<string>();
  for (const term of terms) {
    const w = term.trim().toLowerCase().split(/\s+/)[0];
    if (w) firstWords.add(w);
  }
  const inputs: PhraseIndexInput[] = [];
  let id = 0;
  const seen = new Set<string>();
  for (const term of terms) {
    const normalized = term.trim().normalize('NFC').toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const parsed = parsePhraseTemplate(term, { inflectableLiterals: firstWords });
    if (parsed.status !== 'supported') continue;
    inputs.push({
      templateId: id++,
      sourceTerm: parsed.sourceTerm,
      normalizedTerm: parsed.normalizedTerm,
      nodes: parsed.nodes,
      fixedTokenCount: parsed.fixedTokenCount,
      minSurfaceTokens: parsed.minSurfaceTokens,
      maxSurfaceTokens: parsed.maxSurfaceTokens,
      frequencyRank: 0,
    });
  }
  return inputs;
}

// --- Seed dictionary entries for matched terms ---
function seedDictionaryEntries(data: unknown[], terms: string[], resourceId: number): void {
  const termSet = new Set(terms.map(t => t.toLowerCase()));
  for (const e of data as Array<{ term: string; definition?: string; pos?: string; pronunciation?: string; examples?: string }>) {
    if (!e.term) continue;
    if (!termSet.has(e.term.toLowerCase())) continue;
    addDictionaryEntry('en', resourceId, {
      term: e.term,
      definition: e.definition || '',
      pos: e.pos || '',
      pronunciation: e.pronunciation || '',
      reading: '',
      examples: e.examples || '',
    });
  }
}

// --- Main ---
const sentence = process.argv[2];
const target = process.argv[3];

if (!sentence) {
  console.log('Usage: npx tsx _manual_test_multi.ts "sentence" "targetWord"');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx _manual_test_multi.ts "I could not open the door to get out," "get"');
  console.log('  npx tsx _manual_test_multi.ts "Take off your shoes." "Take"');
  process.exit(1);
}

async function main() {
  await clearAllStores();

  console.error('Đang load Cambridge dictionary...');
  const data = JSON.parse(
    fs.readFileSync('tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json', 'utf8'),
  );

  // Build + store phrase index
  const inputs = buildIndexInputs();
  const index = compilePhraseIndex(inputs);
  const blob = serializePhraseIndex(index);

  const resourceId = await addResource('en', { type: 'DICTIONARY', name: 'Cambridge Test', format: 'cambridge-json' });
  await putPhraseIndex('en', resourceId, blob, { compilerVersion: 2, termCount: inputs.length });

  // Seed ALL dictionary entries (for definitions to show up)
  const entries = (data as Array<{ term: string; definition?: string; pos?: string; pronunciation?: string; examples?: string }>)
    .filter(e => e.term);
  const batchSize = 500;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize).map(e => ({
      term: e.term,
      definition: e.definition || '',
      pos: e.pos || '',
      pronunciation: e.pronunciation || '',
      reading: '',
      examples: e.examples || '',
    }));
    await bulkInsertDictionaryEntries('en', batch);
  }

  console.error(`Đã load ${inputs.length} templates, ${data.length} dict entries.\n`);

  // Find cursor offset for target word
  const tokens = tokenizeSentence(sentence);
  let cursorOffset = 0;
  if (target) {
    const targetLower = target.toLowerCase();
    const matchToken = tokens.find(t => t.text === targetLower)
      || tokens.find(t => t.text.startsWith(targetLower) || t.raw.toLowerCase().startsWith(targetLower));
    if (!matchToken) {
      console.log(`Không tìm thấy token "${target}" trong sentence.`);
      console.log(`Tokens: ${tokens.map(t => `"${t.raw}"`).join(', ')}`);
      process.exit(0);
    }
    cursorOffset = matchToken.start;
    console.log(`Sentence: "${sentence}"`);
    console.log(`Hover: "${matchToken.raw}" (offset=${cursorOffset})\n`);
  } else {
    // Default: hover first token
    cursorOffset = tokens[0]?.start ?? 0;
    console.log(`Sentence: "${sentence}"`);
    console.log(`Hover: "${tokens[0]?.raw}" (offset=${cursorOffset})\n`);
  }

  // Call multi-candidate orchestrator
  const results = await lookupOrchestratorMulti({
    term: target || tokens[0]?.text || '',
    langCode: 'en',
    contextSentence: sentence,
    cursorOffset,
  });

  console.log(`=== ${results.length} candidate(s) ===\n`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const label = i === 0 ? 'WINNER' : `CANDIDATE ${i}`;
    console.log(`[${label}] term: "${r.term}"`);
    console.log(`  matchSource: ${r.matchSource}`);
    console.log(`  detectedPhrase: ${r.detectedPhrase ? `"${r.detectedPhrase.dictionaryTerm}" (surface: "${r.detectedPhrase.surface}")` : 'null'}`);
    console.log(`  reading: "${r.reading || '(none)'}"`);
    console.log(`  definitions: ${r.definitions.length}`);
    if (r.definitions.length > 0) {
      console.log(`  first def: "${r.definitions[0]!.text.slice(0, 80)}${r.definitions[0]!.text.length > 80 ? '...' : ''}"`);
    }
    console.log(`  partsOfSpeech: [${r.partsOfSpeech.join(', ')}]`);
    console.log('');
  }

  await closeAllDBs();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
