import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry } from '@/entities/dictionary';

const getWordStatuses = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, string>>>;
const getFrequencyEntries = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, FrequencyEntry[]>>>;
const setWordStatus = jest.fn() as jest.MockedFunction<(langCode: string, term: string, status: string) => Promise<void>>;
const getSrsCardTerms = jest.fn() as jest.MockedFunction<(langCode: string) => Promise<Set<string>>>;

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({
  getWordStatuses,
  setWordStatus,
}));

jest.mock('@/features/srs/services/addToOceanSrs', () => ({
  getSrsCardTerms,
}));

jest.mock('@/features/dictionary/services/frequencyClient', () => ({
  getFrequencyEntries,
}));

import { createSubtitleTokenizeController } from './subtitleTokenizeController';
import { emitWordStatusChanged, emitWordStatusesReload } from '@/features/dictionary';
import { emitSrsCardsChanged, resetSrsCardTermSetForTest } from '@/features/srs';
import type { SrtCue } from '@/entities/media';

beforeEach(() => {
  getWordStatuses.mockResolvedValue(new Map<string, string>());
  getFrequencyEntries.mockResolvedValue(new Map<string, FrequencyEntry[]>());
  setWordStatus.mockResolvedValue(undefined);
  resetSrsCardTermSetForTest();
  getSrsCardTerms.mockReset();
  getSrsCardTerms.mockResolvedValue(new Set());
  document.body.innerHTML = '';
});

describe('createSubtitleTokenizeController', () => {
  function setup() {
    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);

    const cues: SrtCue[] = [
      { index: 1, start: 0, end: 1000, text: 'Hello world.' },
      { index: 2, start: 1000, end: 2000, text: 'Second cue.' },
      { index: 3, start: 2000, end: 3000, text: 'Third cue.' },
    ];

    const onOpenDictionary = jest.fn();
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      onOpenDictionary,
      windowSize: 1,
    });

    return { target, native, cues, controller, onOpenDictionary };
  }

  it('tokenizes the active target cue and leaves the native line plain', async () => {
    const { target, native, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    native.textContent = cues[0]!.text;
    controller.setCues(cues, cues);
    controller.enable();
    controller.render(0, 0);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(target.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);
    expect(native.querySelectorAll('.js-cell-token').length).toBe(0);
    expect(target.textContent).toBe('Hello world.');
    expect(native.textContent).toBe('Hello world.');

    controller.destroy();
  });

  it('calls onOpenDictionary when a token is clicked', async () => {
    const { target, cues, controller, onOpenDictionary } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]');
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onOpenDictionary).toHaveBeenCalled();

    controller.destroy();
  });

  it('updates status of hovered token with 1-4 keys', async () => {
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));

    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'known');

    controller.destroy();
  });

  it('does not update status when focus is in an input (shadow retargeting)', async () => {
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));

    const { target, cues, controller } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const event = new KeyboardEvent('keydown', { key: '2', bubbles: true });
    Object.defineProperty(event, 'composedPath', {
      value: () => [input, document.body, document.documentElement, document, window],
      configurable: true,
    });

    setWordStatus.mockClear();
    document.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('applies status to every token inside a native selection even while the pointer hovers the last token', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    const world = target.querySelector('[data-cell-term="world"]') as HTMLElement | null;
    expect(hello).not.toBeNull();
    expect(world).not.toBeNull();

    world!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const range = document.createRange();
    range.setStartBefore(hello!);
    range.setEndAfter(world!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('2')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'known');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'world', 'known');

    window.getSelection()?.removeAllRanges();
    controller.destroy();
  });

  it('applies status to tokens selected inside an extra shadow root (split-view panel)', async () => {
    const panelHost = document.createElement('div');
    panelHost.setAttribute('data-cell-split-view', 'panel');
    const shadow = panelHost.attachShadow({ mode: 'open' });
    const cueText = document.createElement('span');
    const alpha = document.createElement('span');
    alpha.className = 'js-cell-token';
    alpha.setAttribute('data-cell-term', 'alpha');
    alpha.textContent = 'alpha';
    const beta = document.createElement('span');
    beta.className = 'js-cell-token';
    beta.setAttribute('data-cell-term', 'beta');
    beta.textContent = 'beta';
    cueText.append(alpha, document.createTextNode(' '), beta);
    shadow.appendChild(cueText);
    document.body.appendChild(panelHost);

    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      getExtraShadowRoots: () => [shadow],
      onOpenDictionary: jest.fn(),
      windowSize: 1,
    });
    controller.enable();

    const range = document.createRange();
    range.selectNodeContents(cueText);
    const shadowSelection = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => range,
      removeAllRanges: jest.fn(),
    } as unknown as Selection;
    const getSelectionSpy = jest.spyOn(window, 'getSelection').mockReturnValue(shadowSelection);

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('3')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'alpha', 'ignore');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'beta', 'ignore');

    getSelectionSpy.mockRestore();
    controller.destroy();
  });

  it('applies status when a real shadow selection reports document-level isCollapsed', async () => {
    // Real Chromium drag inside a shadow root: window.getSelection() retargets
    // anchor/focus to the host → isCollapsed=true + collapsed legacy range;
    // only getComposedRanges exposes the real range. Programmatic addRange
    // (previous test) reports isCollapsed=false and misses this regression.
    const panelHost = document.createElement('div');
    const shadow = panelHost.attachShadow({ mode: 'open' });
    const cueText = document.createElement('span');
    const alpha = document.createElement('span');
    alpha.className = 'js-cell-token';
    alpha.setAttribute('data-cell-term', 'alpha');
    alpha.textContent = 'alpha';
    const beta = document.createElement('span');
    beta.className = 'js-cell-token';
    beta.setAttribute('data-cell-term', 'beta');
    beta.textContent = 'beta';
    cueText.append(alpha, document.createTextNode(' '), beta);
    shadow.appendChild(cueText);
    document.body.appendChild(panelHost);

    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      getExtraShadowRoots: () => [shadow],
      onOpenDictionary: jest.fn(),
      windowSize: 1,
    });
    controller.enable();

    const collapsedRange = document.createRange();
    collapsedRange.setStart(document.body, 0);
    collapsedRange.collapse(true);
    const shadowSelection = {
      isCollapsed: true,
      rangeCount: 1,
      getRangeAt: () => collapsedRange,
      getComposedRanges: ({ shadowRoots }: { shadowRoots: ShadowRoot[] }) =>
        shadowRoots.includes(shadow)
          ? [{
              collapsed: false,
              startContainer: alpha.firstChild!,
              startOffset: 0,
              endContainer: beta.firstChild!,
              endOffset: 4,
            }]
          : [],
      removeAllRanges: jest.fn(),
    } as unknown as Selection;
    const getSelectionSpy = jest.spyOn(window, 'getSelection').mockReturnValue(shadowSelection);

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('3')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'alpha', 'ignore');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'beta', 'ignore');

    getSelectionSpy.mockRestore();
    controller.destroy();
  });

  it('applies status to the term set via setHoveredTerm (cue-list hover path)', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    controller.setHoveredTerm('hello');
    setWordStatus.mockClear();
    expect(controller.handleStatusKey('2')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'known');

    controller.setHoveredTerm(null);
    setWordStatus.mockClear();
    expect(controller.handleStatusKey('2')).toBe(false);

    controller.destroy();
  });

  it('routes 1-4 keys to the popup target instead of the hovered token', async () => {
    const apply = jest.fn();
    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);
    const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello world.' }];
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      onOpenDictionary: jest.fn(),
      getPopupStatusTarget: () => ({ term: 'lookup-term', langCode: 'en', apply }),
      windowSize: 1,
    });

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('3')).toBe(true);

    // The popup path owns persistence + fan-out — the tokenize apply path
    // must not run for the hovered word.
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('ignore');
    expect(setWordStatus).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('falls back to the hovered token when the popup target returns null', async () => {
    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);
    const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello world.' }];
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      onOpenDictionary: jest.fn(),
      getPopupStatusTarget: () => null,
      windowSize: 1,
    });

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('1')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'unknown');

    controller.destroy();
  });

  it('applies status through handleStatusKey for player-mode keyboard routing', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    hello?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(controller.handleStatusKey('4')).toBe(true);

    const after = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(after?.className).toContain('js-cell-token--status-tracking');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'tracking');

    controller.destroy();
  });

  it('updates an already-rendered token when a status change is emitted', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const before = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(before?.className).toContain('js-cell-token--status-unknown');

    emitWordStatusChanged({ langCode: 'en', term: 'hello', status: 'ignore' });

    const after = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(after?.className).toContain('js-cell-token--status-ignore');
    expect(after?.className).not.toContain('js-cell-token--status-unknown');

    controller.destroy();
  });

  it('re-fetches statuses and repaints tokens on a word-statuses reload event', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const before = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(before?.className).toContain('js-cell-token--status-unknown');

    getWordStatuses.mockResolvedValue(new Map([['hello', 'ignore']]));
    emitWordStatusesReload('en');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const after = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(after?.className).toContain('js-cell-token--status-ignore');
    expect(after?.className).not.toContain('js-cell-token--status-unknown');

    controller.destroy();
  });

  it('marks carded terms and repaints them when SRS_CARDS_CHANGED arrives', async () => {
    getSrsCardTerms.mockResolvedValue(new Set(['hello']));
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(target.querySelector('[data-cell-term="hello"]')!.className).toContain('js-cell-token--has-card');
    expect(target.querySelector('[data-cell-term="world"]')!.className).not.toContain('js-cell-token--has-card');

    getSrsCardTerms.mockResolvedValue(new Set(['world']));
    emitSrsCardsChanged('en');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getSrsCardTerms).toHaveBeenCalledTimes(2);
    expect(target.querySelector('[data-cell-term="hello"]')!.className).not.toContain('js-cell-token--has-card');
    expect(target.querySelector('[data-cell-term="world"]')!.className).toContain('js-cell-token--has-card');

    controller.destroy();
  });

  it('ignores SRS_CARDS_CHANGED for other languages', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    getSrsCardTerms.mockClear();

    emitSrsCardsChanged('ja');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getSrsCardTerms).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('disables tokenization and restores plain text', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(target.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);

    controller.disable();

    expect(target.querySelectorAll('.js-cell-token').length).toBe(0);
    expect(target.textContent).toBe('Hello world.');

    controller.destroy();
  });

  it('ctrl+click marks the token selected and applies keys 1-4 to the whole selection', async () => {
    const { target, cues, controller, onOpenDictionary } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement;
    const world = target.querySelector('[data-cell-term="world"]') as HTMLElement;
    expect(hello).not.toBeNull();
    expect(world).not.toBeNull();

    hello.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    world.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));

    expect(onOpenDictionary).not.toHaveBeenCalled();
    expect(controller.getState().selectedTerms.size).toBe(2);
    expect(hello.className).toContain('js-cell-token--selected');
    expect(world.className).toContain('js-cell-token--selected');

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('3')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'ignore');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'world', 'ignore');
    expect(controller.getState().selectedTerms.size).toBe(0);
    expect(hello.className).not.toContain('js-cell-token--selected');
    expect(world.className).not.toContain('js-cell-token--selected');

    controller.destroy();
  });

  it('toggleSelectedTerm shares the store the status keys read (cue-list path)', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const seen: number[] = [];
    const unsubscribe = controller.subscribeSelection((terms) => seen.push(terms.size));

    controller.toggleSelectedTerm('panel-term');
    controller.toggleSelectedTerm('hello');

    expect(controller.getState().selectedTerms.has('panel-term')).toBe(true);
    expect(seen).toEqual([1, 2]);

    setWordStatus.mockClear();
    expect(controller.handleStatusKey('2')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'panel-term', 'known');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'known');
    expect(controller.getState().selectedTerms.size).toBe(0);

    unsubscribe();
    controller.destroy();
  });

  it('Escape clears the selection and removes the selected wash', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement;
    hello.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(hello.className).toContain('js-cell-token--selected');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(controller.getState().selectedTerms.size).toBe(0);
    expect(hello.className).not.toContain('js-cell-token--selected');

    controller.destroy();
  });

  it('drops the selection when the active cue changes', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement;
    hello.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(controller.getState().selectedTerms.size).toBe(1);

    target.textContent = cues[1]!.text;
    controller.render(1, -1);

    expect(controller.getState().selectedTerms.size).toBe(0);

    controller.destroy();
  });

  it('announces selection count changes through the shared live region', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement;
    hello.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));

    const region = document.getElementById('cell-token-selection-announcer');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.textContent).toBe('1 selected');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(region?.textContent).toBe('Selection cleared');

    controller.destroy();
  });
});
