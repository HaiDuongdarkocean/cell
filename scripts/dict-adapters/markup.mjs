export const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

// Yields {inner, start, end, tag} for each TOP-LEVEL <tag class="...cls...">
// block, balancing nested same-tag open/close — required because dictionary
// markup nests spans/divs. Nested blocks live inside `inner`; re-call blocks()
// on inner to reach them.
export function* blocks(html, tag, cls) {
  const open = new RegExp(`<${tag}(?=[\\s>])[^>]*\\bclass="[^"]*?(?<![-\\w])${cls}(?![-\\w])[^"]*"[^>]*>`, 'g');
  const close = new RegExp(`</${tag}>|<${tag}(?=[\\s>])`, 'g');
  let m;
  while ((m = open.exec(html))) {
    let depth = 1;
    const innerStart = open.lastIndex;
    close.lastIndex = innerStart;
    let c;
    while ((c = close.exec(html))) {
      if (c[0].startsWith('</')) {
        if (--depth === 0) break;
      } else depth++;
    }
    if (depth !== 0) break;
    yield { inner: html.slice(innerStart, c.index), start: m.index, end: close.lastIndex, tag: m[0] };
    open.lastIndex = close.lastIndex;
  }
}

// Removes all blocks of a class from html (e.g. sub-entry regions before
// parsing the parent) and returns the remainder plus the removed inners.
export function excise(html, tag, cls, pred) {
  const list = [...blocks(html, tag, cls)].filter((b) => !pred || pred(b));
  if (!list.length) return { rest: html, removed: [] };
  let rest = '';
  let cursor = 0;
  for (const b of list) {
    rest += html.slice(cursor, b.start);
    cursor = b.end;
  }
  rest += html.slice(cursor);
  return { rest, removed: list };
}

export const blockText = (html, tag, cls) => {
  const first = blocks(html, tag, cls).next();
  return first.done ? '' : stripHtml(first.value.inner);
};
