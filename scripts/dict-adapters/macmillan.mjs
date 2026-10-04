// Macmillan-markup adapter — records shaped as `.dict-american|.dict-british`
// homograph blocks: `.part-of-speech-ctx` pos, `.pron` pronunciation,
// `.wordforms` inflection table (Macmillan frequency stars intentionally
// NOT extracted — dictionary frequency is not imported; see ADR-113)
// (.inflection-type → .inflection-entry pairs), `.sense > .sense-body`
// (a.sense-num + .syntax-coding [labels] + .definition gloss + .examples >
// strong pattern headers / p.example + .thes thesaurus synonyms) +
// `.sub-senses` lettered subsenses, `li.pv-xref` phrasal links, `li.phr-xref`
// phrase links. `.dict-*-thesaurus` records are topic pages: each `.entry`
// becomes a related link with a gloss preview. `@@@LINK` handled by caller.

import { stripHtml, blocks, blockText } from './markup.mjs';

function parseExamples(frag) {
  const lines = [];
  let pattern;
  for (const { inner } of blocks(frag, 'div', 'examples')) {
    for (const m of inner.matchAll(/<strong>([\s\S]*?)<\/strong>|<p class="example">([\s\S]*?)<\/p>/g)) {
      if (m[1] !== undefined) {
        const p = stripHtml(m[1]).replace(/^\[|\]$/g, '').trim();
        if (p) pattern = `[${p}]`;
        continue;
      }
      const text = stripHtml(m[2]);
      if (text) {
        lines.push({ role: 'example', text, ...(pattern ? { pattern } : {}) });
      }
    }
  }
  return lines;
}

const ENTRY_LINK_WORD_RE = /<a href="entry:\/\/[^"#]+[^"]*"[^>]*>([^<]+)<\/a>/g;
const CATTITLE_RE = /<a\b[^>]*\bclass="[^"]*\bcattitle\b[^"]*"[^>]*>([\s\S]*?)<\/a>/;

function parseThes(frag) {
  const groups = [];
  for (const { inner } of blocks(frag, 'div', 'thes')) {
    for (const { inner: snip } of blocks(inner, 'div', 'thessnippet')) {
      const label = stripHtml(snip.match(CATTITLE_RE)?.[1] ?? '')
        .replace(/:\s*$/, '')
        .trim();
      const words = [
        ...new Set(
          [...blocks(snip, 'span', 'synonyms')].flatMap(({ inner: w }) =>
            [...w.matchAll(ENTRY_LINK_WORD_RE)].map((m) => stripHtml(m[1])).filter(Boolean),
          ),
        ),
      ];
      if (words.length) groups.push({ ...(label ? { label } : {}), words });
    }
  }
  return groups;
}

function applyRelations(target, frag) {
  const groups = parseThes(frag);
  if (!groups.length) return;
  target.synonymGroups = groups;
  target.synonyms = [...new Set(groups.flatMap((g) => g.words))];
}

const REGISTER_CLASSES = new Set(['dialect', 'style-level', 'subject-area']);
const LABEL_CLASSES = ['syntax-coding', 'restriction-class', 'dialect', 'style-level', 'subject-area'];

function parseLabels(frag) {
  const spans = [];
  for (const cls of LABEL_CLASSES) {
    for (const b of blocks(frag, 'span', cls)) {
      const text = stripHtml(b.inner).replace(/^\s*\[|\]\s*$/g, '').trim();
      if (text) spans.push({ cls, start: b.start, text });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const labels = [];
  let register = [];
  for (const s of spans) {
    if (REGISTER_CLASSES.has(s.cls)) {
      register.push(s.text);
      continue;
    }
    if (register.length) {
      labels.push(register.join(' '));
      register = [];
    }
    labels.push(s.text);
  }
  if (register.length) labels.push(register.join(' '));
  return labels;
}

const SEEALSO_LINK_RE = /<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g;

function parseSense(frag, pos, rel) {
  const subStart = frag.indexOf('<ol class="sub-senses');
  const main = subStart >= 0 ? frag.slice(0, subStart) : frag;
  const labels = parseLabels(main);
  const gloss = blockText(main, 'span', 'definition');
  const lines = [];
  if (gloss) lines.push({ role: 'gloss', text: gloss });
  lines.push(...parseExamples(main));
  if (!lines.length) return null;
  const sense = {
    ...(pos ? { pos } : {}),
    ...(labels.length ? { labels } : {}),
    lines,
  };
  applyRelations(sense, main);
  if (rel) {
    for (const { inner: seealso } of blocks(frag, 'div', 'seealso-group')) {
      for (const m of seealso.matchAll(SEEALSO_LINK_RE)) {
        rel(stripHtml(m[1].replace(/<sup>/g, ' <sup>')), 'see-also');
      }
    }
  }
  const subs = [];
  for (const { inner: subZone } of blocks(frag, 'ol', 'sub-senses')) {
    for (const { inner: body } of blocks(subZone, 'div', 'sub-sense-body')) {
      const num = stripHtml(body.match(/<a class="sense-num"[^>]*>([^<]+)<\/a>/)?.[1] ?? '');
      const text = blockText(body, 'span', 'definition');
      if (!text) continue;
      const sub = { ...(num ? { num } : {}), text };
      const subLabels = parseLabels(body);
      if (subLabels.length) sub.labels = subLabels;
      const examples = parseExamples(body);
      if (examples.length) sub.examples = examples;
      applyRelations(sub, body);
      subs.push(sub);
    }
  }
  if (subs.length) sense.subsenses = subs;
  return sense;
}

function parseProns(frag, accent) {
  const prons = [];
  let pendingAudio;
  let cursor = 0;
  for (const b of blocks(frag, 'span', 'pron')) {
    const seg = frag.slice(cursor, b.start);
    const audios = [...seg.matchAll(/href="(sound:\/\/[^"]+)"/g)];
    if (audios.length) pendingAudio = audios[audios.length - 1][1];
    const ipa = stripHtml(b.inner).replace(/^[\s/[\]]+|[\s/[\]]+$/g, '');
    if (ipa) {
      prons.push({ accent, ipa, ...(pendingAudio ? { audioRef: pendingAudio } : {}) });
      pendingAudio = undefined;
    }
    cursor = b.end;
  }
  return prons;
}

function parseInflections(frag) {
  const groups = new Map();
  for (const { inner: row } of blocks(frag, 'span', 'tr')) {
    const type = blockText(row, 'span', 'inflection-type');
    const form = blockText(row, 'span', 'inflection-entry');
    if (!type || !form) continue;
    if (!groups.has(type)) groups.set(type, { type, forms: [] });
    const g = groups.get(type);
    if (!g.forms.includes(form)) g.forms.push(form);
  }
  return [...groups.values()];
}

export const macmillan = {
  name: 'macmillan-ennen',
  matches: (html) =>
    html.includes('class="dict-american') ||
    html.includes('class="dict-british') ||
    html.includes('class="homograph"'),
  parse(html) {
    const out = { senses: [], related: [], spawned: [] };

    if (html.includes('thesaurusentry')) {
      const topic = blockText(html, 'h1', 'cattitle');
      for (const { inner } of blocks(html, 'div', 'entry')) {
        const term = stripHtml(inner.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '');
        const gloss = stripHtml(inner.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
        if (!term) continue;
        out.related.push({ term, kind: 'thesaurus', ...(gloss ? { preview: gloss } : {}) });
        out.senses.push({
          pos: 'thesaurus',
          lines: [{ role: 'gloss', text: gloss ? `${term} — ${gloss}` : term }],
        });
      }
      if (topic) {
        out.senses.unshift({ pos: 'thesaurus', lines: [{ role: 'note', text: `Words meaning: ${topic}` }] });
      }
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

    const homographs = [...blocks(html, 'div', 'homograph')];
    if (homographs.length) {
      const entries = [];
      for (const { inner: hom } of homographs) {
        const pos = blockText(hom, 'span', 'part-of-speech-ctx');
        const entry = { ...(pos ? { pos } : {}), senses: [] };
        const prons = parseProns(hom, 'AmE');
        if (prons.length) {
          entry.prons = prons;
          entry.pronunciation = prons[0].ipa;
        }
        const infl = parseInflections(hom);
        if (infl.length) entry.inflections = infl;
        for (const { inner: gref } of blocks(hom, 'div', 'gref-group')) {
          const type = blockText(gref, 'span', 'gref-type');
          const target = stripHtml(gref.match(/<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '');
          if (type && target) {
            entry.senses.push({ ...(pos ? { pos } : {}), lines: [{ role: 'gloss', text: `${type} ${target}` }] });
            rel(target, 'lemma');
          }
        }
        for (const { inner: senseFrag } of blocks(hom, 'div', 'sense')) {
          const sense = parseSense(senseFrag, pos, rel);
          if (sense) entry.senses.push(sense);
        }
        entries.push(entry);
      }
      out.entries = entries;
    } else {
      const prons = parseProns(html, 'AmE');
      if (prons.length) {
        out.prons = prons;
        out.pronunciation = prons[0].ipa;
      } else {
        const pron = blockText(html, 'span', 'pron').replace(/^\/+|\/+$/g, '');
        if (pron) out.pronunciation = pron;
      }
    }

    for (const m of html.matchAll(/<li class="pv-xref">[\s\S]*?<a href="entry:\/\/[^"]+">([\s\S]*?)<\/a>/g)) {
      rel(m[1], 'phrasal');
    }
    for (const m of html.matchAll(/<li class="phr-xref">[\s\S]*?<a href="entry:\/\/[^"]+">([\s\S]*?)<\/a>/g)) {
      rel(m[1], 'expression');
    }
    for (const { inner: thes } of blocks(html, 'div', 'thessnippet')) {
      const cat = thes.match(/<a href="entry:\/\/([^"]+)"[^>]*class="cattitle"[^>]*>|<a class="cattitle"[^>]*href="entry:\/\/([^"]+)"[^>]*>/);
      const topic = cat?.[1] ?? cat?.[2];
      if (topic) rel(topic, 'thesaurus');
    }
    for (const { inner: relDiv } of blocks(html, 'div', 'relatedentries')) {
      for (const m of relDiv.matchAll(/<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g)) {
        rel(m[1], 'derivative');
      }
    }

    if (!homographs.length) {
      for (const { inner: gref } of blocks(html, 'div', 'gref-group')) {
        const type = blockText(gref, 'span', 'gref-type');
        const target = stripHtml(gref.match(/<a href="entry:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '');
        if (type && target) {
          out.senses.push({ lines: [{ role: 'gloss', text: `${type} ${target}` }] });
          rel(target, 'lemma');
        }
      }
      for (const { inner: senseFrag } of blocks(html, 'div', 'sense')) {
        const sense = parseSense(senseFrag, '', rel);
        if (sense) out.senses.push(sense);
      }
    }

    return out;
  },
};
