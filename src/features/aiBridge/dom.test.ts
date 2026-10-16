import {
  assistantTurnCount,
  findComposer,
  isStreaming,
  lastAssistantText,
  waitForAssistantReply,
} from './dom';
import { AI_PROVIDERS, type AiProviderAdapter } from './providers';

const chatgpt = AI_PROVIDERS.chatgpt;
const claude = AI_PROVIDERS.claude;
const fastStability: AiProviderAdapter = {
  ...AI_PROVIDERS.gemini,
  doneSignal: { kind: 'stability', silenceMs: 60 },
};

function mount(html: string): void {
  document.body.innerHTML = html;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const turn = (state: string, key: string, text = '') =>
  `<div data-talvt-turn-state="${state}"><div data-content-search-unit-key="${key}">` +
  `<div data-markdown-text-style="assistant-message"><p>${text}</p></div></div></div>`;

afterEach(() => {
  document.body.innerHTML = '';
});

test('findComposer prefers #prompt-textarea', () => {
  mount('<div id="prompt-textarea" contenteditable="true"></div><div contenteditable="true"></div>');
  expect(findComposer(chatgpt, document)?.id).toBe('prompt-textarea');
});

test('findComposer falls back to any contenteditable', () => {
  mount('<div contenteditable="true"></div>');
  expect(findComposer(chatgpt, document)).not.toBeNull();
});

test('findComposer returns null on login wall', () => {
  mount('<button>Log in</button>');
  expect(findComposer(chatgpt, document)).toBeNull();
});

test('findComposer picks the provider aria-labeled editor first', () => {
  mount(
    '<div class="tiptap ProseMirror" contenteditable="true" aria-label="Write your prompt to Claude"></div>' +
      '<div contenteditable="true"></div>',
  );
  expect(findComposer(claude, document)?.getAttribute('class')).toContain('tiptap');
});

test('assistantTurnCount counts :assistant units, not user units', () => {
  mount(
    '<div data-content-search-unit-key="fallback-turn-0:0:user"></div>' +
      turn('complete', 'fallback-turn-0:1:assistant') +
      turn('complete', 'fallback-turn-1:1:assistant'),
  );
  expect(assistantTurnCount(chatgpt, document)).toBe(2);
});

test('assistantTurnCount keeps legacy author-role fallback', () => {
  mount('<div data-message-author-role="assistant"></div>');
  expect(assistantTurnCount(chatgpt, document)).toBe(1);
});

test('gemini assistant units exclude user-query bubbles', () => {
  mount(
    '<user-query>hi</user-query>' +
      '<model-response><message-content>answer</message-content></model-response>',
  );
  expect(assistantTurnCount(AI_PROVIDERS.gemini, document)).toBe(1);
  expect(lastAssistantText(AI_PROVIDERS.gemini, document)).toContain('answer');
});

test('lastAssistantText reads the newest assistant-message body', () => {
  mount(turn('complete', 't:0:assistant', 'old') + turn('complete', 't:1:assistant', 'new answer'));
  expect(lastAssistantText(chatgpt, document)).toContain('new answer');
  expect(lastAssistantText(chatgpt, document)).not.toContain('old');
});

test('lastAssistantText keeps legacy .markdown fallback', () => {
  mount(
    '<div data-message-author-role="assistant"><div class="markdown"><p>legacy</p></div></div>',
  );
  expect(lastAssistantText(chatgpt, document)).toContain('legacy');
});

test('isStreaming is true while a turn is in_progress', () => {
  mount(turn('in_progress', 't:0:assistant', 'partial'));
  expect(isStreaming(chatgpt, document)).toBe(true);
});

test('isStreaming is true while stop button is present', () => {
  mount('<button aria-label="Stop"></button>');
  expect(isStreaming(chatgpt, document)).toBe(true);
});

test('isStreaming is false once the turn is complete', () => {
  mount(turn('complete', 't:0:assistant', 'done'));
  expect(isStreaming(chatgpt, document)).toBe(false);
});

test('isStreaming sees claude perf-row streaming flag', () => {
  mount('<div data-testid="transcript-row" data-perf-row="assistant" data-perf-row-streaming="true"></div>');
  expect(isStreaming(claude, document)).toBe(true);
});

test('waitForAssistantReply resolves the tick the turn flips to complete', async () => {
  mount(turn('complete', 't:0:assistant', 'earlier answer'));
  const reply = waitForAssistantReply(chatgpt, document, 1, 5_000);
  document.body.insertAdjacentHTML(
    'beforeend',
    turn('in_progress', 't:1:assistant', 'streaming answer'),
  );
  const holder = document.querySelectorAll('[data-talvt-turn-state]')[1];
  holder.setAttribute('data-talvt-turn-state', 'complete');
  await expect(reply).resolves.toContain('streaming answer');
});

test('waitForAssistantReply resolves when the new unit arrives already complete', async () => {
  const reply = waitForAssistantReply(chatgpt, document, 0, 5_000);
  document.body.insertAdjacentHTML('beforeend', turn('complete', 't:0:assistant', 'instant'));
  await expect(reply).resolves.toContain('instant');
});

test('waitForAssistantReply ignores pre-existing units via baseline', async () => {
  mount(turn('complete', 't:0:assistant', 'stale'));
  const reply = waitForAssistantReply(chatgpt, document, 1, 40);
  await expect(reply).resolves.toBeNull();
});

test('waitForAssistantReply resolves via stop-button fallback on legacy DOM', async () => {
  const reply = waitForAssistantReply(chatgpt, document, 0, 5_000);
  mount(
    '<button aria-label="Stop"></button>' +
      '<div data-message-author-role="assistant"><div class="markdown">partial</div></div>',
  );
  await sleep(0);
  document.querySelector('button')?.remove();
  document.querySelector('.markdown')!.insertAdjacentHTML('beforeend', '<p>final answer</p>');
  await expect(reply).resolves.toContain('final answer');
});

test('waitForAssistantReply resolves on claude perf-row-streaming flip', async () => {
  const reply = waitForAssistantReply(claude, document, 0, 5_000);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div data-testid="transcript-row" data-perf-row="assistant" data-perf-row-streaming="true">' +
      '<div class="standard-markdown">claude answer</div></div>',
  );
  await sleep(0);
  document
    .querySelector('[data-perf-row-streaming]')!
    .setAttribute('data-perf-row-streaming', 'false');
  await expect(reply).resolves.toContain('claude answer');
});

test('waitForAssistantReply (stability) resolves after text stops changing', async () => {
  const reply = waitForAssistantReply(fastStability, document, 0, 5_000);
  mount('<model-response><message-content>part</message-content></model-response>');
  await sleep(20);
  document.querySelector('message-content')!.textContent = 'part two final';
  await expect(reply).resolves.toContain('final');
});

test('waitForAssistantReply (stability) waits out a mid-stream pause', async () => {
  const reply = waitForAssistantReply(fastStability, document, 0, 5_000);
  mount('<model-response><message-content>chunk</message-content></model-response>');
  await sleep(30);
  document.querySelector('message-content')!.textContent = 'chunk plus more';
  await expect(reply).resolves.toContain('plus more');
});

test('waitForAssistantReply (stability) times out with no unit', async () => {
  const reply = waitForAssistantReply(fastStability, document, 0, 40);
  await expect(reply).resolves.toBeNull();
});
