/**
 * Remove text enclosed in (), [], or {} along with the brackets.
 * Handles one level of nesting so that overlapping brackets are removed
 * from the innermost open to the matching close.
 */
export function removeBracketedText(text: string): string {
  const keep = new Array(text.length).fill(true);
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') {
      stack.push(i);
    } else if (stack.length > 0) {
      const last = stack[stack.length - 1] ?? -1;
      const open = text[last];
      if (
        (open === '(' && c === ')') ||
        (open === '[' && c === ']') ||
        (open === '{' && c === '}')
      ) {
        const start = stack.pop() ?? i;
        for (let j = start; j <= i; j++) {
          keep[j] = false;
        }
      }
    }
  }
  // Any unclosed opening brackets are removed (but their contents stay).
  for (const i of stack) {
    keep[i] = false;
  }
  return text.split('').filter((_, i) => keep[i]).join('');
}
