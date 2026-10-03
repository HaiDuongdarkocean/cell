// MDX container reader — streams {keyText, html} records via js-mdict and
// dispatches each record to the first matching markup adapter. Adapters are
// structural (matches() inspects markup shape, never vendor names). Records
// with no matching adapter or no parsed senses are skipped — aux index keys
// and unrecognized markup must not be split or emitted as junk entries.
// Adapter-declared `spawned` sub-entries (inline phrases/collocations) are
// merged across parents by term (gloss-deduped) and emitted last with
// `spawned: true` — the writer merges them into a real record when one exists
// for the term, otherwise they become their own entries.

import { trTableRows } from './trTableRows.mjs';
import { cobuild } from './cobuild.mjs';
import { macmillan } from './macmillan.mjs';
import { macmillan2ed } from './macmillan2ed.mjs';
import { oald } from './oald.mjs';
import { ldoce } from './ldoce.mjs';
import { etymonline } from './etymonline.mjs';

const MARKUP_ADAPTERS = [trTableRows, cobuild, macmillan, macmillan2ed, oald, ldoce, etymonline];

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
    if (!parsed || (!parsed.senses?.length && !parsed.etymology && !parsed.entries?.length)) continue;
    if (parsed.related?.length) {
      const seen = new Set();
      parsed.related = parsed.related.filter((r) => {
        const key = r.term.toLowerCase();
        if (!keySet.has(key)) {
          const alt = key.includes('-') ? key.replace(/-/g, ' ') : key.replace(/ /g, '-');
          if (alt !== key && keySet.has(alt)) r.term = alt;
        }
        const k = `${r.kind}:${r.term.toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    for (const s of parsed.spawned ?? []) {
      if (!s.senses?.length) continue;
      const key = s.term.toLowerCase();
      const ex = spawnedMap.get(key);
      if (!ex) {
        spawnedMap.set(key, { term: s.term, senses: [...s.senses] });
        continue;
      }
      for (const sen of s.senses) {
        const g = sen.lines?.find((l) => l.role === 'gloss')?.text?.toLowerCase();
        if (g && ex.senses.some((x) => x.lines?.find((l) => l.role === 'gloss')?.text?.toLowerCase() === g)) continue;
        ex.senses.push(sen);
      }
    }
    if (parsed.entries?.length) {
      for (const [i, e] of parsed.entries.entries()) {
        yield {
          term: keyText,
          reading: keyText,
          altterm: parsed.altterm ?? '',
          pos: e.pos,
          pronunciation: e.pronunciation ?? '',
          prons: e.prons,
          senses: e.senses ?? [],
          related: i === 0 && parsed.related?.length ? parsed.related : undefined,
          inflections: e.inflections,
          frequencyStars: e.frequencyStars,
          level: i === 0 ? parsed.level : undefined,
          etymology: i === 0 ? parsed.etymology : undefined,
          wordFamily: i === 0 ? parsed.wordFamily : undefined,
          wordNet: i === 0 ? parsed.wordNet : undefined,
          derivedTerms: i === 0 ? parsed.derivedTerms : undefined,
          anagrams: i === 0 ? parsed.anagrams : undefined,
        };
      }
      continue;
    }
    yield {
      term: keyText,
      reading: keyText,
      altterm: parsed.altterm ?? '',
      pos: parsed.pos,
      pronunciation: parsed.pronunciation ?? '',
      prons: parsed.prons,
      senses: parsed.senses ?? [],
      related: parsed.related?.length ? parsed.related : undefined,
      inflections: parsed.inflections,
      frequencyStars: parsed.frequencyStars,
      level: parsed.level,
      etymology: parsed.etymology,
      wordFamily: parsed.wordFamily,
      wordNet: parsed.wordNet,
      derivedTerms: parsed.derivedTerms,
      anagrams: parsed.anagrams,
    };
  }
  for (const s of spawnedMap.values()) {
    if (only && !only.has(s.term.toLowerCase())) continue;
    yield { term: s.term, reading: s.term, senses: s.senses, spawned: true };
  }
}
