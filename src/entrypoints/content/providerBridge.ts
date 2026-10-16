/**
 * AI provider bridge content script — drives the user's logged-in session
 * on any supported provider origin. Injected on chatgpt.com,
 * gemini.google.com, chat.deepseek.com, claude.ai; the adapter is picked by
 * location.host, other hosts no-op.
 *
 * Contract (bg -> cs):
 *   {type:'AI_PING'}                 -> {ok, composer, streaming, url, provider}
 *   {type:'AI_ASK', payload:{prompt}} -> {success, text | error, provider}
 *   error is an AiAskFailureKind string: busy | loginRequired | noAnswer | domError
 *
 * Sends via Enter dispatch; if the composer still holds text after 3s the
 * page ignored it, so a configured send button is clicked once as a
 * mutually exclusive fallback (a cleared composer means the send landed).
 * Reply detection is event-driven: waitForAssistantReply observes the DOM
 * and resolves on the provider's done signal (attribute flip or stability).
 *
 * shortcut: batch reply only — no token streaming back to the extension;
 * upgrade via a long-lived Port if latency UX becomes the bottleneck.
 * shortcut: asks append into whichever conversation the tab has open —
 * our dedicated tab starts on the new-chat URL, so they share one thread.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { AiProviderId } from '@/entities/message/dictionarySchemas';
import { adapterForHost, type AiProviderAdapter } from '@/features/aiBridge/providers';
import {
  assistantTurnCount,
  findComposer,
  isStreaming,
  waitForAssistantReply,
} from '@/features/aiBridge/dom';

const COMPOSER_TIMEOUT_MS = 15_000;
const ASK_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function fillComposer(adapter: AiProviderAdapter, composer: HTMLElement, prompt: string): void {
  composer.focus();
  if (adapter.composer.isTextarea) {
    const el = composer as HTMLTextAreaElement;
    // Native setter so a controlled (React) textarea registers the change.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (setter) setter.call(el, prompt);
    else el.value = prompt;
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
    );
    return;
  }
  document.execCommand('selectAll');
  const inserted = document.execCommand('insertText', false, prompt);
  if (!inserted) {
    composer.textContent = prompt;
    composer.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
    );
  }
}

function composerStillFilled(adapter: AiProviderAdapter, composer: HTMLElement): boolean {
  if (adapter.composer.isTextarea) {
    return Boolean((composer as HTMLTextAreaElement).value?.trim());
  }
  return Boolean(composer.textContent?.trim());
}

function sendPrompt(composer: HTMLElement): void {
  composer.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    }),
  );
}

async function ask(adapter: AiProviderAdapter, prompt: string): Promise<AskReply> {
  const composer = await waitFor(() => findComposer(adapter, document), COMPOSER_TIMEOUT_MS);
  if (!composer) {
    return { success: false, error: 'loginRequired', provider: adapter.id };
  }
  if (isStreaming(adapter, document)) {
    return { success: false, error: 'busy', provider: adapter.id };
  }

  const baseline = assistantTurnCount(adapter, document);
  const reply = waitForAssistantReply(adapter, document, baseline, ASK_TIMEOUT_MS);
  fillComposer(adapter, composer, prompt);
  await sleep(600);
  sendPrompt(composer);
  await sleep(3_000);
  if (composerStillFilled(adapter, composer)) {
    for (const selector of adapter.sendButtonSelectors) {
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (button) {
        button.click();
        break;
      }
    }
  }

  const text = await reply;
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
    if (msg?.type !== MESSAGE_TYPES.AI_ASK) return false;

    const prompt = (msg?.payload as { prompt?: unknown } | undefined)?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) {
      sendResponse({ success: false, error: 'missing prompt', provider: adapter.id });
      return false;
    }
    if (inFlight) {
      sendResponse({ success: false, error: 'busy', provider: adapter.id });
      return false;
    }
    inFlight = ask(adapter, prompt);
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
