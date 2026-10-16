/**
 * chatgpt.com DOM probes — pure functions over a Document so they are
 * testable in jsdom. OpenAI rotates these contracts per deploy; every
 * probe keeps a fallback chain here so callers stay dumb.
 *
 * Current contract (verified 2026-10 against the talvt frontend):
 *   turn root      [data-talvt-turn-state]      "in_progress" -> "complete"
 *   assistant unit [data-content-search-unit-key$=":assistant"]
 *   answer body    [data-markdown-text-style="assistant-message"]
 * Legacy contract:  [data-message-author-role="assistant"] + .markdown +
 *                   stop-button presence while streaming.
 */

const TURN_ROOT = '[data-talvt-turn-state]';
const ASSISTANT_UNIT =
  '[data-content-search-unit-key$=":assistant"], [data-message-author-role="assistant"]';
const ANSWER_BODY = '[data-markdown-text-style="assistant-message"], .markdown';

export function findComposer(doc: Document): HTMLElement | null {
  return (
    doc.querySelector<HTMLElement>('#prompt-textarea') ??
    doc.querySelector<HTMLElement>('form div[contenteditable="true"]') ??
    doc.querySelector<HTMLElement>('div[contenteditable="true"]') ??
    doc.querySelector<HTMLElement>('form textarea')
  );
}

export function assistantUnits(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(ASSISTANT_UNIT)];
}

export function assistantTurnCount(doc: Document): number {
  return assistantUnits(doc).length;
}

function unitText(unit: Element): string {
  const body = unit.querySelector<HTMLElement>(ANSWER_BODY) ?? unit;
  const el = body as HTMLElement;
  return (el.innerText || el.textContent || '').trim();
}

export function lastAssistantText(doc: Document): string {
  const unit = assistantUnits(doc).at(-1);
  return unit ? unitText(unit) : '';
}

export function isStreaming(doc: Document): boolean {
  return (
    doc.querySelector(`${TURN_ROOT.slice(0, -1)}="in_progress"]`) !== null ||
    doc.querySelector('button[aria-label*="Stop" i]') !== null ||
    doc.querySelector('.result-streaming') !== null
  );
}

/**
 * Resolve with the text of assistant unit #baseline+1 the moment its turn
 * flips to complete — event-driven via MutationObserver, so the reply
 * arrives on the same tick the DOM settles, not on a poll interval.
 *
 * shortcut: on a legacy DOM without turn-state attrs this resolves on the
 * first non-empty idle text — a very fast partial stream could clip early;
 * upgrade to a stability window if the bridge ships past PoC.
 */
export function waitForAssistantReply(
  doc: Document,
  baseline: number,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const settle = (text: string | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(text);
    };
    const check = () => {
      const unit = assistantUnits(doc)[baseline];
      if (!unit) return;
      const state = unit.closest(TURN_ROOT)?.getAttribute('data-talvt-turn-state');
      if (state === 'complete') return settle(unitText(unit));
      if (state != null || doc.querySelector(TURN_ROOT)) return;
      if (isStreaming(doc)) return;
      const text = unitText(unit);
      if (text) settle(text);
    };
    const observer = new MutationObserver(check);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-talvt-turn-state'],
    });
    const timer = setTimeout(() => settle(null), timeoutMs);
    check();
  });
}
