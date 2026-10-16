/**
 * ChatGPT bridge content script — PoC for driving the user's logged-in
 * chatgpt.com session from the extension. Injected on chatgpt.com only.
 *
 * Contract (bg -> cs):
 *   {type:'AI_PING'}            -> {ok, composer, streaming, url}
 *   {type:'AI_ASK', payload:{prompt}} -> {success, text | error}
 *
 * Sends via Enter dispatch; if the composer still holds text after 3s
 * the new-chat page ignored it, so the send button is clicked once as a
 * mutually exclusive fallback (a cleared composer means the send landed).
 * Reply detection is event-driven: waitForAssistantReply observes the DOM
 * and resolves on the turn-complete attribute flip.
 *
 * shortcut: batch reply only — no token streaming back to the extension;
 * upgrade via a long-lived Port if latency UX becomes the bottleneck.
 * shortcut: asks append into whichever conversation the tab has open —
 * our dedicated tab starts on the new-chat URL, so they share one thread.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  assistantTurnCount,
  findComposer,
  isStreaming,
  waitForAssistantReply,
} from '@/features/aiBridge/chatgptDom';

const COMPOSER_TIMEOUT_MS = 15_000;
const ASK_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AskReply {
  success: boolean;
  text?: string;
  error?: string;
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
  document.execCommand('selectAll');
  const inserted = document.execCommand('insertText', false, prompt);
  if (!inserted) {
    composer.textContent = prompt;
    composer.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }),
    );
  }
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

async function ask(prompt: string): Promise<AskReply> {
  const composer = await waitFor(() => findComposer(document), COMPOSER_TIMEOUT_MS);
  if (!composer) {
    return { success: false, error: 'composer not found — log into chatgpt.com in the bridge tab' };
  }
  if (isStreaming(document)) {
    return { success: false, error: 'chatgpt is already generating' };
  }

  const baseline = assistantTurnCount(document);
  const reply = waitForAssistantReply(document, baseline, ASK_TIMEOUT_MS);
  fillComposer(composer, prompt);
  await sleep(600);
  sendPrompt(composer);
  await sleep(3_000);
  if (composer.textContent?.trim()) {
    document.querySelector<HTMLButtonElement>('button[aria-label*="Send" i]')?.click();
  }

  const text = await reply;
  return text ? { success: true, text } : { success: false, error: 'response timeout' };
}

let inFlight: Promise<AskReply> | null = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'AI_PING') {
    sendResponse({
      ok: true,
      composer: findComposer(document) !== null,
      streaming: isStreaming(document),
      url: location.href,
    });
    return false;
  }
  if (msg?.type !== MESSAGE_TYPES.AI_ASK) return false;

  const prompt = (msg?.payload as { prompt?: unknown } | undefined)?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    sendResponse({ success: false, error: 'missing prompt' });
    return false;
  }
  if (inFlight) {
    sendResponse({ success: false, error: 'busy' });
    return false;
  }
  inFlight = ask(prompt);
  void inFlight
    .then(sendResponse)
    .catch((err: unknown) =>
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }),
    )
    .finally(() => {
      inFlight = null;
    });
  return true;
});
