/**
 * Escape-layer stack — shared LIFO ordering for layered overlays that listen
 * for Escape at the document level.
 *
 * Why this exists: React 17+ delegates `onKeyDown` handlers to the React root
 * container, so a plain `document.addEventListener('keydown', …)` (bubble
 * phase) runs AFTER every React synthetic handler on ancestor surfaces — e.g.
 * UniversalPanel's `onKeyDown` would already have closed the whole panel by
 * the time a Select menu's document listener ran. Instead, a single
 * capture-phase listener on the document fires first in the propagation path;
 * `stopPropagation()` there prevents the event from ever reaching React.
 *
 * Multiple listeners on the same node fire in registration order even with
 * `stopPropagation()` (only `stopImmediatePropagation` would help, and order
 * would still be outermost-first), so all document-level Escape consumers
 * share one listener + a LIFO stack: the most recently pushed layer wins.
 * One Escape = at most one layer closes.
 */

/** Handler invoked when this layer is the topmost and Escape is pressed. */
export type EscapeLayerHandler = (e: KeyboardEvent) => void;

interface DocumentEscapeStack {
  handlers: EscapeLayerHandler[];
  listener: (e: KeyboardEvent) => void;
}

const stacks = new Map<Document, DocumentEscapeStack>();

/**
 * Pushes `handler` as a new Escape layer on `doc`'s stack and returns an
 * unregister function (idempotent). While any layer is registered, Escape is
 * consumed in the capture phase before it reaches React's synthetic handlers
 * or lower layers; only the topmost handler runs.
 */
export function pushEscapeLayer(
  handler: EscapeLayerHandler,
  doc: Document = document,
): () => void {
  let stack = stacks.get(doc);
  if (!stack) {
    const handlers: EscapeLayerHandler[] = [];
    const listener = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const top = handlers[handlers.length - 1];
      if (top === undefined) return;
      e.stopPropagation();
      top(e);
    };
    stack = { handlers, listener };
    doc.addEventListener('keydown', listener, true);
    stacks.set(doc, stack);
  }
  stack.handlers.push(handler);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const index = stack.handlers.lastIndexOf(handler);
    if (index !== -1) stack.handlers.splice(index, 1);
    if (stack.handlers.length === 0) {
      doc.removeEventListener('keydown', stack.listener, true);
      stacks.delete(doc);
    }
  };
}
