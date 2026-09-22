// LDOCE-markup adapter — `span.ldoceEntry` blocks per homonym: `.Head` with
// `.lm5pp_POS` pos + `.PRON` pronunciation + `●●●` frequency dots, `.Inflections`
// (`.infllab` label + form text), `span.Sense` sense blocks (`sensenum`,
// `SIGNPOST`/`ACTIV` activator, `GRAM`/`GEO`/`FIELD` labels, `DEF` gloss,
// `EXAMPLE` `.english`, `GramExa` `PROPFORM` pattern examples, `OPP`/`SYN`
// synopp links), nested `Sense cross_sense` → subsenses, `SpokenSect
// PhrasalVerb` `REFHWD` heads → related 'phrasal' + spawned entries. `cn_txt`
// bilingual spans are stripped from all text, never emitted.

import { stripHtml, blocks, blockText, excise } from './markup.mjs';

const noCn = (frag) => excise(frag, 'span', 'cn_txt').rest;

function parseExamples(frag) {
  const lines = [];
  for (const { inner: ex } of blocks(frag, 'span', 'EXAMPLE')) {
    const enBlock = [...blocks(ex, 'span', 'english')][0];
    const text = enBlock ? stripHtml(noCn(enBlock.inner)) : stripHtml(noCn(ex));
    if (!text) continue;
    lines.push({ role: 'example', text });
  }
  return lines;
}

function parseGramExa(frag) {
  const lines = [];
  for (const { inner: ge } of blocks(frag, 'span', 'GramExa')) {
    const pattern = blockText(ge, 'span', 'PROPFORM');
    for (const { inner: ex } of blocks(ge, 'span', 'EXAMPLE')) {
      const enBlock = [...blocks(ex, 'span', 'english')][0];
      const text = enBlock ? stripHtml(noCn(enBlock.inner)) : stripHtml(noCn(ex));
      if (!text) continue;
      lines.push({
        role: 'example',
        text,
        ...(pattern ? { pattern: `[${pattern}]` } : {}),
      });
    }
  }
  return lines;
}

function parseSynopp(frag) {
  const syns = [];
  const ants = [];
  for (const m of frag.matchAll(/<span class="(?:OPP|SYN)"[^>]*>[\s\S]*?<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g)) {
    const t = stripHtml(m[1]);
    if (!t) continue;
    if (m[0].includes('class="OPP"')) ants.push(t);
    else syns.push(t);
  }
  return { syns: [...new Set(syns)], ants: [...new Set(ants)] };
}

function parseSense(inner, pos) {
  const { rest, removed: nested } = excise(inner, 'span', 'Sense');
  const labels = [
    ...[...blocks(rest, 'span', 'SIGNPOST'), ...blocks(rest, 'span', 'ACTIV')].map((b) =>
      stripHtml(noCn(b.inner)).toLowerCase(),
    ),
    ...[...blocks(rest, 'span', 'GRAM'), ...blocks(rest, 'span', 'GEO'), ...blocks(rest, 'span', 'FIELD')]
      .map((b) => stripHtml(noCn(b.inner)).replace(/^\[|\]$/g, '').trim()),
  ].filter(Boolean);
  const defs = [...blocks(rest, 'span', 'DEF')];
  const gloss = defs.length ? stripHtml(noCn(defs[0].inner)) : '';
  const lines = [];
  if (gloss) lines.push({ role: 'gloss', text: gloss });
  lines.push(...parseGramExa(rest));
  const plainEx = excise(rest, 'span', 'GramExa').rest;
  lines.push(...parseExamples(plainEx));
  if (!lines.length) return null;
  const sense = {
    ...(pos ? { pos } : {}),
    ...(labels.length ? { labels: [...new Set(labels)] } : {}),
    lines,
  };
  const { syns, ants } = parseSynopp(rest);
  if (syns.length) sense.synonyms = syns;
  if (ants.length) sense.antonyms = ants;
  const subs = [];
  for (const { inner: sub } of nested) {
    const num = stripHtml(blockText(sub, 'span', 'sensenum')).replace(/[()]/g, '');
    const lexUnit = blockText(sub, 'span', 'LEXUNIT');
    const subDefs = [...blocks(sub, 'span', 'DEF')];
    const text = subDefs.length ? stripHtml(noCn(subDefs[0].inner)) : '';
    if (text) subs.push({ ...(num ? { num } : {}), text: lexUnit ? `${lexUnit} — ${text}` : text });
  }
  if (subs.length) sense.subsenses = subs;
  return sense;
}

export const ldoce = {
  name: 'ldoce5pp',
  matches: (html) =>
    html.includes('ldoceEntry') ||
    html.includes('LDOCE_switch_lang') ||
    html.includes('entry_content topic') ||
    html.includes('topicpagetitle'),
  parse(html) {
    const out = { senses: [], related: [], spawned: [] };
    const relatedSeen = new Set();
    const rel = (term, kind) => {
      const t = stripHtml(term);
      const key = t.toLowerCase();
      if (t && !relatedSeen.has(key)) {
        relatedSeen.add(key);
        out.related.push({ term: t, kind });
      }
    };

    if (html.includes('entry_content topic') || html.includes('topicpagetitle')) {
      const topic = blockText(html, 'span', 'topic_intro');
      const title = stripHtml(html.match(/<h1 class="topicpagetitle">([\s\S]*?)<\/h1>/)?.[1] ?? topic);
      for (const m of html.matchAll(/<a class="topic_\d+"[^>]*title="([^"]+)"[^>]*>/g)) {
        rel(m[1], 'thesaurus');
      }
      out.senses.push({
        pos: 'topic',
        lines: [
          ...(title ? [{ role: 'note', text: title }] : []),
          ...out.related.slice(0, 400).map((r) => ({ role: 'gloss', text: r.term })),
        ],
      });
      return out;
    }

    const famBlock = [...blocks(html, 'span', 'LDOCE_word_family')][0];
    if (famBlock) {
      const fam = {};
      let cur;
      for (const m of famBlock.inner.matchAll(/<span class="pos">([\s\S]*?)<\/span>|<(?:a|span) class="(?:crossRef )?w"[^>]*>([\s\S]*?)<\/(?:a|span)>/g)) {
        if (m[1] !== undefined) {
          cur = stripHtml(m[1]).toLowerCase();
          continue;
        }
        const w = stripHtml(m[2]);
        if (!w || !cur) continue;
        const slot = cur.startsWith('noun') ? 'nouns' : cur.startsWith('verb') ? 'verbs' : cur.startsWith('adjective') ? 'adjectives' : cur.startsWith('adverb') ? 'adverbs' : undefined;
        if (!slot) continue;
        const list = (fam[slot] ??= []);
        if (!list.includes(w)) list.push(w);
      }
      if (Object.keys(fam).length) out.wordFamily = fam;
    }

    const etym = [...blocks(html, 'span', 'etym')][0];
    if (etym) {
      const chain = stripHtml(noCn(excise(etym.inner, 'span', 'Head').rest))
        .replace(/^Origin\s*/i, '')
        .replace(/\s+/g, ' ')
        .replace(/\(\s+|\s+\)/g, (m) => m.trim())
        .trim();
      if (chain) out.etymology = { chain };
    }

    for (const { inner: th } of blocks(html, 'span', 'Thesref')) {
      const t = blockText(th, 'span', 'REFHWD');
      if (t) rel(t, 'thesaurus');
    }
    const boxPanel = [...blocks(html, 'span', 'BoxPanel')][0];
    if (boxPanel) {
      const text = stripHtml(noCn(boxPanel.inner));
      if (text) out.usageNote = { title: 'Thesaurus', text };
    }

    for (const { inner: entry } of blocks(html, 'span', 'ldoceEntry')) {
      const pos = blockText(entry, 'span', 'lm5pp_POS');
      const pron = blockText(entry, 'span', 'PRON');
      if (pron && !out.pronunciation) out.pronunciation = pron;
      const dots = entry.match(/●/g)?.length ?? 0;
      if (dots && !out.frequencyStars) out.frequencyStars = Math.min(dots, 3);

      for (const m of entry.matchAll(/<span class="infllab span">([\s\S]*?)<\/span>([^<]+)/g)) {
        const type = stripHtml(m[1]);
        const form = stripHtml(m[2]);
        if (!type || !form) continue;
        const g = (out.inflections ??= []).find((x) => x.type === type);
        if (g) {
          if (!g.forms.includes(form)) g.forms.push(form);
        } else {
          out.inflections.push({ type, forms: [form] });
        }
      }

      const { rest, removed: spoken } = excise(entry, 'span', 'SpokenSect');
      for (const { inner: sect } of spoken) {
        const byTerm = new Map();
        for (const s of blocks(sect, 'span', 'Sense')) {
          const refBlock = [...blocks(s.inner, 'span', 'REFHWD')][0];
          const term = refBlock ? stripHtml(noCn(refBlock.inner)) : '';
          if (!term) continue;
          const { rest: noRef } = excise(s.inner, 'span', 'REFHWD');
          const sense = parseSense(noRef, 'phrasal verb');
          if (!sense) continue;
          if (!byTerm.has(term.toLowerCase())) byTerm.set(term.toLowerCase(), { term, senses: [] });
          byTerm.get(term.toLowerCase()).senses.push(sense);
        }
        for (const sp of byTerm.values()) {
          rel(sp.term, 'phrasal');
          out.spawned.push(sp);
        }
      }

      for (const s of blocks(rest, 'span', 'Sense')) {
        const sense = parseSense(s.inner, pos);
        if (sense) out.senses.push(sense);
      }
    }

    return out;
  },
};
