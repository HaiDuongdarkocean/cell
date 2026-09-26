// Etymology-prose adapter — `div.word` entries: `h1.hw`/`p.hw` headword with
// `<pos>` tag (part-of-speech or homograph number), one or more
// `section.defination` blocks whose `<p>` paragraphs are etymology prose, and
// a trailing `div.related` listing `related_word` headwords that link back to
// this entry (excised — its snippets belong to other entries).
//
// Output is entry-level `etymology`, not senses: the whole record IS word
// origin, so it merges into the canonical origin block alongside other
// dictionaries' etymologies. First `div.word` block → `chain`; additional
// homograph blocks → `variants` labeled by their `<pos>`.

import { stripHtml, blocks, excise } from './markup.mjs';

export const etymonline = {
  name: 'etymonline',
  matches: (html) => html.includes('class="defination"') && html.includes('class="hw"'),
  parse(html) {
    const { rest } = excise(html, 'div', 'related');
    const chains = [];

    for (const { inner: word } of blocks(rest, 'div', 'word')) {
      const posRaw = word.match(/<[hp]1? class="hw">[\s\S]*?<pos>([\s\S]*?)<\/pos>/)?.[1] ?? '';
      const pos = stripHtml(posRaw).replace(/\.+$/, '').trim();
      const posText = /^\d+$/.test(pos) ? '' : pos;

      const paragraphs = [];
      for (const { inner: sec } of blocks(word, 'section', 'defination')) {
        for (const m of sec.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
          const text = stripHtml(m[1]).replace(/\s+/g, ' ').trim();
          if (text) paragraphs.push(text);
        }
      }
      if (paragraphs.length) {
        chains.push({ pos: posText, text: paragraphs.join(' ') });
      }
    }

    if (!chains.length) return null;
    return {
      etymology: {
        chain: chains[0].text,
        variants: chains.slice(1).map((c) => (c.pos ? { text: c.text, source: c.pos } : { text: c.text })),
      },
    };
  },
};
