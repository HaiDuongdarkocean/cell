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

/** Idle-text grace before an attribute-mode reply settles without the
 *  completeValue flip — covers enum drift ('finished') or a lagging attr
 *  write after the text is done. */
const ATTR_IDLE_DONE_MS = 3_000;
/** Longer quiet tolerated while the DOM still claims streaming — a stuck
 *  in_progress/stop indicator settles instead of hanging to the timeout.
 *  Must exceed typical mid-answer model pauses (~thinking gaps). */
const ATTR_IDLE_STUCK_MS = 12_000;

/**
 * Resolve with the text of assistant unit #baseline+1 the moment the
 * provider's done signal fires — event-driven via MutationObserver, so the
 * reply arrives on the same tick the DOM settles, not on a poll interval.
 *
 * attribute mode: settles instantly on completeValue; otherwise watches
 * the unit text — ATTR_IDLE_DONE_MS of quiet once nothing reports
 * streaming, or ATTR_IDLE_STUCK_MS when the attr says streaming but the
 * text has stopped growing (stuck signal). A genuine mid-generation
 * pause longer than the stuck window can still clip the tail.
 * stability mode: resolves once the unit's text is unchanged for
 * silenceMs; a mid-generation pause can clip the tail.
 */
export function waitForAssistantReply(
  adapter: AiProviderAdapter,
  doc: Document,
  baseline: number,
  timeoutMs: number,
  onPartial?: (text: string) => void,
): Promise<string | null> {
  const done = adapter.doneSignal;
  const idleDoneMs = done.kind === 'stability' ? done.silenceMs : ATTR_IDLE_DONE_MS;
  return new Promise((resolve) => {
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    let lastText = '';
    let wasStreaming = false;
    const settle = (text: string | null) => {
      observer.disconnect();
      clearTimeout(timer);
      if (silenceTimer) clearTimeout(silenceTimer);
      resolve(text);
    };
    const armStability = (ms: number) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => settle(lastText), ms);
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
          onPartial?.(text);
          armStability(idleDoneMs);
        }
        return;
      }
      const host = done.scopeSelector ? unit.closest(done.scopeSelector) : unit;
      const state = host?.getAttribute(done.attr);
      if (state === done.completeValue) return settle(unitText(adapter, unit));
      const streaming = state === done.streamingValue || isStreaming(adapter, doc);
      const text = unitText(adapter, unit);
      if (!text) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = undefined;
        lastText = '';
        wasStreaming = streaming;
        return;
      }
      // Text still growing → re-arm; quiet → the current streaming flag picks
      // the grace window. A flag flip to idle re-arms the short window.
      if (text !== lastText || streaming !== wasStreaming) {
        const grew = text !== lastText;
        lastText = text;
        wasStreaming = streaming;
        if (grew) onPartial?.(text);
        armStability(
          streaming ? (done.stuckIdleMs ?? ATTR_IDLE_STUCK_MS) : (done.idleDoneMs ?? idleDoneMs),
        );
      }
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
