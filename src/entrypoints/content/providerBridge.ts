/**
 * AI provider bridge content script — drives the user's logged-in session
 * on any supported provider origin. Injected on chatgpt.com,
 * gemini.google.com, chat.deepseek.com, claude.ai; the adapter is picked by
 * location.host, other hosts no-op.
 *
 * Contract (bg -> cs):
 *   {type:'AI_PING'}                        -> {ok, composer, streaming, url, provider}
 *   {type:'AI_ASK', payload:{prompt,askId?}} -> {success, text | error, provider}
 *   error is an AiAskFailureKind string: busy | loginRequired | noAnswer | domError
 *
 * While the provider streams, the ask emits
 *   {type:'AI_STREAM', payload:{askId,provider,text}}
 * partials — the SW relays them to the asking tab so the popup renders the
 * answer as it grows.
 *
 * Sends via Enter dispatch; if the composer still holds text after 3s the
 * page ignored it, so a configured send button is clicked once as a
 * mutually exclusive fallback (a cleared composer means the send landed).
 * Reply detection is event-driven: waitForAssistantReply observes the DOM
 * and resolves on the provider's done signal (attribute flip or stability).
 *
 * shortcut: asks append into whichever conversation the tab has open —
 * our dedicated tab starts on the new-chat URL, so they share one thread.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { AiProviderId } from '@/entities/message/dictionarySchemas';
import { adapterForHost, type AiProviderAdapter } from '@/features/aiBridge/providers';
import {
  findComposer,
  isStreaming,
  waitForAssistantReply,
  captureAssistantBaseline,
  newAssistantUnit,
} from '@/features/aiBridge/dom';

const COMPOSER_TIMEOUT_MS = 15_000;
const ASK_TIMEOUT_MS = 90_000;
const STREAM_FLUSH_MS = 200;

/** Throttled trailing sender — caps fast token mutations at ~5 msg/s. */
function streamPartials(
  askId: string | undefined,
  provider: AiProviderId,
): ((text: string) => void) | undefined {
  if (!askId) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = '';
  return (text: string): void => {
    latest = text;
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      void chrome.runtime
        .sendMessage({ type: MESSAGE_TYPES.AI_STREAM, payload: { askId, provider, text: latest } })
        .catch(() => {});
    }, STREAM_FLUSH_MS);
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SUBMIT_CONFIRM_MS = 15_000;

interface AskReply {
  success: boolean;
  text?: string;
  error?: string;
  provider?: AiProviderId;
}

async function waitFor<T>(probe: () => T | null, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const hit = probe();
    if (hit) return hit;
    if (Date.now() >= deadline) return null;
    await sleep(250);
  }
}

function fillComposer(composer: HTMLElement, prompt: string): void {
  composer.focus();
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    const el = composer;
    // Native setter so a controlled (React) input registers the change.
    const proto = composer instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, prompt);
    else el.value = prompt;
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
    );
    return;
  }
  // Select INSIDE the composer — a bare selectAll can grab the page when the
  // focus call did not take, and insertText then lands nowhere (the old
  // textContent fallback filled the box visually while the editor model
  // stayed empty, so Send stayed disabled and Enter did nothing).
  const range = document.createRange();
  range.selectNodeContents(composer);
  const sel = document.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  const inserted = document.execCommand('insertText', false, prompt);
  if (!inserted) {
    composer.textContent = prompt;
    composer.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
    );
  }
}

function composerStillFilled(composer: HTMLElement): boolean {
  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    return Boolean(composer.value?.trim());
  }
  return Boolean(composer.textContent?.trim());
}

function sendPrompt(composer: HTMLElement): void {
  for (const type of ['keydown', 'keyup'] as const) {
    composer.dispatchEvent(
      new KeyboardEvent(type, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}

/** Submit = click the send button when the provider exposes one — synthetic
 *  Enter is ignored by React-controlled composers that gate on trusted
 *  events (chatgpt), so Enter is only the fallback for providers without a
 *  button. A detached/emptied composer means the send landed. */
async function submitPrompt(adapter: AiProviderAdapter, composer: HTMLElement): Promise<boolean> {
  const findSendButton = (): HTMLButtonElement | null => {
    for (const selector of adapter.sendButtonSelectors) {
      for (const b of document.querySelectorAll<HTMLButtonElement>(selector)) {
        if (!b.disabled && b.getClientRects().length > 0) return b;
      }
    }
    return null;
  };
  const submitted = (): boolean => !composer.isConnected || !composerStillFilled(composer);
  sendPrompt(composer);
  const deadline = Date.now() + 10_000;
  for (;;) {
    await sleep(800);
    if (submitted()) return true;
    const button = findSendButton();
    if (button) button.click();
    else sendPrompt(composer);
    if (Date.now() >= deadline) return submitted();
  }
}

/** Cancels the running ask: clicks the provider's stop button and resolves
 *  the wait early so the tab frees immediately for the next ask. Scoped by
 *  inFlightAskId — a stale AI_CANCEL must not kill a newer ask. */
let cancelInFlight: (() => void) | null = null;
let inFlightAskId: string | null = null;

function clickStop(adapter: AiProviderAdapter): void {
  for (const selector of adapter.stopButtonSelectors) {
    for (const b of document.querySelectorAll<HTMLButtonElement>(selector)) {
      if (!b.disabled && b.getClientRects().length > 0) {
        b.click();
        return;
      }
    }
  }
}

async function ask(
  adapter: AiProviderAdapter,
  prompt: string,
  askId?: string,
): Promise<AskReply> {
  const composer = await waitFor(() => findComposer(adapter, document), COMPOSER_TIMEOUT_MS);
  if (!composer) {
    return { success: false, error: 'loginRequired', provider: adapter.id };
  }
  if (isStreaming(adapter, document)) {
    return { success: false, error: 'busy', provider: adapter.id };
  }

  /** Provider-side error notices (rate-limit toast, capacity banner) — a
   *  prompt that can't be accepted is 'rateLimit', not a dom failure. */
  const providerErrorKind = (): string | null => {
    const bodyText = document.body?.innerText ?? '';
    if (/(too many|rate.?limit|try again later|capacity|whoa, slow down)/i.test(bodyText)) {
      return 'rateLimit';
    }
    return null;
  };

  const baseline = captureAssistantBaseline(adapter, document);
  inFlightAskId = askId ?? null;
  const reply = waitForAssistantReply(
    adapter,
    document,
    baseline,
    ASK_TIMEOUT_MS,
    streamPartials(askId, adapter.id),
    prompt,
  );
  const cancelled = new Promise<string>((res) => {
    cancelInFlight = () => {
      clickStop(adapter);
      res('__cancelled__');
    };
  });
  fillComposer(composer, prompt);
  await sleep(600);
  if (!(await submitPrompt(adapter, composer))) {
    cancelInFlight = null;
    inFlightAskId = null;
    return { success: false, error: 'domError', provider: adapter.id };
  }

  // Submission-confirmation window: if no new assistant turn mounts within
  // 15s, the provider silently dropped the prompt (rate limit, unsent
  // composer) — fail fast instead of waiting the full 90s.
  const dropped = waitFor(
    () => newAssistantUnit(adapter, document, baseline),
    SUBMIT_CONFIRM_MS,
  ).then((ok) => (ok ? new Promise<string>(() => {}) : '__noturn__'));
  const text = await Promise.race([reply, cancelled, dropped]);
  cancelInFlight = null;
  inFlightAskId = null;
  if (text === '__noturn__') {
    return { success: false, error: providerErrorKind() ?? 'domError', provider: adapter.id };
  }
  if (text === '__cancelled__') {
    return { success: false, error: 'cancelled', provider: adapter.id };
  }
  return text
    ? { success: true, text, provider: adapter.id }
    : { success: false, error: 'noAnswer', provider: adapter.id };
}

const adapter = adapterForHost(location.host);

if (adapter) {
  let inFlight: Promise<AskReply> | null = null;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === MESSAGE_TYPES.AI_PING) {
      sendResponse({
        ok: true,
        composer: findComposer(adapter, document) !== null,
        streaming: isStreaming(adapter, document),
        url: location.href,
        provider: adapter.id,
      });
      return false;
    }
    if (msg?.type === MESSAGE_TYPES.AI_CANCEL) {
      const cancelAskId = (msg?.payload as { askId?: unknown } | undefined)?.askId;
      if (typeof cancelAskId === 'string' && inFlightAskId !== null && cancelAskId !== inFlightAskId) {
        sendResponse({ ok: true, provider: adapter.id, ignored: true });
        return false;
      }
      cancelInFlight?.();
      sendResponse({ ok: true, provider: adapter.id });
      return false;
    }
    if (msg?.type !== MESSAGE_TYPES.AI_ASK) return false;

    const payload = msg?.payload as { prompt?: unknown; askId?: unknown } | undefined;
    const prompt = payload?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) {
      sendResponse({ success: false, error: 'missing prompt', provider: adapter.id });
      return false;
    }
    if (inFlight) {
      sendResponse({ success: false, error: 'busy', provider: adapter.id });
      return false;
    }
    const askId = typeof payload?.askId === 'string' ? payload.askId : undefined;
    inFlight = ask(adapter, prompt, askId);
    void inFlight
      .then(sendResponse)
      .catch((err: unknown) =>
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
          provider: adapter.id,
        }),
      )
      .finally(() => {
        inFlight = null;
      });
    return true;
  });
}
