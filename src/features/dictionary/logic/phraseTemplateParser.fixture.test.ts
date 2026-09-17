import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';

interface CambridgeEntry {
  readonly term?: string;
}

const fullFixture = process.env.CELL_FIXTURE_FULL === '1';
const fixturePath = path.resolve(
  __dirname,
  fullFixture
    ? '../../../../data/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json'
    : '../../../../tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
);
const FIXTURE_MISSING = fullFixture && !existsSync(fixturePath);
if (FIXTURE_MISSING) {
  console.warn('[fixture] full Cambridge fixture missing — run without CELL_FIXTURE_FULL or restore data/resource/');
}

function loadMultiwordTerms(): string[] {
  const entries = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as CambridgeEntry[];
  return [...new Set(
    entries
      .map((entry) => String(entry.term ?? '').trim().normalize('NFC').toLowerCase())
      .filter((term) => term && term.split(/\s+/).length >= 2),
  )];
}

(FIXTURE_MISSING ? describe.skip : describe)('phraseTemplateParser Cambridge fixture', () => {
  it('compiles every normalized multiword term without throwing', () => {
    const terms = loadMultiwordTerms();
    const results = terms.map((term) => parsePhraseTemplate(term));
    const counts = results.reduce<Record<string, number>>((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(terms.length).toBeGreaterThan(1000);
    expect(counts.unsupportedMalformed ?? 0).toBe(0);
    expect(counts.unsupportedOpen ?? 0).toBeGreaterThan(0);
    expect(counts.supported ?? 0).toBeGreaterThan(terms.length * 0.8);
    expect(parsePhraseTemplate('a (quick/brisk) trot through sth').status).toBe('supported');
    expect(parsePhraseTemplate('a nip (here) and a tuck (there)').status).toBe('supported');
    expect(parsePhraseTemplate('A/B/C share').status).toBe('supported');
  });
});
