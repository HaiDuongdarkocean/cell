import { readFileSync } from 'node:fs';
import { parsePhraseTemplate } from './phraseTemplateParser';
import { compilePhraseIndex } from './phraseIndexCompiler';
import { matchPhraseAll } from './phraseMatcher';
import { serializeNodes } from './serializeNodes';

const DICT_PATH =
  'C:/Users/The0cean/Programming/The0cean ecosystem/cell/data/resource/en/dictionary/normalized/LDOCE5pp.normalized.json';

describe('LDOCE diagnostics', () => {
  it('put all eggs in one basket', () => {
    const raw = JSON.parse(readFileSync(DICT_PATH, 'utf8')) as { term?: string }[];
    const inputs = [];
    const firstWords = new Set<string>();
    for (const e of raw) {
      const t = (e.term ?? '').trim().toLowerCase();
      if (!t || t.split(/\s+/).length < 2) continue;
      firstWords.add(t.split(/\s+/)[0]!);
    }
    for (const e of raw) {
      const term = (e.term ?? '').trim();
      if (!term || term.split(/\s+/).length < 2) continue;
      const r = parsePhraseTemplate(term, { inflectableLiterals: firstWords });
      if (r.status !== 'supported') continue;
      inputs.push({
        templateId: inputs.length,
        sourceTerm: r.sourceTerm,
        normalizedTerm: r.normalizedTerm,
        nodes: r.nodes,
        fixedTokenCount: r.fixedTokenCount,
        minSurfaceTokens: r.minSurfaceTokens,
        maxSurfaceTokens: r.maxSurfaceTokens,
        frequencyRank: 0,
      });
    }
    const index = compilePhraseIndex(inputs);
    console.log(`indexed=${index.termCount}`);

    const sentence = "Put all one's eggs in one basket";
    for (const hover of ['put', 'all', 'eggs', 'basket']) {
      const cursorOffset = sentence.toLowerCase().indexOf(hover);
      matchPhraseAll({ sentence, cursorOffset }, index, 0, (t) => {
        console.log(`\n=== hover "${hover}" @${cursorOffset} → candidates=${t.candidateTemplateIds.length}`);
        for (const c of t.perCandidate.slice(0, 15)) {
          console.log(`  ${c.sourceTerm} | ${c.nodesStructure} | rejected=${c.rejected}`);
        }
        for (const r of t.ranked.slice(0, 5)) {
          console.log(`  RANKED ${r.dictionaryTerm} | "${r.surface}"`);
        }
      });
    }

    for (const t of index.templates) {
      if (/eggs in one basket/.test(t.sourceTerm)) {
        console.log(`TPL ${t.sourceTerm} | anchors=${t.anchors.join(',')} | ${serializeNodes(t.nodes)}`);
      }
    }
  }, 120_000);
});
