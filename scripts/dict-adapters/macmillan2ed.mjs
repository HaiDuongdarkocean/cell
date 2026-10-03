// Macmillan 2nd Ed markup adapter — font-tag records: `▪ ROMAN.` homograph
// markers + `<sup>N</sup>`, `>UK<`/`>US<` accent labels each followed by a
// `sound://zzz_(uk|us)_*.wav` link and a `[ipa]` in color #21887d, pos in
// color #6020ae, `★` frequency stars, numbered senses (`<b>N.</b>` /
// `<b>Na.</b>`) with `[bracket]`/`orangered` labels and italic examples.
// Emits one entry per homograph with dual-accent prons; a homograph missing
// one accent keeps whatever it has; unparsable senses still emit a
// prons-only enrichment row (spec pos-dictionary-variants REQ-3).

import { stripHtml } from './markup.mjs';

const ACCENT_RE = />(UK|US)<\/font>\s*<a href="(sound:\/\/[^"]+)"[^>]*>[\s\S]*?<font color="#21887d">\[([^\]]+)\]<\/font>/g;
const POS_RE = /<font color="#6020ae">([^<]+)<\/font>/;
const LABEL_RE = /<font color="(?:#a64728|orangered)">([\s\S]*?)<\/font>/g;
const SENSE_NUM_RE = /<b>\s*\d+[a-z]?\s*\./;
const THES_RE = /Thesaurus:/;
const ENTRY_LINK_RE = /<a href="entry:\/\/([^"]+)"[^>]*>/g;

function parseProns(head) {
  const prons = [];
  for (const m of head.matchAll(ACCENT_RE)) {
    prons.push({ accent: m[1] === 'UK' ? 'BrE' : 'AmE', ipa: m[3].trim(), audioRef: m[2] });
  }
  return prons;
}

function parseSenses(frag, pos, rel) {
  const senses = [];
  let current = null;
  for (const line of frag.split(/<br\s*\/?>/i)) {
    const text = stripHtml(line);
    if (!text) continue;
    if (THES_RE.test(line)) {
      for (const m of line.matchAll(ENTRY_LINK_RE)) rel(m[1], 'thesaurus');
      continue;
    }
    if (SENSE_NUM_RE.test(line)) {
      const labels = [...line.matchAll(LABEL_RE)]
        .map((m) => stripHtml(m[1]).replace(/^\[|\]$/g, '').trim())
        .filter(Boolean);
      const gloss = stripHtml(line.replace(LABEL_RE, ''))
        .replace(/^\d+[a-z]?\s*\.\s*/, '').trim();
      current = { ...(pos ? { pos } : {}), ...(labels.length ? { labels } : {}), lines: [] };
      if (gloss) current.lines.push({ role: 'gloss', text: gloss });
      senses.push(current);
      continue;
    }
    if (/<em>/.test(line)) {
      if (!current) continue;
      current.lines.push({ role: 'example', text });
      continue;
    }
    if (/<b>|<img/.test(line)) continue;
    const gloss = stripHtml(line.replace(LABEL_RE, ''));
    const labels = [...line.matchAll(LABEL_RE)]
      .map((m) => stripHtml(m[1]).replace(/^\[|\]$/g, '').trim())
      .filter(Boolean);
    if (!gloss) continue;
    if (!current) {
      current = { ...(pos ? { pos } : {}), ...(labels.length ? { labels } : {}), lines: [] };
      senses.push(current);
    }
    current.lines.push({ role: 'gloss', text: gloss });
  }
  return senses.filter((s) => s.lines.length);
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
      const pos = frag.match(POS_RE)?.[1]?.trim();
      if (pos) entry.pos = pos;
      const prons = parseProns(head);
      if (prons.length) {
        entry.prons = prons;
        entry.pronunciation = prons[0].ipa;
      }
      const stars = (head.match(/★/g) ?? []).length;
      if (stars) entry.frequencyStars = Math.min(3, stars);
      entry.senses = parseSenses(frag, pos, rel);
      if (!entry.senses.length && !prons.length) continue;
      entries.push(entry);
    }

    if (entries.length) out.entries = entries;
    return out;
  },
};
