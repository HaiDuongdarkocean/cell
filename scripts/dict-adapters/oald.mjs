// OALD-markup adapter — `.entry` blocks per homograph: `h1.headword` +
// `span.pos`, `phons_br`/`phons_n_am .phon` (+ `sound://` refs) pronunciations,
// `@ox3000&level=` entry CEFR, `li.sense` (cefr/ox3000/sensenum attrs) with
// `.grammar` [labels], `.dis-g` qualifiers, `.use` restriction note, `.cf`
// construction pattern, `.def` gloss, `ul.examples > li` (`.cf` + `.labels` +
// `.x`), `.xrefs xt=nsyn`→synonyms / xt=see→related. `span.idm-g` idiom
// sub-entries → related 'idiom' + spawned. `aside.phrasal_verb_links .pvrefs`
// → related 'phrasal'. `.unbox` boxes: verbforms→inflections + spawned
// form entries (form→lemma note + per-form prons — inflected forms have no
// own keys in the mdx), wordorigin→etymology, which_word→note lines,
// synonyms/mlt→thesaurus links. Emits `entries[]` — one per homograph.

import { stripHtml, blocks, blockText, excise } from './markup.mjs';

const stripBrackets = (s) => stripHtml(s).replace(/^\[|\]$|^\(|\)$/g, '').trim();

const ACCENT_BY_CLASS = { phons_br: 'BrE', phons_n_am: 'AmE' };

// BrE/NAmE prons out of a scope that holds `.phons_br`/`.phons_n_am` divs —
// each carries `a[href=sound://]` + `span.phon` + `wd=` on the open tag.
function* pronsBlocks(scope) {
  for (const [cls, accent] of Object.entries(ACCENT_BY_CLASS)) {
    for (const b of blocks(scope, 'div', cls)) {
      const ipa = blockText(b.inner, 'span', 'phon').replace(/^\/+|\/+$/g, '');
      const audioRef = b.inner.match(/href="(sound:\/\/[^"]+)"/)?.[1];
      if (!ipa && !audioRef) continue;
      yield {
        pron: { accent, ipa, ...(audioRef ? { audioRef } : {}) },
        wd: b.tag.match(/\bwd="([^"]+)"/)?.[1] ?? '',
      };
    }
  }
}

const pronsOf = (scope) => {
  const seen = new Set();
  const prons = [];
  for (const { pron } of pronsBlocks(scope)) {
    if (seen.has(pron.accent)) continue;
    seen.add(pron.accent);
    prons.push(pron);
  }
  return prons;
};

function parseSenseLi(inner, tag, pos) {
  const labels = [...blocks(inner, 'span', 'grammar')]
    .map(({ inner: g }) => stripBrackets(g))
    .filter(Boolean);
  const qualifier = stripBrackets(blockText(inner, 'span', 'dis-g'));
  if (qualifier) labels.push(qualifier);
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
    const out = { related: [], spawned: [], entries: [] };
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
      const { rest: noIdm, removed: idms } = excise(entry, 'span', 'idm-g');
      const { rest: noAside } = excise(noIdm, 'aside', 'phrasal_verb_links');
      const { rest, removed: unboxes } = excise(noAside, 'span', 'unbox');

      const webtop = blocks(rest, 'div', 'webtop').next().value?.inner ?? rest;
      const headword = blockText(webtop, 'h1', 'headword');
      const e = { senses: [] };
      const pos = blockText(webtop, 'span', 'pos');
      if (pos) e.pos = pos;
      const prons = pronsOf(webtop);
      if (prons.length) {
        e.prons = prons;
        e.pronunciation = prons[0].ipa;
      }
      const level = webtop.match(/@ox3000&level=(\w+)/i)?.[1];
      if (level) e.level = level.toUpperCase();

      const extraExamples = [];
      const usageNotes = [];
      for (const { inner: u, tag } of unboxes) {
        const kind = tag.match(/unbox="(\w+)"/)?.[1];
        if (kind === 'verbforms') {
          for (const { inner: row } of blocks(u, 'tr', 'verb_form')) {
            const td = blocks(row, 'td', 'verb_form').next().value;
            if (!td) continue;
            const type = blockText(td.inner, 'span', 'vf_prefix');
            const form = stripHtml(
              td.inner.replace(/<span class="vf_prefix">[\s\S]*?<\/span>/, ''),
            );
            if (!type || !form) continue;
            const g = (e.inflections ??= []).find((x) => x.type === type);
            if (g) {
              if (!g.forms.includes(form)) g.forms.push(form);
            } else {
              e.inflections.push({ type, forms: [form] });
            }
            const byWd = new Map();
            for (const { pron, wd } of pronsBlocks(row)) {
              const key = wd || form;
              const list = byWd.get(key) ?? [];
              list.push(pron);
              byWd.set(key, list);
            }
            for (const [wd, wprons] of byWd.size ? byWd : [[form, []]]) {
              if (headword && wd.toLowerCase() === headword.toLowerCase()) continue;
              out.spawned.push({
                term: wd,
                senses: [
                  { lines: [{ role: 'note', text: `→ ${headword || form}` }] },
                ],
                ...(wprons.length ? { prons: wprons } : {}),
              });
            }
          }
        } else if (kind === 'wordorigin') {
          const text = blockText(u, 'span', 'p') || stripHtml(u);
          if (text && !e.etymology) e.etymology = { chain: text };
        } else if (kind === 'synonyms' || kind === 'mlt') {
          for (const m of u.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
            rel(m[1], 'thesaurus');
          }
        } else if (kind === 'which_word') {
          for (const m of u.matchAll(/<li class="li">([\s\S]*?)<\/li>/g)) {
            const text = stripHtml(m[1]);
            if (text) usageNotes.push(text);
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
        if (sense) e.senses.push(sense);
      }
      const last = e.senses[e.senses.length - 1];
      if (extraExamples.length && last) {
        for (const text of extraExamples) last.lines.push({ role: 'example', text });
      }
      for (const text of usageNotes) {
        e.senses.push({
          ...(pos ? { pos } : {}),
          labels: ['usage note'],
          lines: [{ role: 'note', text }],
        });
      }
      out.entries.push(e);
    }

    return out;
  },
};
