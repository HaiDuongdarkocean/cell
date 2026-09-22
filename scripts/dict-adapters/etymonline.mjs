// Etymology-prose adapter — `div.word` entries: `h1.hw`/`p.hw` headword with
// `<pos>` tag (part-of-speech or homograph number), one or more
// `section.defination` blocks whose `<p>` paragraphs are etymology prose,
// `a.crossreference[href=entry://…]` in-text see-also links, and a trailing
// `div.related` listing `related_word` headwords that link back to this
// entry. Each defination section becomes one sense; paragraphs are gloss
// lines so the full origin text stays checkable like any definition.

import { stripHtml, blocks, excise } from './markup.mjs';

const entryTerm = (href) => {
  const m = href.match(/^entry:\/\/([^#]+)/);
  return m ? decodeURIComponent(m[1]).trim() : '';
};

export const etymonline = {
  name: 'etymonline',
  matches: (html) => html.includes('class="defination"') && html.includes('class="hw"'),
  parse(html) {
    const out = { senses: [], related: [] };
    const relatedSeen = new Set();
    const rel = (term) => {
      const key = term.toLowerCase();
      if (term && !relatedSeen.has(key)) {
        relatedSeen.add(key);
        out.related.push({ term, kind: 'see also' });
      }
    };

    const { rest } = excise(html, 'div', 'related');

    for (const { inner: word } of blocks(rest, 'div', 'word')) {
      const posRaw = word.match(/<[hp]1? class="hw">[\s\S]*?<pos>([\s\S]*?)<\/pos>/)?.[1] ?? '';
      const pos = stripHtml(posRaw).replace(/\.+$/, '').trim();
      const posText = /^\d+$/.test(pos) ? '' : pos;
      for (const { inner: sec } of blocks(word, 'section', 'defination')) {
        const lines = [...sec.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
          .map((m) => ({ role: 'gloss', text: stripHtml(m[1]).replace(/\s+/g, ' ').trim() }))
          .filter((l) => l.text);
        if (lines.length) {
          out.senses.push({
            ...(posText ? { pos: posText } : {}),
            labels: ['origin'],
            lines,
          });
        }
        for (const m of sec.matchAll(/<a\b[^>]*class="crossreference[^"]*"[^>]*href="([^"]+)"|<a\b[^>]*href="([^"]+)"[^>]*class="crossreference[^"]*"/g)) {
          rel(entryTerm(m[1] ?? m[2] ?? ''));
        }
      }
    }

    for (const m of html.matchAll(/<a\b[^>]*class="related_hw[^"]*"[^>]*href="([^"]+)"|<a\b[^>]*href="([^"]+)"[^>]*class="related_hw[^"]*"/g)) {
      rel(entryTerm(m[1] ?? m[2] ?? ''));
    }

    return out;
  },
};
