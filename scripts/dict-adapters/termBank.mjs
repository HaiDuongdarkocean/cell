// Term-bank zip reader — index.json + term_bank_*.json rows.

import { strFromU8 } from 'fflate';

export function* iterTermBank(files) {
  const indexPath = Object.keys(files).find((p) => p.endsWith('index.json'));
  if (!indexPath) throw new Error('zip has no index.json — not a term-bank archive');
  const banks = Object.keys(files).filter((p) => p.includes('term_bank')).sort();
  if (banks.length === 0) throw new Error('zip has index.json but no term_bank_*.json');
  for (const p of banks) {
    const entries = JSON.parse(strFromU8(files[p]));
    for (const row of entries) {
      const [expression, reading, definitionTags, rules, , definitions] = row;
      yield {
        term: expression,
        reading: reading || expression,
        definition: typeof definitions === 'string' ? definitions : '',
        definitions: Array.isArray(definitions) ? definitions : undefined,
        pos: definitionTags || rules || '',
      };
    }
  }
}
