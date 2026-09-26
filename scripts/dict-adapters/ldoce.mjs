// LDOCE-markup adapter — `span.ldoceEntry` blocks per homonym: `.Head` with
// `.lm5pp_POS` pos + `.PRON` pronunciation + `●●●` frequency dots, `.Inflections`
// (`.infllab` label + form text), `span.Sense` sense blocks (`sensenum`,
// `SIGNPOST`/`ACTIV` activator, `GRAM`/`GEO`/`FIELD`/`FIELDXX`/`REGISTERLAB`
// labels, `LEXUNIT`/`LEXVAR` lexical heads, `REFHWD merge_sense` phrase
// headwords → spawned entries + related 'expression' (`↔` heads derive the
// phrasal term from LEXUNIT particles), `DEF` gloss,
// `EXAMPLE` `.english`, `GramExa` `PROPFORM`/`PROPFORMPREP` pattern examples,
// `OPP`/`SYN`/`BREQUIV`/`AMEQUIV` synopp links, `EXPL`/`dont_say` grammar notes,
// `ColloExa` collocations, `ThesBox`/`Exponent` thesaurus groups, `corpus`
// corpus examples, `ORIGIN`/`LANG` origins), nested `Sense cross_sense` →
// subsenses, `SpokenSect PhrasalVerb` `REFHWD` heads → related 'phrasal' +
// spawned entries, `PhrVbEntry` → related 'phrasal', `RELATEDWD` → related
// 'derivative', generic `Crossref` → related 'see also', `ORTHVAR` → altterm.
// `cn_txt` bilingual spans are stripped from all text, never emitted.

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
    const pattern = blockText(ge, 'span', 'PROPFORM') || blockText(ge, 'span', 'PROPFORMPREP');
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
  for (const cls of ['BREQUIV', 'AMEQUIV']) {
    for (const { inner } of blocks(frag, 'span', cls)) {
      const geo = blockText(inner, 'span', 'geo');
      for (const m of inner.matchAll(/<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g)) {
        const t = stripHtml(m[1]);
        if (t) syns.push(geo ? `${t} (${geo})` : t);
      }
    }
  }
  return { syns: [...new Set(syns)], ants: [...new Set(ants)] };
}

function parseCorpus(inner) {
  const lines = [];
  for (const { inner: ex } of blocks(inner, 'span', 'exa')) {
    const text = stripHtml(noCn(ex)).replace(/^[•·◦]\s*/, '');
    if (text) lines.push({ role: 'example', text, citation: 'corpus' });
  }
  return lines;
}

function parseExponents(inner) {
  const lines = [];
  for (const { inner: ex } of blocks(inner, 'span', 'Exponent')) {
    const head = blockText(ex, 'span', 'EXP');
    const def = blockText(ex, 'span', 'DEF');
    if (def) lines.push({ role: 'note', text: head ? `${head} — ${def}` : def });
    lines.push(...parseExamples(ex));
  }
  return lines;
}

function parseSense(inner, pos) {
  const { rest: rExpl, removed: expls } = excise(inner, 'span', 'EXPL');
  const { rest: rColl, removed: collos } = excise(rExpl, 'span', 'ColloExa');
  const { rest: rThes, removed: thes } = excise(rColl, 'span', 'ThesBox');
  const { rest: rCorp, removed: corp } = excise(rThes, 'span', 'corpus');
  const { rest: rSense, removed: nested } = excise(rCorp, 'span', 'Sense');
  const { rest, removed: subNested } = excise(rSense, 'span', 'Subsense');
  nested.push(...subNested);

  const headLabels = [];
  for (const b of blocks(rest, 'span', 'REFHWD')) {
    if (b.tag.includes('merge_sense')) headLabels.push(stripHtml(noCn(b.inner)));
  }
  const lexUnit = blockText(rest, 'span', 'LEXUNIT');
  if (lexUnit) headLabels.push(lexUnit);
  for (const b of blocks(rest, 'span', 'LEXVAR')) headLabels.push(stripHtml(noCn(b.inner)));

  const labels = [
    ...headLabels,
    ...[...blocks(rest, 'span', 'SIGNPOST'), ...blocks(rest, 'span', 'ACTIV')].map((b) =>
      stripHtml(noCn(b.inner)).toLowerCase(),
    ),
    ...[
      ...blocks(rest, 'span', 'GRAM'),
      ...blocks(rest, 'span', 'GEO'),
      ...blocks(rest, 'span', 'FIELD'),
      ...blocks(rest, 'span', 'FIELDXX'),
      ...blocks(rest, 'span', 'REGISTERLAB'),
    ].map((b) => stripHtml(noCn(b.inner)).replace(/^\[|\]$/g, '').trim()),
    ...[...rest.matchAll(/<span class="LANG"[^>]*>([\s\S]*?)<\/span>\s*<span class="ORIGIN"[^>]*>([\s\S]*?)<\/span>/g)].map(
      (m) => `${stripHtml(m[1])} ${stripHtml(m[2])}`.trim(),
    ),
  ].filter(Boolean);

  const defs = [...blocks(rest, 'span', 'DEF')];
  const gloss = defs.length ? stripHtml(noCn(defs[0].inner)) : '';
  const lines = [];
  if (gloss) lines.push({ role: 'gloss', text: gloss });
  lines.push(...parseGramExa(rest));

  for (const { inner: cx } of collos) {
    const collo = blockText(cx, 'span', 'COLLO');
    for (const { inner: ex } of blocks(cx, 'span', 'EXAMPLE')) {
      const enBlock = [...blocks(ex, 'span', 'english')][0];
      const text = enBlock ? stripHtml(noCn(enBlock.inner)) : stripHtml(noCn(ex));
      if (text) lines.push({ role: 'example', text, ...(collo ? { pattern: `[${collo}]` } : {}) });
    }
  }

  for (const { inner: tb } of thes) lines.push(...parseExponents(tb));
  for (const { inner: cb } of corp) lines.push(...parseCorpus(cb));

  for (const { inner: el } of expls) {
    const text = stripHtml(noCn(el));
    if (text) lines.push({ role: 'note', text });
  }

  const plainEx = excise(rest, 'span', 'GramExa').rest;
  lines.push(...parseExamples(plainEx));
  const subs = [];
  for (const { inner: sub } of nested) {
    const num = stripHtml(blockText(sub, 'span', 'sensenum')).replace(/[()]/g, '');
    const lexUnit = blockText(sub, 'span', 'LEXUNIT');
    const subDefs = [...blocks(sub, 'span', 'DEF')];
    const text = subDefs.length ? stripHtml(noCn(subDefs[0].inner)) : '';
    if (text) subs.push({ ...(num ? { num } : {}), text: lexUnit ? `${lexUnit} — ${text}` : text });
  }
  if (!lines.length && !subs.length) return null;
  const sense = {
    ...(pos ? { pos } : {}),
    ...(labels.length ? { labels: [...new Set(labels)] } : {}),
    lines,
  };
  const { syns, ants } = parseSynopp(rest);
  if (syns.length) sense.synonyms = syns;
  if (ants.length) sense.antonyms = ants;
  if (subs.length) sense.subsenses = subs;
  return sense;
}

function phraseTerm(head, inner) {
  if (!head.includes('↔')) return { term: head, pos: 'phrase' };
  const particles = new Set();
  const own = head.match(/↔\s*(.+?)\s*$/)?.[1];
  if (own) particles.add(own);
  for (const b of blocks(inner, 'span', 'LEXUNIT')) {
    const p = stripHtml(noCn(b.inner)).match(/↔\s*(.+?)\s*$/)?.[1];
    if (p) particles.add(p);
  }
  if (particles.size === 1) {
    const verb = head.split(/\s/)[0];
    if (verb) return { term: `${verb} ${[...particles][0]}`, pos: 'phrasal verb' };
  }
  return { term: head.replace(/↔/g, '').replace(/\s+/g, ' ').trim(), pos: 'phrasal verb' };
}

function parseEntryContent(src, pos, out, rel) {
  const orthVars = [...blocks(src, 'span', 'Head')].flatMap((h) =>
    [...blocks(h.inner, 'span', 'ORTHVAR')].map((b) => stripHtml(noCn(b.inner))).filter(Boolean),
  );
  if (orthVars.length && !out.altterm) out.altterm = [...new Set(orthVars)].join(', ');

  const { rest: noPhr, removed: phrEntries } = excise(src, 'span', 'PhrVbEntry');
  for (const { inner: pv } of phrEntries) {
    const href = pv.match(/href="entry:\/\/([^"#]+)/)?.[1];
    if (href) rel(href, 'phrasal');
  }
  for (const { inner: cr } of blocks(noPhr, 'span', 'Crossref')) {
    const m = cr.match(/href="entry:\/\/([^"#]+)[^"]*"[^>]*>[\s\S]*?<span class="REFHWD[^"]*">([\s\S]*?)<\/span>/);
    if (m) rel(stripHtml(m[2]) || m[1], 'see also');
  }
  for (const { inner: rw } of blocks(noPhr, 'span', 'RELATEDWD')) {
    const t = stripHtml(rw.match(/<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '');
    if (t) rel(t, 'derivative');
  }

  const { rest, removed: spoken } = excise(noPhr, 'span', 'SpokenSect');
  for (const { inner: sect } of spoken) {
    const byTerm = new Map();
    const scan = (inner) => {
      const seq = [...blocks(inner, 'span', 'REFHWD'), ...blocks(inner, 'span', 'Sense')].sort((a, b) => a.start - b.start);
      let curHead = '';
      for (const b of seq) {
        if (b.tag.includes('REFHWD')) {
          curHead = stripHtml(noCn(b.inner));
          continue;
        }
        const own = [...blocks(b.inner, 'span', 'REFHWD')][0];
        const headText = own ? stripHtml(noCn(own.inner)) : curHead;
        const term = headText ? phraseTerm(headText, b.inner).term : '';
        if (!term) continue;
        const { rest: noRef } = excise(b.inner, 'span', 'REFHWD');
        const sense = parseSense(noRef, 'phrasal verb');
        if (!sense) continue;
        if (!byTerm.has(term.toLowerCase())) byTerm.set(term.toLowerCase(), { term, senses: [] });
        byTerm.get(term.toLowerCase()).senses.push(sense);
      }
      for (const f of blocks(inner, 'span', 'LDOCE5pp_sensefold')) scan(f.inner);
    };
    scan(sect);
    for (const sp of byTerm.values()) {
      rel(sp.term, 'phrasal');
      out.spawned.push(sp);
    }
  }

  const { rest: noSense, removed: senseBlocks } = excise(rest, 'span', 'Sense');
  const phrases = new Map();
  for (const s of senseBlocks) {
    const head = [...blocks(s.inner, 'span', 'REFHWD')].find((b) => b.tag.includes('merge_sense'));
    if (head) {
      const ph = phraseTerm(stripHtml(noCn(head.inner)), s.inner);
      const noRef = excise(s.inner, 'span', 'REFHWD', (b) => b.tag.includes('merge_sense')).rest;
      const sense = parseSense(noRef, ph.pos);
      if (ph.term && sense) {
        rel(ph.term, 'expression');
        const k = ph.term.toLowerCase();
        if (!phrases.has(k)) phrases.set(k, { term: ph.term, senses: [] });
        phrases.get(k).senses.push(sense);
      }
      continue;
    }
    const sense = parseSense(s.inner, pos);
    if (sense) out.senses.push(sense);
  }
  out.spawned.push(...phrases.values());

  const { rest: noThes, removed: thesBoxes } = excise(noSense, 'span', 'ThesBox');
  const { rest: noGram, removed: gramBoxes } = excise(noThes, 'span', 'GramBox');
  const { removed: corpBoxes } = excise(noGram, 'span', 'corpus');
  for (const { inner: tb } of thesBoxes) {
    const lines = parseExponents(tb);
    if (lines.length) out.senses.push({ labels: ['thesaurus'], lines });
  }
  for (const { inner: gb } of gramBoxes) {
    const lines = [];
    for (const { inner: el } of blocks(gb, 'span', 'EXPL')) {
      const text = stripHtml(noCn(el));
      if (text) lines.push({ role: 'note', text });
    }
    if (lines.length) out.senses.push({ labels: ['grammar'], lines });
  }
  for (const { inner: cb } of corpBoxes) {
    const lines = parseCorpus(cb);
    if (lines.length) out.senses.push({ labels: ['corpus'], lines });
  }
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
    for (const { inner: box } of blocks(html, 'span', 'BoxPanel')) {
      for (const m of box.matchAll(/<a\b[^>]*href="[^"]*entry[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
        const t = stripHtml(noCn(m[1]));
        if (t) rel(t, 'thesaurus');
      }
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

      parseEntryContent(entry, pos, out, rel);
    }

    const { rest: leftover } = excise(html, 'span', 'ldoceEntry');
    parseEntryContent(leftover, blockText(leftover, 'span', 'lm5pp_POS'), out, rel);

    return out;
  },
};
