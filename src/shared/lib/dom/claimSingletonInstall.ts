// After an extension reload, Chrome re-injects content scripts into already-
// open pages — each injection is a separate isolated world, so a module-level
// flag cannot dedupe them. A documentElement attribute IS shared across
// worlds, so it reliably gates one installer per document.
//
// This content script runs at document_start — documentElement can be null
// before <html> parses — so callers use the async form and the claim is
// deferred until the element exists. The check+set stays atomic because DOM
// access is synchronous within one JS turn.
export function runOncePerDocument(key: string, install: () => void): void {
  const tryInstall = (): void => {
    const el = document.documentElement;
    if (!el) {
      if (document.readyState === 'loading') {
        document.addEventListener('readystatechange', tryInstall, { once: true });
      }
      return;
    }
    const attr = `data-tihoka-singleton-${key}`;
    if (el.hasAttribute(attr)) return;
    el.setAttribute(attr, '1');
    install();
  };
  tryInstall();
}

/** Stacked content-script worlds each register their own keydown listener,
 * and one physical keypress is ONE Event object shared by all of them —
 * key+timeStamp identifies it. The first Tihoka handler to claim acts; the
 * rest return false so configured shortcuts can't fire N times (the
 * double-toggle that made 't' look dead). */
export function dedupeGlobalKeydown(e: KeyboardEvent): boolean {
  return claimRelayNonce('hotkey', `${e.type}|${e.key}|${e.timeStamp}`);
}

/** Cross-world message dedup: when several isolated worlds stack in one
 *  document, every world's message listener sees the same post — exactly one
 *  must act. The DOM attribute is shared across worlds and check+set is
 *  atomic within a JS turn, so the first reader wins. Returns false when the
 *  nonce was already claimed by another world. */
export function claimRelayNonce(key: string, rid: unknown): boolean {
  if (rid === undefined || rid === null) return true;
  const el = document.documentElement;
  if (!el) return true;
  const attr = `data-tihoka-relay-${key}`;
  const val = String(rid);
  if (el.getAttribute(attr) === val) return false;
  el.setAttribute(attr, val);
  return true;
}

// ─── Stale-world gate ───
// After an extension reload, Chrome re-injects the content script into pages
// that were already open — every injection is a new isolated world sharing
// the same document. The OLD worlds keep running their OLD bundles: their
// listeners can still consume postMessage actions (a claimed rid means the
// live world's handler never runs). The generation token makes only the
// LATEST injected world authoritative — older worlds' listeners drop messages.

/** Unique token for THIS isolated world (each injection gets a fresh one). */
const WORLD_GEN = crypto.randomUUID();
const WORLD_GEN_ATTR = 'data-tihoka-cs-gen';

/** Called once at content-script init — last injector wins. Defer until
 *  documentElement exists (document_start can run before <html>). */
export function stampWorldGeneration(): void {
  const stamp = (): void => {
    document.documentElement?.setAttribute(WORLD_GEN_ATTR, WORLD_GEN);
  };
  stamp();
  if (!document.documentElement) {
    document.addEventListener('readystatechange', stamp, { once: true });
  }
}

/** True only in the world that stamped the document most recently — i.e. the
 *  latest injection. Stale-world listeners must drop messages with this gate. */
export function isCurrentWorld(): boolean {
  return document.documentElement?.getAttribute(WORLD_GEN_ATTR) === WORLD_GEN;
}
