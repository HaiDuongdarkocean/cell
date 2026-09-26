// OALD-markup adapter — `.entry` blocks per headword: `h1.headword` +
// `span.pos`, `phons_br`/`phons_n_am .phon`
// pronunciations, `li.sense` (cefr/ox3000/sensenum attrs) with `.grammar`
// [labels], `.use` restriction note, `.cf` construction pattern, `.def` gloss,
// `ul.examples > li` (`.cf` + `.labels` + `.x`), `.xrefs xt=nsyn`→synonyms /
// xt=see→related. `span.idm-g` idiom sub-entries → related 'idiom' + spawned.
// `aside.phrasal_verb_links .pvrefs` → related 'phrasal'. `.unbox` boxes:
// verbforms→inflections, wordorigin→etymology, synonyms/mlt→thesaurus links.

import { stripHtml, blocks, blockText, excise } from './markup.mjs';

const stripBrackets = (s) => stripHtml(s).replace(/^\[|\]$|^\(|\)$/g, '').trim();

function parseSenseLi(inner, tag, pos) {
  const labels = [...blocks(inner, 'span', 'grammar')]
    .map(({ inner: g }) => stripBrackets(g))
    .filter(Boolean);
  const topic = blockText(inner, 'span', 'topic_name');
  if (topic) labels.push(topic);
  const gloss = blockText(inner, 'span', 'def');
  const cf = blockText(inner, 'span', 'cf');
  const use = blockText(inner, 'span', 'use');
  const lines = [];
  if (gloss) {
    lines.push({ role: 'gloss', text: gloss, ...(cf ? { pattern: `[${cf}]` } : {}) });
  }
  if (use) lines.push({ role: 'note', text: use });
  for (const { inner: ul } of blocks(inner, 'ul', 'examples')) {
    for (const m of ul.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const li = m[1];
      const x = blockText(li, 'span', 'x');
      if (!x) continue;
      const exCf = blockText(li, 'span', 'cf');
      const exLab = blockText(li, 'span', 'labels');
      lines.push({
        role: 'example',
        text: exLab ? `${exLab} ${x}` : x,
        ...(exCf ? { pattern: `[${exCf}]` } : {}),
      });
    }
  }
  if (!lines.length) return null;
  const sense = {
    ...(pos ? { pos } : {}),
    ...(labels.length ? { labels } : {}),
    lines,
  };
  const cefr = tag.match(/cefr="(\w+)"/)?.[1];
  if (cefr) sense.level = cefr.toUpperCase();
  const syns = [
    ...new Set(
      [...blocks(inner, 'span', 'xrefs')]
        .filter((b) => b.tag.includes('xt="nsyn"'))
        .flatMap((b) => [...blocks(b.inner, 'span', 'xh')].map((x) => stripHtml(x.inner)))
        .filter(Boolean),
    ),
  ];
  if (syns.length) sense.synonyms = syns;
  return sense;
}

export const oald = {
  name: 'oald10',
  matches: (html) => html.includes('class="oald"') || html.includes('class="webtop"'),
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

    for (const { inner: aside } of blocks(html, 'aside', 'phrasal_verb_links')) {
      for (const m of aside.matchAll(/<span class="xh">([\s\S]*?)<\/span>/g)) rel(m[1], 'phrasal');
    }

    for (const { inner: entry } of blocks(html, 'div', 'entry')) {
      const pos = blockText(entry, 'span', 'pos');
      const pron = blockText(entry, 'span', 'phon').replace(/^\/+|\/+$/g, '');
      if (pron && !out.pronunciation) out.pronunciation = pron;

      const { rest: noIdm, removed: idms } = excise(entry, 'span', 'idm-g');
      const { rest: noAside } = excise(noIdm, 'aside', 'phrasal_verb_links');
      const { rest, removed: unboxes } = excise(noAside, 'span', 'unbox');
      const extraExamples = [];

      for (const { inner: u, tag } of unboxes) {
        const kind = tag.match(/unbox="(\w+)"/)?.[1];
        if (kind === 'verbforms') {
          for (const { inner: row } of blocks(u, 'td', 'verb_form')) {
            const type = blockText(row, 'span', 'vf_prefix');
            const form = stripHtml(row.replace(/<span class="vf_prefix">[\s\S]*?<\/span>/, ''));
            if (!type || !form) continue;
            const g = (out.inflections ??= []).find((x) => x.type === type);
            if (g) {
              if (!g.forms.includes(form)) g.forms.push(form);
            } else {
              out.inflections.push({ type, forms: [form] });
            }
          }
        } else if (kind === 'wordorigin') {
          const text = blockText(u, 'span', 'p') || stripHtml(u);
          if (text && !out.etymology) out.etymology = { chain: text };
        } else if (kind === 'synonyms' || kind === 'mlt') {
          for (const m of u.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
            rel(m[1], 'thesaurus');
          }
        } else if (kind === 'extra_examples') {
          for (const m of u.matchAll(/<span class="x">([\s\S]*?)<\/span>/g)) {
            const text = stripHtml(m[1]);
            if (text) extraExamples.push(text);
          }
        }
      }

      for (const { inner: idm } of idms) {
        const term = blockText(idm, 'span', 'idm');
        if (!term) continue;
        rel(term, 'idiom');
        const senses = [...blocks(idm, 'li', 'sense')]
          .map((s) => parseSenseLi(s.inner, s.tag, 'idiom'))
          .filter(Boolean);
        if (senses.length) out.spawned.push({ term, senses });
      }

      for (const b of blocks(rest, 'span', 'xrefs')) {
        if (b.tag.includes('xt="see"')) {
          for (const { inner: xh } of blocks(b.inner, 'span', 'xh')) rel(xh, 'expression');
        }
      }

      for (const s of blocks(rest, 'li', 'sense')) {
        const sense = parseSenseLi(s.inner, s.tag, pos);
        if (sense) out.senses.push(sense);
      }
      const last = out.senses[out.senses.length - 1];
      if (extraExamples.length && last) {
        for (const text of extraExamples) last.lines.push({ role: 'example', text });
      }
    }

    return out;
  },
};
