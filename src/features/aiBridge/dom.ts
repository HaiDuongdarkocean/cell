/**
 * Provider DOM probes — pure functions over a Document, driven by an
 * AiProviderAdapter so the same bridge script serves every provider.
 * Testable in jsdom.
 *
 * Done detection comes in two flavors (adapter.doneSignal):
 *   attribute — a turn attr flips streamingValue -> completeValue
 *               (chatgpt data-talvt-turn-state, claude data-perf-row-streaming)
 *   stability — no verified done attr (gemini, deepseek); the answer
 *               resolves once its text sits unchanged for silenceMs.
 */
import type { AiProviderAdapter } from './providers';

export function findComposer(adapter: AiProviderAdapter, doc: Document): HTMLElement | null {
  for (const selector of adapter.composer.selectors) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

export function assistantUnits(adapter: AiProviderAdapter, doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(adapter.assistantUnit)];
}

export function assistantTurnCount(adapter: AiProviderAdapter, doc: Document): number {
  return assistantUnits(adapter, doc).length;
}

function unitText(adapter: AiProviderAdapter, unit: Element): string {
  const body = unit.querySelector<HTMLElement>(adapter.answerBody) ?? unit;
  const el = body as HTMLElement;
  return (el.innerText || el.textContent || '').trim();
}

export function lastAssistantText(adapter: AiProviderAdapter, doc: Document): string {
  const unit = assistantUnits(adapter, doc).at(-1);
  return unit ? unitText(adapter, unit) : '';
}

export function isStreaming(adapter: AiProviderAdapter, doc: Document): boolean {
  const done = adapter.doneSignal;
  if (done.kind === 'attribute') {
    if (doc.querySelector(`[${done.attr}="${done.streamingValue}"]`) !== null) return true;
  }
  return adapter.streamingIndicators.some((sel) => doc.querySelector(sel) !== null);
}

/**
 * Resolve with the text of assistant unit #baseline+1 the moment the
 * provider's done signal fires — event-driven via MutationObserver, so the
 * reply arrives on the same tick the DOM settles, not on a poll interval.
 *
 * attribute mode: waits for unit's signal host (itself or closest
 * scopeSelector) to flip to completeValue. When the attr contract is absent
 * from the document entirely (legacy DOM), falls back to the first
 * non-empty idle text — a very fast partial stream could clip early.
 * stability mode: resolves once the unit's text is unchanged for
 * silenceMs; a mid-generation pause can clip the tail.
 */
export function waitForAssistantReply(
  adapter: AiProviderAdapter,
  doc: Document,
  baseline: number,
  timeoutMs: number,
): Promise<string | null> {
  const done = adapter.doneSignal;
  return new Promise((resolve) => {
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    let lastText = '';
    const settle = (text: string | null) => {
      observer.disconnect();
      clearTimeout(timer);
      if (silenceTimer) clearTimeout(silenceTimer);
      resolve(text);
    };
    const armStability = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(
        () => settle(lastText),
        done.kind === 'stability' ? done.silenceMs : 0,
      );
    };
    const check = () => {
      const unit = assistantUnits(adapter, doc)[baseline];
      if (!unit) return;
      if (adapter.scrollIntoViewWhileObserving) unit.scrollIntoView?.({ block: 'nearest' });
      if (done.kind === 'stability') {
        const text = unitText(adapter, unit);
        if (!text) return;
        if (text !== lastText) {
          lastText = text;
          armStability();
        }
        return;
      }
      const host = done.scopeSelector ? unit.closest(done.scopeSelector) : unit;
      const state = host?.getAttribute(done.attr);
      if (state === done.completeValue) return settle(unitText(adapter, unit));
      if (state != null) return;
      if (doc.querySelector(done.scopeSelector ?? `[${done.attr}]`)) return;
      if (isStreaming(adapter, doc)) return;
      const text = unitText(adapter, unit);
      if (text) settle(text);
    };
    const observer = new MutationObserver(check);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: done.kind === 'attribute' ? [done.attr] : undefined,
    });
    const timer = setTimeout(() => settle(null), timeoutMs);
    check();
  });
}
