// MDX container reader — streams {keyText, html} records via js-mdict and
// dispatches each record to the first matching markup adapter. Adapters are
// structural (matches() inspects markup shape, never vendor names). Records
// with no matching adapter or no parsed senses are skipped — aux index keys
// and unrecognized markup must not be split or emitted as junk entries.
// Adapter-declared `spawned` sub-entries (inline phrases/collocations whose
// term is not itself a key) are emitted at the end so related links resolve.

import { trTableRows } from './trTableRows.mjs';
import { cobuild } from './cobuild.mjs';
import { macmillan } from './macmillan.mjs';
import { oald } from './oald.mjs';
import { ldoce } from './ldoce.mjs';
import { etymonline } from './etymonline.mjs';

const MARKUP_ADAPTERS = [trTableRows, cobuild, macmillan, oald, ldoce, etymonline];

export async function* iterMdx(mdxPath, only) {
  const mod = await import('js-mdict');
  const MDX = mod.MDX ?? mod.default?.MDX;
  if (!MDX) throw new Error('js-mdict not available — npm i -D js-mdict');
  const mdx = new MDX(mdxPath, { passcode: undefined, resort: true, isStripKey: true, isCaseSensitive: false });
  const keySet = new Set();
  for (const kw of mdx.keywordList) {
    const k = String(kw.keyText ?? '').replace(/^"|"$/g, '').toLowerCase();
    if (k) keySet.add(k);
  }
  const spawnedMap = new Map();
  for (const kw of mdx.keywordList) {
    let keyText = String(kw.keyText ?? '').replace(/^"|"$/g, '');
    if (!keyText) continue;
    const ukVariant = keyText.match(/^uk (.+)$/);
    if (ukVariant) {
      if (keySet.has(ukVariant[1].toLowerCase())) continue;
      keyText = ukVariant[1];
    }
    if (only && !only.has(keyText.toLowerCase())) continue;
    const html = mdx.fetch_definition(kw)?.definition;
    if (!html) continue;
    const link = html.match(/@@@LINK=(\S+)/);
    if (link) {
      const target = link[1].replace(/\/+$/, '');
      if (target) {
        yield { term: keyText, reading: keyText, senses: [{ lines: [{ role: 'note', text: `→ ${target}` }] }] };
      }
      continue;
    }
    const adapter = MARKUP_ADAPTERS.find((a) => a.matches(html));
    if (!adapter) continue;
    const parsed = adapter.parse(html);
    if (!parsed.senses?.length) continue;
    for (const s of parsed.spawned ?? []) {
      if (s.senses?.length && !spawnedMap.has(s.term.toLowerCase())) {
        spawnedMap.set(s.term.toLowerCase(), s);
      }
    }
    yield {
      term: keyText,
      reading: keyText,
      altterm: parsed.altterm ?? '',
      pronunciation: parsed.pronunciation ?? '',
      senses: parsed.senses,
      related: parsed.related?.length ? parsed.related : undefined,
      inflections: parsed.inflections,
      frequencyStars: parsed.frequencyStars,
      level: parsed.level,
      etymology: parsed.etymology,
      wordFamily: parsed.wordFamily,
      wordNet: parsed.wordNet,
      derivedTerms: parsed.derivedTerms,
      anagrams: parsed.anagrams,
      usageNote: parsed.usageNote,
    };
  }
  for (const s of spawnedMap.values()) {
    if (keySet.has(s.term.toLowerCase())) continue;
    if (only && !only.has(s.term.toLowerCase())) continue;
    yield { term: s.term, reading: s.term, senses: s.senses };
  }
}
