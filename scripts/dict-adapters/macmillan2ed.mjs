// Macmillan 2nd Ed markup adapter — font-tag records: `▪ ROMAN.` homograph
// markers + `<sup>N</sup>`, `>UK<`/`>US<` accent labels each followed by a
// `sound://zzz_(uk|us)_*.wav` link and a `[ipa]` in color #21887d, pos in
// color #6020ae, numbered senses (`<b>N.</b>` /
// `<b>Na.</b>`) with `[bracket]`/`orangered` labels and italic examples.
// Emits one entry per homograph with dual-accent prons; a homograph missing
// one accent keeps whatever it has; unparsable senses still emit a
// prons-only enrichment row (spec pos-dictionary-variants REQ-3).

import { stripHtml } from './markup.mjs';

const ACCENT_RE = />(UK|US)<\/font>\s*<a href="(sound:\/\/[^"]+)"[^>]*>[\s\S]*?<font color="#21887d">\[([^\]]+)\]<\/font>/g;
const POS_RE = /<font color="#6020ae">([^<]+)<\/font>/;
const ALL_LABEL_FONT_RE = /<font color="(#a64728|orangered|#ff5400|#af7f7f)">([\s\S]*?)<\/font>/g;
const REGISTER2_COLORS = new Set(['#ff5400', '#af7f7f']);
const NON_LABEL_TEXTS = new Set([
  'hyponym', 'synonym', 'antonym', 'past tense', 'past participle',
  'present participle', 'plural', '3rd person singular', 'ing form', 'ed form',
]);

function parseLabels2ed(line) {
  const labels = [];
  let register = [];
  for (const m of line.matchAll(ALL_LABEL_FONT_RE)) {
    const text = stripHtml(m[2]).replace(/^\s*\[|\]\s*$/g, '').trim();
    if (!text || NON_LABEL_TEXTS.has(text.toLowerCase())) continue;
    if (REGISTER2_COLORS.has(m[1])) {
      register.push(text);
      continue;
    }
    if (register.length) {
      labels.push(register.join(' '));
      register = [];
    }
    labels.push(text);
  }
  if (register.length) labels.push(register.join(' '));
  return labels;
}
const SENSE_NUM_RE = /<b>\s*(\d+)([a-z]?)\s*\./;
const BOLD_RE = /<b>([\s\S]*?)<\/b>/g;
const SENSE_NUM_TEXT_RE = /^\d+[a-z]?\s*\.$/;
const THES_RE = /Thesaurus:/;
const ENTRY_LINK_RE = /<a href="entry:\/\/([^"]+)"[^>]*>/g;

function boldPatterns(text) {
  return [...text.matchAll(BOLD_RE)]
    .map((m) => stripHtml(m[1]).trim())
    .filter((t) => t && !t.includes('▪') && !SENSE_NUM_TEXT_RE.test(t));
}

function parseProns(head) {
  const prons = [];
  for (const m of head.matchAll(ACCENT_RE)) {
    prons.push({ accent: m[1] === 'UK' ? 'BrE' : 'AmE', ipa: m[3].trim(), audioRef: m[2] });
  }
  return prons;
}

function addRelation(target, term) {
  if (!term) return;
  target.synonymGroups = [...(target.synonymGroups ?? []), { words: [term] }];
  target.synonyms = [...new Set([...(target.synonyms ?? []), term])];
}

function parseSenses(frag, pos, rel) {
  const senses = [];
  let current = null;
  let currentNum = '';
  let currentSub = null;
  let pattern;
  for (const line of frag.split(/<br\s*\/?>/i)) {
    const text = stripHtml(line);
    if (!text) continue;
    if (THES_RE.test(line)) {
      const target = currentSub ?? current;
      for (const m of line.matchAll(ENTRY_LINK_RE)) {
        rel(m[1], 'thesaurus');
        if (target) addRelation(target, stripHtml(m[1]));
      }
      continue;
    }
    const num = line.match(SENSE_NUM_RE);
    if (num) {
      pattern = undefined;
      const labels = parseLabels2ed(line);
      const gloss = stripHtml(line.replace(ALL_LABEL_FONT_RE, ''))
        .replace(/^\d+[a-z]?\s*\.\s*/, '').trim();
      if (num[2] && current && num[1] === currentNum) {
        currentSub = { num: num[2], text: gloss, ...(labels.length ? { labels } : {}) };
        current.subsenses = [...(current.subsenses ?? []), currentSub];
        continue;
      }
      currentSub = null;
      currentNum = num[1];
      current = { ...(pos ? { pos } : {}), ...(labels.length ? { labels } : {}), lines: [] };
      if (gloss) current.lines.push({ role: 'gloss', text: gloss });
      senses.push(current);
      continue;
    }
    if (/<em>/.test(line)) {
      const emIdx = line.indexOf('<em>');
      const head = line.slice(0, emIdx);
      const pats = boldPatterns(head);
      const mid = stripHtml(head.replace(BOLD_RE, ''));
      const glossBits = [...mid.matchAll(/\([^)]*\)/g)].map((m) => m[0]);
      if (pats.length || glossBits.length) pattern = `[${[...pats, ...glossBits].join(' ')}]`;
      const exText = stripHtml(line.slice(emIdx)).trim();
      if (exText) {
        const ex = { role: 'example', text: exText, ...(pattern ? { pattern } : {}) };
        if (currentSub) {
          currentSub.examples = [...(currentSub.examples ?? []), ex];
        } else if (current) {
          current.lines.push(ex);
        }
      }
      continue;
    }
    if (/<b>|<img/.test(line)) {
      const pats = boldPatterns(line);
      if (pats.length) pattern = `[${pats.join(' ')}]`;
      continue;
    }
    const gloss = stripHtml(line.replace(ALL_LABEL_FONT_RE, ''));
    const labels = parseLabels2ed(line);
    if (!gloss) continue;
    if (!current) {
      current = { ...(pos ? { pos } : {}), ...(labels.length ? { labels } : {}), lines: [] };
      senses.push(current);
    } else if (labels.length && !current.labels?.length) {
      current.labels = labels;
    }
    current.lines.push({ role: 'gloss', text: gloss });
  }
  return senses.filter((s) => s.lines.length || s.subsenses?.length);
}

export const macmillan2ed = {
  name: 'macmillan-2ed',
  matches: (html) =>
    html.includes('sound://zzz_uk_') || html.includes('sound://zzz_us_'),
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

    const parts = html.split(/(?=<b><font color="#b904af">▪)/);
    const homographs = parts.length > 1
      ? parts.filter((p) => p.includes('▪'))
      : [html];

    const entries = [];
    for (const frag of homographs) {
      const head = frag.split(/<br\s*\/?>/i)[0] ?? frag;
      const entry = { senses: [] };
      // #6020ae is reused for the `variant` cross-reference label — it is not
      // a pos; only accept real pos labels (allow comma-joined multi-pos).
      const posRaw = frag.match(POS_RE)?.[1]?.trim();
      const pos = posRaw && posRaw !== 'variant' ? posRaw : '';
      if (pos) entry.pos = pos;
      const prons = parseProns(head);
      if (prons.length) {
        entry.prons = prons;
        entry.pronunciation = prons[0].ipa;
      }
      entry.senses = parseSenses(frag, pos, rel);
      if (!entry.senses.length && !prons.length) continue;
      entries.push(entry);
    }

    if (entries.length) out.entries = entries;
    return out;
  },
};
