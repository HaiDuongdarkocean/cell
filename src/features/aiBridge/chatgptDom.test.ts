import {
  assistantTurnCount,
  findComposer,
  isStreaming,
  lastAssistantText,
  waitForAssistantReply,
} from './chatgptDom';

function mount(html: string): void {
  document.body.innerHTML = html;
}

const turn = (state: string, key: string, text = '') =>
  `<div data-talvt-turn-state="${state}"><div data-content-search-unit-key="${key}">` +
  `<div data-markdown-text-style="assistant-message"><p>${text}</p></div></div></div>`;

afterEach(() => {
  document.body.innerHTML = '';
});

test('findComposer prefers #prompt-textarea', () => {
  mount('<div id="prompt-textarea" contenteditable="true"></div><div contenteditable="true"></div>');
  expect(findComposer(document)?.id).toBe('prompt-textarea');
});

test('findComposer falls back to any contenteditable', () => {
  mount('<div contenteditable="true"></div>');
  expect(findComposer(document)).not.toBeNull();
});

test('findComposer returns null on login wall', () => {
  mount('<button>Log in</button>');
  expect(findComposer(document)).toBeNull();
});

test('assistantTurnCount counts :assistant units, not user units', () => {
  mount(
    '<div data-content-search-unit-key="fallback-turn-0:0:user"></div>' +
      turn('complete', 'fallback-turn-0:1:assistant') +
      turn('complete', 'fallback-turn-1:1:assistant'),
  );
  expect(assistantTurnCount(document)).toBe(2);
});

test('assistantTurnCount keeps legacy author-role fallback', () => {
  mount('<div data-message-author-role="assistant"></div>');
  expect(assistantTurnCount(document)).toBe(1);
});

test('lastAssistantText reads the newest assistant-message body', () => {
  mount(
    turn('complete', 't:0:assistant', 'old') + turn('complete', 't:1:assistant', 'new answer'),
  );
  expect(lastAssistantText(document)).toContain('new answer');
  expect(lastAssistantText(document)).not.toContain('old');
});

test('lastAssistantText keeps legacy .markdown fallback', () => {
  mount(
    '<div data-message-author-role="assistant"><div class="markdown"><p>legacy</p></div></div>',
  );
  expect(lastAssistantText(document)).toContain('legacy');
});

test('isStreaming is true while a turn is in_progress', () => {
  mount(turn('in_progress', 't:0:assistant', 'partial'));
  expect(isStreaming(document)).toBe(true);
});

test('isStreaming is true while stop button is present', () => {
  mount('<button aria-label="Stop"></button>');
  expect(isStreaming(document)).toBe(true);
});

test('isStreaming is false once the turn is complete', () => {
  mount(turn('complete', 't:0:assistant', 'done'));
  expect(isStreaming(document)).toBe(false);
});

test('waitForAssistantReply resolves the tick the turn flips to complete', async () => {
  mount(turn('complete', 't:0:assistant', 'earlier answer'));
  const reply = waitForAssistantReply(document, 1, 5_000);
  document.body.insertAdjacentHTML(
    'beforeend',
    turn('in_progress', 't:1:assistant', 'streaming answer'),
  );
  const holder = document.querySelectorAll('[data-talvt-turn-state]')[1];
  holder.setAttribute('data-talvt-turn-state', 'complete');
  await expect(reply).resolves.toContain('streaming answer');
});

test('waitForAssistantReply resolves when the new unit arrives already complete', async () => {
  const reply = waitForAssistantReply(document, 0, 5_000);
  document.body.insertAdjacentHTML(
    'beforeend',
    turn('complete', 't:0:assistant', 'instant'),
  );
  await expect(reply).resolves.toContain('instant');
});

test('waitForAssistantReply ignores pre-existing units via baseline', async () => {
  mount(turn('complete', 't:0:assistant', 'stale'));
  const reply = waitForAssistantReply(document, 1, 40);
  await expect(reply).resolves.toBeNull();
});

test('waitForAssistantReply resolves via stop-button fallback on legacy DOM', async () => {
  const reply = waitForAssistantReply(document, 0, 5_000);
  mount(
    '<button aria-label="Stop"></button>' +
      '<div data-message-author-role="assistant"><div class="markdown">partial</div></div>',
  );
  await new Promise((r) => setTimeout(r, 0));
  document.querySelector('button')?.remove();
  document
    .querySelector('.markdown')!
    .insertAdjacentHTML('beforeend', '<p>final answer</p>');
  await expect(reply).resolves.toContain('final answer');
});
