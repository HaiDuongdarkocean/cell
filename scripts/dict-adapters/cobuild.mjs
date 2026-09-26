// Cobuild-markup adapter — records shaped as `<div class="cb24|cobuild">`
// blocks: `.hom` sense groups (sensenum + gramGrp[pos|cefr|lbl] + .sense >
// .def + .examples > .cit > .quote with .tips grammar patterns + .thes
// synonyms), `.hom.ext` phrase entries (.phr-ext + .rhw), `.phrvs > .phrv-ext`
// phrasal verbs with nested .hom senses, `.idiom .idms > .idm-ext` inline
// idioms (.ihw + .idm-sense), `.form.inflected_forms` word forms (orth[title]
// grouped per inflection type), `.collocation .collos > a.collo` with
// .collo-exa corpus examples (.blockquote + .credits), `.pron` pronunciation,
// `a.xr` "explained at" cross-refs. Unknown structure keeps the record
// unsplit — parse returns empty senses and the caller falls back.

import { stripHtml, blocks, excise } from './markup.mjs';

const TIPS_RE = /<span class="tips">([\s\S]*?)<\/a><\/span>/g;
const CIT_RE = /<div class="cit[^"]*">([\s\S]*?)<\/div>/g;
const DEF_RE = /<div class="def[^"]*">([\s\S]*?)<\/div>/;
const THES_RE = /<div class="thes[^"]*">([\s\S]*?)<\/div>/;
const FORM_REF_RE = /<a class="form[^"]*"[^>]*>([^<]+)<\/a>/g;
const ORTH_FORM_RE = /(?:span|a) class="orth[^"]*"[^>]*?title="([^"]+)"[^>]*>([^<]+)</g;

function parseGramGrp(frag, gramPosVariant) {
  const pos = gramPosVariant
    ? stripHtml(frag)
    : stripHtml(frag.match(/<span class="pos">([\s\S]*?)<\/span>/)?.[1] ?? '');
  const level = stripHtml(frag.match(/<span class="cefr">([\s\S]*?)<\/span>/)?.[1] ?? '');
  const labels = [...stripHtml(frag).matchAll(/\[([^\]]+)\]/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  return { pos, level, labels };
}

function parseCit(citHtml) {
  const tips = citHtml.match(TIPS_RE)?.[0];
  const patternInner = tips ? stripHtml(tips).match(/\[([\s\S]*)\]/)?.[1]?.trim() : undefined;
  const text = stripHtml(citHtml.replace(TIPS_RE, ''));
  return text ? { role: 'example', text, ...(patternInner ? { pattern: `[${patternInner}]` } : {}) } : null;
}

function parseSenseFrag(frag, gram) {
  const lines = [];
  const gloss = stripHtml(frag.match(DEF_RE)?.[1] ?? '');
  if (gloss) lines.push({ role: 'gloss', text: gloss });
  const exaBlock = frag.match(/<div class="examples">([\s\S]*?)<\/div>\s*<\/div>/);
  if (exaBlock) {
    for (const cm of exaBlock[1].matchAll(CIT_RE)) {
      const ex = parseCit(cm[1]);
      if (ex) lines.push(ex);
    }
  }
  if (!lines.length) return null;
  const sense = {
    ...(gram.pos ? { pos: gram.pos } : {}),
    ...(gram.labels.length ? { labels: gram.labels } : {}),
    ...(gram.level ? { level: gram.level } : {}),
    lines,
  };
  const thes = frag.match(THES_RE);
  if (thes) {
    const syns = [...thes[1].matchAll(FORM_REF_RE)].map((m) => stripHtml(m[1])).filter(Boolean);
    if (syns.length) sense.synonyms = syns;
  }
  return sense;
}

function parseHomFrag(frag) {
  const drvIdx = frag.search(/<div class="re\s/);
  if (drvIdx >= 0) frag = frag.slice(0, drvIdx);
  const gramM = frag.match(/<span class="gramGrp([^"]*)">([\s\S]*?)(?=<div class="sense"|<\/a>)/) ??
    frag.match(/<span class="gramGrp([^"]*)">([\s\S]*?)<\/span>/);
  const gram = parseGramGrp(gramM?.[2] ?? '', gramM?.[1]?.includes('pos') ?? false);
  const senses = [];
  const senseIdx = [...frag.matchAll(/<div class="sense">/g)].map((m) => m.index);
  for (let i = 0; i < senseIdx.length; i++) {
    const end = senseIdx[i + 1] ?? frag.length;
    const sense = parseSenseFrag(frag.slice(senseIdx[i], end), gram);
    if (sense) senses.push(sense);
  }
  return senses;
}

function parseSource(src, out, rel) {
  const homExt = excise(src, 'div', 'hom ext');
  const phrv = excise(homExt.rest, 'div', 'phrv-ext');
  const idm = excise(phrv.rest, 'div', 'idm-ext');
  const coll = excise(idm.rest, 'div', 'collocation');
  for (const hom of splitOn(coll.rest, /<div class="hom"/g)) {
    out.senses.push(...parseHomFrag(hom));
  }
  for (const b of homExt.removed) {
    const term = stripHtml(b.inner.match(/<span class="rhw">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const senses = parseHomFrag(b.inner);
    if (!term || !senses.length) continue;
    rel(term, 'expression');
    out.spawned.push({ term, senses });
  }
  for (const b of phrv.removed) {
    const term = stripHtml(b.inner.match(/<span class="rhw">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const senses = parseHomFrag(b.inner);
    if (!term) continue;
    rel(term, 'phrasal');
    if (senses.length) out.spawned.push({ term, senses });
  }
  for (const b of idm.removed) {
    const term = stripHtml(b.inner.match(/<span class="ihw">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const senses = parseIdiomBlock(b.inner);
    if (!term) continue;
    rel(term, 'idiom');
    if (senses.length) out.spawned.push({ term, senses });
  }
  for (const b of coll.removed) {
    for (const m of b.inner.matchAll(
      /<a class="collo"[^>]*>([\s\S]*?)<\/a><div class="collo-exa"[^>]*>([\s\S]*?)(?=<a class="collo|$)/g,
    )) {
      const term = stripHtml(m[1]);
      if (!term) continue;
      rel(term, 'collocation');
      const lines = parseCorpusLines(m[2]);
      if (lines.length) out.spawned.push({ term, senses: [{ pos: 'collocation', lines }] });
    }
  }
}

function parseInflections(html) {
  const groups = new Map();
  for (const b of blocks(html, 'span', 'inflected_forms')) {
    for (const m of b.inner.matchAll(ORTH_FORM_RE)) {
      const type = m[1].trim();
      const form = stripHtml(m[2]);
      if (!type || !form) continue;
      if (!groups.has(type)) groups.set(type, []);
      if (!groups.get(type).includes(form)) groups.get(type).push(form);
    }
  }
  return [...groups.entries()].map(([type, forms]) => ({ type, forms }));
}

function parseIdiomBlock(block) {
  const senses = [];
  for (const s of splitOn(block, /<div class="idm-sense">/g)) {
    if (!s.includes('idm-sense')) continue;
    const lines = [];
    const gloss = stripHtml(s.match(DEF_RE)?.[1] ?? '');
    if (gloss) lines.push({ role: 'gloss', text: gloss });
    for (const cm of s.matchAll(CIT_RE)) {
      const ex = parseCit(cm[1]);
      if (ex) lines.push(ex);
    }
    if (lines.length) senses.push({ pos: 'idiom', lines });
  }
  return senses;
}

function* splitOn(frag, re) {
  const marks = [...frag.matchAll(re)].map((m) => m.index);
  for (let i = 0; i < marks.length; i++) {
    yield frag.slice(marks[i], marks[i + 1] ?? frag.length);
  }
}

function parseCorpusLines(frag) {
  const lines = [];
  for (const cm of frag.matchAll(
    /<div class="blockquote">([\s\S]*?)<\/div>\s*(?:<div class="credits">([\s\S]*?)<\/div>)?\s*<\/div>/g,
  )) {
    const text = stripHtml(cm[1]);
    const citation = stripHtml(cm[2] ?? '');
    if (text) lines.push({ role: 'example', text, ...(citation ? { citation } : {}) });
  }
  return lines;
}

export const cobuild = {
  name: 'cobuild-cb24',
  matches: (html) => html.includes('class="cb24') || html.includes('class="cobuild"'),
  parse(html) {
    const out = { senses: [], related: [], spawned: [] };
    const recordType = html.match(/class="cb24 (\w+)"/)?.[1];

    if (recordType === 'idiom') {
      for (const block of splitOn(html, /<div class="idm-sense">/g)) {
        if (!block.includes('idm-sense')) continue;
        const lines = [];
        const gloss = stripHtml(block.match(DEF_RE)?.[1] ?? '');
        if (gloss) lines.push({ role: 'gloss', text: gloss });
        for (const cm of block.matchAll(/<div class="cit[^"]*">([\s\S]*?)<\/div>/g)) {
          const text = stripHtml(cm[1]);
          if (text) lines.push({ role: 'example', text });
        }
        if (lines.length) out.senses.push({ pos: 'idiom', lines });
      }
      return out;
    }

    if (recordType === 'collo') {
      const lines = parseCorpusLines(html);
      if (lines.length) out.senses.push({ pos: 'collocation', lines });
      return out;
    }
    const relatedSeen = new Set();
    const rel = (term, kind) => {
      const t = stripHtml(term);
      const key = t.toLowerCase();
      if (t && !relatedSeen.has(key)) {
        relatedSeen.add(key);
        out.related.push({ term: t, kind });
      }
    };

    const { rest, removed: defBlocks } = excise(html, 'div', 'definitions');

    const pronBlock = html.match(/<div class="pronunciation">([\s\S]*?)<\/div>/);
    if (pronBlock) {
      const orths = [...pronBlock[1].matchAll(/<a class="orth[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
        .map((m) => stripHtml(m[1]))
        .filter(Boolean);
      if (orths.length) out.altterm = orths.join(', ');
      const p = stripHtml(
        pronBlock[1].replace(/<a class="orth[^"]*"[\s\S]*?<\/a>/g, '').replace(/\balso\b/g, ''),
      ).replace(/[()]/g, '').replace(/\s+/g, '');
      if (p) out.pronunciation = p;
    }

    const sources = defBlocks.length ? [...defBlocks.map((b) => b.inner), rest] : [html];
    for (const src of sources) parseSource(src, out, rel);

    const inflections = parseInflections(html);
    if (inflections.length) out.inflections = inflections;

    for (const m of html.matchAll(
      /<span class="hi rend-b">([^<]+)<\/span>\s*is explained at\s*<a class="xr ref"/g,
    )) {
      rel(m[1], 'expression');
    }

    return out;
  },
};
