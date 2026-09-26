// Table-row markup adapter — records shaped as a <TABLE> of <TR id=*_T_id>
// rows: pa (pronunciation), tl (pos header, red fonts carry word forms),
// mn (sense gloss), mh / mh_n (example + translation), tn_* (phrasal/idiom
// sub-entries), pak (usage note), cvk_t (variant spelling), XXX (spacer).
// Unknown rows degrade to note lines on the current sense — content is
// never dropped, but unknown shapes never split senses.

import { stripHtml } from './markup.mjs';

const TR_ROW = /<TR id=(\w+)[^>]*>([\s\S]*?)<\/TR>/g;
const FORM_FONT = /<FONT color=#FF0000[^>]*>([\s\S]*?)<\/FONT>/gi;
const MARK = '\u0001';
const FORMS_ONLY_PAREN = new RegExp(`\\((?:[\\s;,]|${MARK}[^\\u0001]*${MARK})*\\)`, 'g');

function parseTrHead(rowHtml) {
  const forms = [...rowHtml.matchAll(FORM_FONT)].map((m) => stripHtml(m[1])).filter(Boolean);
  // Forms are already captured as inflections — the pos line must not repeat
  // them. Parentheses carrying only forms+separators drop wholesale ("ngoại
  // động từ (bore ; borne , born)"); forms inside descriptive parens or after
  // "là"/"thành" stay inline — they are grammar text ("số ít was",
  // "rút gọn thành shan't").
  const marked = rowHtml.replace(FORM_FONT, (_m, inner) => `${MARK}${stripHtml(inner)}${MARK}`);
  const plain = stripHtml(marked).replace(FORMS_ONLY_PAREN, '');
  let pos = '';
  let i = 0;
  let depth = 0;
  for (;;) {
    const start = plain.indexOf(MARK, i);
    const chunk = plain.slice(i, start === -1 ? undefined : start);
    pos += chunk;
    depth += (chunk.match(/\(/g)?.length ?? 0) - (chunk.match(/\)/g)?.length ?? 0);
    if (start === -1) break;
    const end = plain.indexOf(MARK, start + 1);
    if (depth > 0 || /\b(?:là|thành)\s*$/.test(pos)) pos += plain.slice(start + 1, end);
    i = end + 1;
  }
  pos = pos
    .replace(/\s*&&\s*/g, ' & ')
    .replace(/\s+[;,](?=\s*[;,()])/g, '')
    .replace(/[;,](?=\s*\))/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s;,]+$/, '')
    .trim();
  return { pos, forms };
}

export const trTableRows = {
  name: 'tr-table-rows',
  matches: (html) => html.includes('_T_id'),
  parse(html) {
    const out = { senses: [], related: [], spawned: [] };
    const relatedSeen = new Set();
    let pos = '';
    let sense = null;
    let phrase = null;
    for (const m of html.matchAll(TR_ROW)) {
      const id = m[1].replace('_ss_T_id', '_T_id');
      const text = stripHtml(m[2]);
      switch (id) {
        case 'pa_T_id':
          out.pronunciation = text.replace(/^\[|\]$/g, '');
          break;
        case 'tl_T_id': {
          const head = parseTrHead(m[2]);
          pos = head.pos;
          if (head.forms.length) {
            (out.inflections ??= []).push({ type: '', forms: head.forms });
          }
          sense = null;
          phrase = null;
          break;
        }
        case 'mn_T_id':
          sense = { pos: pos || undefined, lines: [{ role: 'gloss', text }] };
          out.senses.push(sense);
          phrase = null;
          break;
        case 'mh_T_id':
          sense?.lines.push({ role: 'example', text });
          break;
        case 'mh_n_T_id': {
          const ex = sense?.lines.findLast((l) => l.role === 'example' && !l.translation);
          if (ex) ex.translation = text;
          break;
        }
        case 'tn_T_id': {
          const term = text.replace(/^to\s+/i, '').replace(/^"|"$/g, '');
          phrase = { term, lines: [] };
          out.spawned.push(phrase);
          const key = term.toLowerCase();
          if (term && !relatedSeen.has(key)) {
            relatedSeen.add(key);
            out.related.push({ term, kind: 'phrasal' });
          }
          break;
        }
        case 'tn_n_T_id':
          if (phrase) {
            phrase.lines.push({ role: 'gloss', text });
            const rel = out.related.findLast((r) => r.term === phrase.term);
            if (rel && !rel.preview) rel.preview = text;
          }
          break;
        case 'tn_mh_T_id':
          phrase?.lines.push({ role: 'example', text });
          break;
        case 'tn_mh_n_T_id': {
          const ex = phrase?.lines.findLast((l) => l.role === 'example' && !l.translation);
          if (ex) ex.translation = text;
          break;
        }
        case 'pak_T_id':
          if (sense) sense.lines.push({ role: 'note', text });
          break;
        case 'cvk_t_T_id':
          out.altterm = out.altterm ? `${out.altterm}, ${text}` : text;
          break;
        case 'cvk_T_id':
        case 'XXX':
          break;
        default:
          if (sense && text) sense.lines.push({ role: 'note', text });
      }
    }
    out.spawned = out.spawned
      .filter((p) => p.lines.length)
      .map((p) => ({ term: p.term, senses: [{ pos: 'phrasal verb', lines: p.lines }] }));
    return out;
  },
};
