// Manual test CLI: npx tsx _manual_test.ts "sentence" "targetWord"
//
// Nếu không truyền targetWord → hover ALL tokens.
// Nếu truyền targetWord → hover chỉ word đó.
//
// Examples:
//   npx tsx _manual_test.ts "I couldn't open the door to get out," "get"
//   npx tsx _manual_test.ts "Think hard, sir." "Think"
//   npx tsx _manual_test.ts "This looks expensive." "look"
//   npx tsx _manual_test.ts "Are you kidding me right now?"

import * as fs from 'node:fs';
import {
  matchPhrase,
  tokenizeSentence,
} from './src/features/dictionary/logic/phraseMatcher';
import {
  compilePhraseIndex,
  type PhraseIndexInput,
} from './src/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from './src/features/dictionary/logic/phraseTemplateParser';

// --- Build index from Cambridge JSON ---
function buildIndex() {
  const data = JSON.parse(
    fs.readFileSync('tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json', 'utf8'),
  );
  const terms = new Set<string>();
  for (const e of data) {
    if (e.term && e.term.includes(' ')) terms.add(e.term);
    if (e.altterm && e.altterm.includes(' ')) terms.add(e.altterm);
  }
  // Auto-collect first words as inflectable (data-driven, same as phraseIndexBuilder)
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
  return compilePhraseIndex(inputs);
}

// --- Main ---
const sentence = process.argv[2];
const target = process.argv[3];

if (!sentence) {
  console.log('Usage: npx tsx _manual_test.ts "sentence" "targetWord"');
  console.log('  If targetWord omitted → hover ALL tokens');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx _manual_test.ts "I could not open the door to get out," "get"');
  console.log('  npx tsx _manual_test.ts "Think hard, sir." "Think"');
  console.log('  npx tsx _manual_test.ts "This looks expensive." "look"');
  process.exit(1);
}

console.error('Đang load Cambridge dictionary...');
const index = buildIndex();
console.error(`Đã load ${index.templates.length} templates.\n`);

const tokens = tokenizeSentence(sentence);

console.log(`Sentence: "${sentence}"`);
console.log(`Tokens (${tokens.length}):`);
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i]!;
  const flags: string[] = [];
  if (t.precededBySentencePunct) flags.push('SENT');
  if (t.precededByClausePunct) flags.push('CLAUSE');
  const flagStr = flags.length > 0 ? `  ← ${flags.join('+')}` : '';
  console.log(`  [${i}] "${t.raw}"${flagStr}`);
}

console.log('');

if (target) {
  // Hover specific word
  const targetLower = target.toLowerCase();
  let matchToken = tokens.find(t => t.text === targetLower);
  if (!matchToken) {
    matchToken = tokens.find(t => t.text.startsWith(targetLower) || t.raw.toLowerCase().startsWith(targetLower));
  }

  if (!matchToken) {
    console.log(`Không tìm thấy token "${target}" trong sentence.`);
    const similar = tokens.filter(t => t.text.includes(targetLower) || targetLower.includes(t.text));
    if (similar.length > 0) {
      console.log(`Có phải anh muốn hover: ${similar.map(t => `"${t.raw}"`).join(', ')}?`);
    }
    process.exit(0);
  }

  const r = matchPhrase({ sentence, cursorOffset: matchToken.start }, index);
  console.log(`hover "${matchToken.raw}" (offset=${matchToken.start}):`);
  if (r) {
    console.log(`  → dictionaryTerm: "${r.dictionaryTerm}"`);
    console.log(`  → surface:        "${r.surface}"`);
    console.log(`  → quality:        ${r.quality}`);
    console.log(`  → span:           ${r.span.start}-${r.span.end}`);
  } else {
    console.log(`  → null (không match)`);
  }
} else {
  // Hover ALL tokens
  console.log('--- Hover ALL tokens ---');
  let matchCount = 0;
  for (const t of tokens) {
    const r = matchPhrase({ sentence, cursorOffset: t.start }, index);
    if (r) {
      matchCount++;
      console.log(`  "${t.raw}" → "${r.dictionaryTerm}"`);
      console.log(`    surface: "${r.surface}"  quality: ${r.quality}`);
    } else {
      console.log(`  "${t.raw}" → null`);
    }
  }
  console.log(`\n${matchCount}/${tokens.length} tokens có match.`);
}
