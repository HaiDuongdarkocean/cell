// posNormalize — canonical part-of-speech normalization (spec pos-dictionary-variants N7).
//
// SSOT for raw pos labels → canonical pos keys, used by the app at lookup
// AND by offline converters via jiti (same pattern as normalize/canonical.ts).
// One direction only: raw → canonical. Canonical set is open — unmapped raw
// values pass through lowercased so unknown labels still group into their
// own variant. '' stays '' — the unpos'd bucket (renders as `other` in UI,
// never as a POS option).

const ALIASES: Readonly<Record<string, string>> = {
  j: 'adjective',
  adj: 'adjective',
  adjective: 'adjective',
  n: 'noun',
  noun: 'noun',
  v: 'verb',
  verb: 'verb',
  'v.t': 'verb',
  'v.i': 'verb',
  r: 'adverb',
  adv: 'adverb',
  adverb: 'adverb',
  p: 'pronoun',
  pron: 'pronoun',
  pronoun: 'pronoun',
  i: 'preposition',
  prep: 'preposition',
  preposition: 'preposition',
  c: 'conjunction',
  conj: 'conjunction',
  conjunction: 'conjunction',
  d: 'determiner',
  det: 'determiner',
  determiner: 'determiner',
  article: 'determiner',
  u: 'interjection',
  interj: 'interjection',
  interjection: 'interjection',
  m: 'numeral',
  num: 'numeral',
  numeral: 'numeral',
  t: 'particle',
  particle: 'particle',
  modal: 'auxiliary',
  auxiliary: 'auxiliary',
  'phrasal verb': 'phrasal verb',
  phrase: 'phrase',
  expression: 'phrase',
  thesaurus: 'thesaurus',
  slang: 'slang',
};

export function normalizePos(raw: string): string {
  const key = raw.trim().toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
  if (!key) return '';
  return ALIASES[key] ?? key;
}
