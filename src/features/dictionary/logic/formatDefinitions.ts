const BULLET_PREFIX_RE = /^(?:\s*•\s*)+/;

/** Format selected definitions for Card Creator / Quick Add:
 *  - Each definition: `• {pos} {text}` (or `• {text}` if no pos)
 *  - Definitions separated by exactly one blank line (\n\n)
 *  Respects user selection — only checked definitions are included.
 *  Strips any leading `•` characters already present in the source text so
 *  the output always has exactly one bullet. */
export function formatDefinitions(defs: readonly { readonly pos?: string; readonly text: string }[]): string {
  return defs
    .map((d) => {
      const text = d.text.replace(BULLET_PREFIX_RE, '');
      return `• ${d.pos ? `${d.pos} ` : ''}${text}`.trim();
    })
    .join('\n\n')
    .trim();
}
