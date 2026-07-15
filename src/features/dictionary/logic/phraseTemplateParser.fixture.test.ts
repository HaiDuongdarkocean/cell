import fs from 'node:fs';
import path from 'node:path';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';

interface CambridgeEntry {
  readonly term?: string;
}

const fixturePath = path.resolve(
  __dirname,
  '../../../../tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
);

function loadMultiwordTerms(): string[] {
  const entries = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as CambridgeEntry[];
  return [...new Set(
    entries
      .map((entry) => String(entry.term ?? '').trim().normalize('NFC').toLowerCase())
      .filter((term) => term && term.split(/\s+/).length >= 2),
  )];
}

describe('phraseTemplateParser Cambridge fixture', () => {
  it('compiles every normalized multiword term without throwing', () => {
    const terms = loadMultiwordTerms();
    const results = terms.map((term) => parsePhraseTemplate(term));
    const counts = results.reduce<Record<string, number>>((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(terms).toHaveLength(34094);
    expect(counts.unsupportedMalformed ?? 0).toBe(0);
    expect(counts.unsupportedOpen).toBeGreaterThan(0);
    expect(counts.supported).toBeGreaterThan(30000);
    expect(parsePhraseTemplate('a (quick/brisk) trot through sth').status).toBe('supported');
    expect(parsePhraseTemplate('a nip (here) and a tuck (there)').status).toBe('supported');
    expect(parsePhraseTemplate('A/B/C share').status).toBe('supported');
  });
});
