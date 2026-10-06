const ATTR = 'data-cell-surface-open';
let open = 0;

export function acquireSurfaceLayer(doc: Document = document): () => void {
  open++;
  doc.documentElement.setAttribute(ATTR, String(open));
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    open--;
    if (open <= 0) {
      open = 0;
      doc.documentElement.removeAttribute(ATTR);
      return;
    }
    doc.documentElement.setAttribute(ATTR, String(open));
  };
}
