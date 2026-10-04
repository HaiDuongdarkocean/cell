// canonical — single normalization entry for dictionary definitions.
//
// Storage contract: `DictionaryEntry.senses` is the SSOT — an ordered list
// of structured senses (pos label + role-classified lines with optional
// `translation`). `DictionaryEntry.definition` is the DERIVED canonical
// serialization of the same data — senses joined by `<br><br>` + `N.`
// markers, `<br>` inside a sense body — kept for consumers that read the
// string form (Anki fields, legacy rows, splitSenses fallback).
//
// Pipeline: RULES detect source shape → SenseBlock[] IR → serializer emits
// BOTH the structured senses and the canonical string from one pass. The
// serializer is the ONLY place allowed to emit `<br><br>N.` boundaries;
// rules that cannot prove structure return null and the chain falls through
// to `verbatim` (single def, no split).
//
// Extending to a new source shape: write one DefinitionRule in rules.ts
// and register it in RULES — ordered most-structured → least-structured.

import type { SenseBlock } from '@/entities/dictionary';
import type { RawDictionaryEntry } from '../../strategies/baseImportStrategy';
import type { DefinitionRule, ParsedDefinition } from './rules';
import { lineToCanonicalText, preNormalized, listDefinitions, numberedLineMarkup, verbatim } from './rules';

/** Ordered detector chain — first match wins, `verbatim` is the sink. */
const RULES: readonly DefinitionRule[] = [
  preNormalized,
  listDefinitions,
  numberedLineMarkup,
  verbatim,
];

const CANON_BREAK = '<br>';

/** Canonical field values ready for DictionaryEntry storage. */
export interface CanonicalFields {
  readonly definition: string;
  readonly senses: readonly SenseBlock[];
  readonly pos: string;
  readonly examples: string;
}

function relationLines(s: {
  readonly synonymGroups?: readonly { readonly label?: string; readonly words: readonly string[] }[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
}): string[] {
  const groups = s.synonymGroups?.length
    ? s.synonymGroups
    : (s.synonyms?.length ? [{ words: s.synonyms }] : []);
  return [
    ...groups.map(
      (g) => `synonyms and related words: ${g.label ? `${g.label}: ` : ''}${g.words.join(', ')}`,
    ),
    ...(s.antonyms?.length ? [`antonyms: ${s.antonyms.join(', ')}`] : []),
  ];
}

function serializeSense(sense: SenseBlock): string {
  const head = [
    sense.pos,
    ...(sense.labels ?? []).map((l) => `[${l}]`),
    ...(sense.level ? [`[${sense.level}]`] : []),
  ].filter(Boolean).join(' ');
  const parts = [
    ...(head ? [head] : []),
    ...sense.lines.map(lineToCanonicalText),
    ...relationLines(sense),
    ...(sense.subsenses ?? []).flatMap((s) => [
      `${s.num ? `${s.num}. ` : ''}${s.text}`.trim(),
      ...(s.examples ?? []).map(lineToCanonicalText),
      ...relationLines(s),
    ]),
  ];
  return parts.join(CANON_BREAK);
}

/** Serialize parsed senses to the canonical `<br><br>N.` string form. */
function serialize(parsed: ParsedDefinition): string {
  if (parsed.senses.length === 0) return '';
  if (parsed.senses.length === 1) return serializeSense(parsed.senses[0]!);
  return parsed.senses
    .map((s, i) => `${i + 1}.${serializeSense(s)}`)
    .join('<br><br>');
}

/**
 * Normalize a raw dictionary entry to canonical stored fields.
 * Pure — no I/O; safe to call from any strategy transform.
 */
export function toCanonicalDefinition(raw: RawDictionaryEntry): CanonicalFields {
  const pos = (raw.pos ?? '').trim().normalize('NFC');
  const examples = (raw.examples ?? '').trim().normalize('NFC');
  for (const rule of RULES) {
    const parsed = rule(raw);
    if (parsed) {
      return {
        definition: serialize(parsed).trim().normalize('NFC').replace(/\s+/g, ' '),
        senses: parsed.senses,
        pos: (parsed.pos ?? pos),
        examples,
      };
    }
  }
  return { definition: '', senses: [], pos, examples };
}
