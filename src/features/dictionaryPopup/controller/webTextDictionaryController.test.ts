// webTextDictionaryController tests — spec §2: top-level popup + lookup wiring.

import { describe, expect, it, beforeAll, beforeEach, jest } from '@jest/globals';
import { waitFor, act } from '@testing-library/react';

jest.mock('@/shared/lib/chrome-apis/runtime');
jest.mock('@/features/cardCreator/media/screenshot', () => ({
  captureScreenshot: jest.fn(() => Promise.resolve({
    kind: 'image',
    filename: 'screenshot.png',
    mimeType: 'image/png',
    data: new ArrayBuffer(0),
  })),
}));
jest.mock('@/features/cardCreator/media/sentenceAudio', () => ({
  captureSentenceAudio: jest.fn(() => Promise.resolve({
    ok: true,
    file: {
      kind: 'audio',
      filename: 'sentence.webm',
      mimeType: 'audio/webm',
      data: new ArrayBuffer(0),
    },
  })),
  seekAndWaitReady: jest.fn(() => Promise.resolve(true)),
}));
// isChildFrame is the single source of truth for the child-frame orbital-badge
// gate. Mocked so tests can toggle the frame context without touching window.top.
jest.mock('@/shared/lib/dom/isChildFrame', () => ({
  isChildFrame: jest.fn(() => false),
}));

import { createWebTextDictionaryController } from './webTextDictionaryController';
import type { WebTextDictionaryControllerDeps } from './webTextDictionaryController';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { captureSentenceAudio, seekAndWaitReady } from '@/features/cardCreator/media/sentenceAudio';
import { onWordStatusChanged, type WordStatusChangedDetail } from '@/features/dictionary/services/wordStatusEvents';
import { CURRENT_SCHEMA_VERSION } from '@/shared/lib/storage/settingsStore';
import { UNIVERSAL_PANEL_HOST_ID } from '@/shared/lib/dom/cellUiHosts';
import type { LookupResult, LookupRequest } from '@/entities/dictionary';
import type { DictionaryPopupSettings, CardCreatorSettings, LanguageProfile, Settings } from '@/entities/settings/types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';

const mockSendMessage = jest.mocked(sendMessage);

beforeAll(() => {
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown> };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve()),
  };
  c.storage.onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  // jsdom lacks ResizeObserver — orbital badge uses it to detect scrollbar
  // appearance. Mock with a no-op implementation.
  globalThis.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })) as unknown as typeof ResizeObserver;
});

function makePopupSettings(overrides: Partial<DictionaryPopupSettings> = {}): DictionaryPopupSettings {
  return {
    enabled: true,
    triggerMode: 'click',
    defaultActiveTab: null,
    srsDestination: 'anki',
    popupWidthPx: 560,
    popupMaxHeightPx: 480,
    popupSheetHeightVh: 75,
    externalDictLinks: [],
    badgePointerTrigger: { position: 'center', size: 36, pointerScale: 0.25 },
    ...overrides,
  };
}

function makeCardCreatorSettings(overrides: Partial<CardCreatorSettings> = {}): CardCreatorSettings {
  return {
    ankiConnectUrl: 'http://localhost:8765',
    defaultDeck: 'Default',
    defaultNoteType: 'Cell Video Card',
    defaultTags: '',
    mediaUpdateMode: 'overwrite',
    autoCompleteToggles: {
      definitions: true,
      wordAudios: true,
      sentenceAudios: true,
      images: true,
      sentenceTranslation: true,
      sentence: true,
    },
    audioFallback: 'community-then-tts',
    ...overrides,
  };
}

function makeResult(overrides: Partial<LookupResult> = {}): LookupResult {
  return {
    term: 'take off',
    langCode: 'en',
    reading: '/teɪk ɒf/',
    readingKind: 'ipa',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: ['verb'],
    definitions: [{
      id: 'd1',
      pos: 'verb',
      text: 'to remove something',
      examples: [{ role: 'example', text: 'Take off your shoes.' }],
      source: 'Cambridge',
      defaultSelected: true,
    }],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<LookupRequest> = {}): LookupRequest {
  return {
    term: 'take',
    langCode: 'en',
    contextSentence: 'Take off your shoes.',
    cursorOffset: 0,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<WebTextDictionaryControllerDeps> = {}): WebTextDictionaryControllerDeps {
  return {
    container: document.body,
    dictionaryPopupSettings: makePopupSettings(),
    cardCreatorSettings: makeCardCreatorSettings(),
    nativeLanguage: 'vi',
    hasVideo: false,
    ...overrides,
  };
}

function makePanelController(): jest.Mocked<NonNullable<WebTextDictionaryControllerDeps['panelController']>> {
  return {
    open: jest.fn(() => Promise.resolve()),
    close: jest.fn(),
    switchTab: jest.fn(() => Promise.resolve()),
    isOpen: jest.fn(() => false),
    sendToCard: jest.fn(() => Promise.resolve()),
    unmount: jest.fn(),
    getHosts: jest.fn(() => []),
    onOpenChange: jest.fn((_listener: (open: boolean) => void) => () => {}),
  } as unknown as jest.Mocked<NonNullable<WebTextDictionaryControllerDeps['panelController']>>;
}

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockReset().mockResolvedValue({} as never);
  mockSendMessage.mockReset().mockImplementation((message) => {
    const msg = message as { type?: string };
    if (msg.type === 'WORD_STATUS_SET') {
      return Promise.resolve({ success: true } as unknown as never);
    }
    return Promise.resolve({} as unknown as never);
  });
  jest.mocked(captureSentenceAudio).mockClear();
  jest.mocked(seekAndWaitReady).mockClear().mockResolvedValue(true);
  document.body.innerHTML = '';
});

describe('createWebTextDictionaryController', () => {
  it('creates controller with all public methods', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    expect(typeof ctrl.attach).toBe('function');
    expect(typeof ctrl.detach).toBe('function');
    expect(typeof ctrl.destroy).toBe('function');
    expect(typeof ctrl.updateSettings).toBe('function');
    expect(typeof ctrl.configureVideo).toBe('function');
    expect(typeof ctrl.handleLookup).toBe('function');
    expect(typeof ctrl.cancelLookup).toBe('function');
    expect(typeof ctrl.showHighlight).toBe('function');
    expect(typeof ctrl.clearHighlight).toBe('function');
    act(() => { ctrl.destroy() });
  });

  it('handleLookup sends LOOKUP_REQUEST and renders popup on result', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const request = makeRequest();
    const anchorRect = new DOMRect(100, 200, 50, 20);
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(request, 'req-1', anchorRect, range) });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_REQUEST',
      payload: { requestId: 'req-1', request },
    });

    await act(async () => {
    await Promise.resolve(); // flush microtasks
    await Promise.resolve();
    });

    const popupHost = document.querySelector('.js-cell-popup-host');
    expect(popupHost).not.toBeNull();
    act(() => { ctrl.destroy() });
  });

  it('dismissLookup cancels in-flight immediately, hides popup after delay', () => {
    jest.useFakeTimers();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-dismiss', new DOMRect(0, 0, 0, 0), range) });
    act(() => { ctrl.dismissLookup() });

    // In-flight cancel is immediate.
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_CANCEL',
      payload: { requestId: 'req-dismiss' },
    });
    // Popup dismiss is delayed — not cleared yet.
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();
    // Flush the 500ms dismiss timer.
    act(() => { jest.advanceTimersByTime(500) });
    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();

    act(() => { ctrl.destroy() });
    jest.useRealTimers();
  });

  it('dismissLookup delay is canceled by a new lookup (seamless word switch)', async () => {
    jest.useFakeTimers();
    mockSendMessage.mockResolvedValue({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest({ term: 'shoes' }), 'req-1', new DOMRect(0, 0, 0, 0), range) });
    // Let the first lookup's result resolve so highlight shows.
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();

    ctrl.dismissLookup(); // schedules dismiss in 500ms

    // Before the timer fires, a new lookup arrives.
    act(() => { jest.advanceTimersByTime(300) });
    act(() => { ctrl.handleLookup(makeRequest({ term: 'shoes' }), 'req-2', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    // Flush past the original 500ms — dismiss should NOT have fired.
    act(() => { jest.advanceTimersByTime(300) });
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();

    act(() => { ctrl.destroy() });
    jest.useRealTimers();
  });

  it('handleLookup ignores stale response after dismissLookup', async () => {
    jest.useFakeTimers();
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const request = makeRequest();
    const anchorRect = new DOMRect(100, 200, 50, 20);
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(request, 'req-stale', anchorRect, range) });
    act(() => { ctrl.dismissLookup() });

    // Flush dismiss timer + microtasks.
    act(() => { jest.advanceTimersByTime(500) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    // Popup host should be removed after the delayed destroy; no term should
    // render from the stale response.
    const host = document.querySelector('.js-cell-popup-host');
    if (host && host.shadowRoot) {
      const popup = host.shadowRoot.querySelector('[data-cell-id="popup-dictionary"]');
      expect(popup).toBeNull();
    }
    const termEl = host && host.shadowRoot ? host.shadowRoot.querySelector('[data-cell-id="dictionary-term"]') : null;
    expect(termEl?.textContent).not.toBe(result.term);

    act(() => { ctrl.destroy() });
    jest.useRealTimers();
  });

  it('handleLookup propagates popup status cycle to deps.onStatusChange', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const onStatusChange = jest.fn();
    const emitted: WordStatusChangedDetail[] = [];
    const unsubscribe = onWordStatusChanged((detail) => emitted.push(detail));
    const ctrl = createWebTextDictionaryController(makeDeps({ onStatusChange }));
    const request = makeRequest();
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(request, 'req-status', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    // Click the status badge inside the popup to cycle unknown → tracking.
    const popupHost = document.querySelector('.js-cell-popup-host') as Element & { shadowRoot?: ShadowRoot };
    await waitFor(() => expect(popupHost).not.toBeNull());
    const shadow = popupHost.shadowRoot!;
    const statusBadge = await waitFor(() => {
      const el = shadow.querySelector('[data-cell-id="dictionary-status-cycle"]') as HTMLButtonElement | null;
      if (!el) throw new Error('status badge not found');
      return el;
    });
    act(() => { statusBadge.click() });

    expect(onStatusChange).toHaveBeenCalledWith('take off', 'en', 'tracking');
    expect(emitted).toContainEqual({ term: 'take off', langCode: 'en', status: 'tracking' });
    unsubscribe();
    act(() => { ctrl.destroy() });
  });

  it('getPopupStatusTarget exposes the displayed term and routes 1-4 status through the popup path', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const onStatusChange = jest.fn();
    const emitted: WordStatusChangedDetail[] = [];
    const unsubscribe = onWordStatusChanged((detail) => emitted.push(detail));
    const ctrl = createWebTextDictionaryController(makeDeps({ onStatusChange }));
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-key', new DOMRect(0, 0, 0, 0), range) });

    // While the lookup is in flight there is no displayed term — a stale
    // target would apply the key to the previously looked-up word.
    expect(ctrl.getPopupStatusTarget()).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const target = ctrl.getPopupStatusTarget();
    expect(target).toEqual(expect.objectContaining({ term: 'take off', langCode: 'en' }));

    mockSendMessage.mockClear();
    act(() => { target!.apply('known') });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'WORD_STATUS_SET',
      payload: { tabId: -1, langCode: 'en', term: 'take off', status: 'known' },
    });
    expect(emitted).toContainEqual({ term: 'take off', langCode: 'en', status: 'known' });
    expect(onStatusChange).toHaveBeenCalledWith('take off', 'en', 'known');

    unsubscribe();
    act(() => { ctrl.destroy() });
  });

  it('getPopupStatusTarget clears the stale term when a new lookup starts', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-a', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ctrl.getPopupStatusTarget()?.term).toBe('take off');

    // A second lookup on the same level reuses the mount — the previous term
    // must not be reachable while the new result is loading.
    mockSendMessage.mockReturnValueOnce(new Promise(() => {}) as never);
    act(() => { ctrl.handleLookup(makeRequest({ term: 'put' }), 'req-b', new DOMRect(0, 0, 0, 0), range) });

    expect(ctrl.getPopupStatusTarget()).toBeNull();

    act(() => { ctrl.destroy() });
  });

  it('handleLookup logs warning on lookup failure', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: 'not found' } as unknown as never);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const ctrl = createWebTextDictionaryController(makeDeps());
    const request = makeRequest();
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(request, 'req-2', new DOMRect(0, 0, 0, 0), range) });

    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    act(() => { ctrl.destroy() });
  });

  it('handleLookup appends additional candidates', async () => {
    const winner = makeResult({ term: 'take' });
    const candidate = makeResult({ term: 'take off' });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [winner, candidate] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const request = makeRequest();
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(request, 'req-3', new DOMRect(0, 0, 0, 0), range) });

    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    const popupHost = document.querySelector('.js-cell-popup-host');
    expect(popupHost).not.toBeNull();
    act(() => { ctrl.destroy() });
  });

  it('cancelLookup sends LOOKUP_CANCEL', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    act(() => { ctrl.cancelLookup('req-4') });
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_CANCEL',
      payload: { requestId: 'req-4' },
    });
    act(() => { ctrl.destroy() });
  });

  it('handleLookup caches results and prefetches adjacent words for instant repeat hover', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValue({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const request = makeRequest();
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    function takeCalls(): unknown[] {
      return mockSendMessage.mock.calls.filter(([msg]) => {
        const m = msg as { payload?: { request?: { term?: string } } };
        return m.payload?.request?.term === 'take';
      });
    }

    function offCalls(): unknown[] {
      return mockSendMessage.mock.calls.filter(([msg]) => {
        const m = msg as { payload?: { request?: { term?: string } } };
        return m.payload?.request?.term === 'off';
      });
    }

    // First lookup: network for 'take' plus prefetch for 'off'.
    act(() => { ctrl.handleLookup(request, 'req-cache-1', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    });

    expect(takeCalls()).toHaveLength(1);
    expect(offCalls()).toHaveLength(1);

    // Second lookup for the same term should hit the cache and not send a new request.
    act(() => { ctrl.handleLookup(request, 'req-cache-2', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    expect(takeCalls()).toHaveLength(1);
    // Prefetch for 'off' is skipped because it is already cached.
    expect(offCalls()).toHaveLength(1);

    const popupHost = document.querySelector('.js-cell-popup-host');
    expect(popupHost).not.toBeNull();
    act(() => { ctrl.destroy() });
  });

  it('re-points lookups at the active profile language and clears the cache on profile switch', async () => {
    const storageGet = chrome.storage.local.get as jest.Mock;
    const onChangedAdd = chrome.storage.onChanged.addListener as jest.Mock;
    const makeProfile = (id: string, target: string): LanguageProfile => ({
      id,
      target,
      native: 'vi',
      name: `Test ${id}`,
      order: 1,
      subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
      subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
      subtitleOverlayAutoLoad: true,
      subtitleOverlayAutoLoadAsr: false,
      subtitleOverlayAutoTranslate: false,
      dictionaryPopup: DEFAULT_DICTIONARY_POPUP_SETTINGS,
    });
    const settingsFor = (profileId: string, target: string): { settings: Settings } => ({
      settings: {
        ...DEFAULT_SETTINGS,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        activeProfileId: profileId,
        languageProfiles: [makeProfile(profileId, target)],
      } as unknown as Settings,
    });

    storageGet.mockResolvedValue(settingsFor('p-en', 'en') as never);
    mockSendMessage.mockResolvedValue({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const listener = onChangedAdd.mock.calls.at(-1)![0] as (
      changes: Record<string, unknown>,
      area: string,
    ) => void;
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const request = makeRequest();
    act(() => { ctrl.handleLookup(request, 'req-en-1', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => { ctrl.handleLookup(request, 'req-en-2', new DOMRect(0, 0, 0, 0), range) });
    const enRequests = mockSendMessage.mock.calls.filter(([msg]) => {
      const m = msg as { type?: string; payload?: { request?: { term?: string; langCode?: string } } };
      return m.type === 'LOOKUP_REQUEST' && m.payload?.request?.term === 'take';
    });
    expect(enRequests).toHaveLength(1);

    // Switch the active profile to Afar — the cached 'en' result must not be
    // served and the request must carry 'aa'.
    storageGet.mockResolvedValue(settingsFor('p-aa', 'aa') as never);
    act(() => { listener({ settings: { newValue: {} } }, 'local') });
    await waitFor(() => {
      expect(ctrl.hasOpenPopup()).toBe(false);
    });

    mockSendMessage.mockClear();
    act(() => { ctrl.handleLookup(request, 'req-aa', new DOMRect(0, 0, 0, 0), range) });
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_REQUEST',
      payload: {
        requestId: 'req-aa',
        request: expect.objectContaining({ langCode: 'aa' }),
      },
    });

    act(() => { ctrl.destroy() });
  });

  it('attach and detach create/destroy WebTriggerController without error', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.attach('hover');
    ctrl.detach();
    ctrl.attach('click');
    ctrl.detach();
    act(() => { ctrl.destroy() });
  });

  it('showHighlight and clearHighlight work', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.showHighlight(range) });
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();

    ctrl.clearHighlight();
    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();

    act(() => { ctrl.destroy() });
  });

  it('updateSettings re-attaches with new trigger mode', async () => {
    const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ triggerMode: 'click' }) }));
    ctrl.attach('click');
    const settings = {
      dictionaryPopup: makePopupSettings({ triggerMode: 'hover' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    };
    await act(async () => {
    ctrl.updateSettings(settings);
    });
    // No error + controller still functional.
    expect(typeof ctrl.handleLookup).toBe('function');
    act(() => { ctrl.destroy() });
  });

  it('updateSettings creates orbital badge when enabled', async () => {
    const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ enabled: false }) }));
    const settings = {
      dictionaryPopup: makePopupSettings({ enabled: true }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    };
    await act(async () => { ctrl.updateSettings(settings); });
    const host = document.querySelector('.js-cell-orbital-badge-host');
    expect(host).not.toBeNull();
    await waitFor(() => {
      const badge = host && (host as HTMLElement).shadowRoot?.querySelector('.js-cell-orbital-badge');
      expect(badge).not.toBeNull();
    });
    act(() => { ctrl.destroy() });
  });

  it('repeated updateSettings does not recreate the badge', async () => {
    const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ enabled: false }) }));
    const settings = {
      dictionaryPopup: makePopupSettings({ enabled: true }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    };
    await act(async () => { ctrl.updateSettings(settings); });
    const host1 = document.querySelector('.js-cell-orbital-badge-host');
    expect(host1).not.toBeNull();

    await act(async () => {
      await act(async () => {
      ctrl.updateSettings({
        ...settings,
        dictionaryPopup: makePopupSettings({ enabled: true, badgePointerTrigger: { position: 'top', size: 36, pointerScale: 0.25 } }),
      });
      });
    });

    const hosts = document.querySelectorAll('.js-cell-orbital-badge-host');
    expect(hosts.length).toBe(1);
    expect(hosts[0]).toBe(host1);
    act(() => { ctrl.destroy() });
  });

  // Helper: toggle document.fullscreenElement (jsdom leaves it null). The
  // child-frame gate reads it to decide whether the badge may mount.
  function setFullscreenElement(el: Element | null): void {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => el,
    });
  }

  it('child frame without fullscreen does NOT mount an orbital badge', async () => {
    jest.mocked(isChildFrame).mockReturnValue(true);
    setFullscreenElement(null);
    try {
      const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ enabled: false }) }));
      await act(async () => {
        await act(async () => {
        ctrl.updateSettings({
          dictionaryPopup: makePopupSettings({ enabled: true }),
          cardCreator: makeCardCreatorSettings(),
          subtitleOverlayNativeLanguage: 'vi',
        });
        });
      });
      // No badge in a child frame while the top-frame badge covers the viewport.
      expect(document.querySelector('.js-cell-orbital-badge-host')).toBeNull();
      act(() => { ctrl.destroy() });
    } finally {
      jest.mocked(isChildFrame).mockReturnValue(false);
    }
  });

  it('child frame in native fullscreen mounts an orbital badge', async () => {
    jest.mocked(isChildFrame).mockReturnValue(true);
    const fsEl = document.createElement('div');
    document.body.appendChild(fsEl);
    setFullscreenElement(fsEl);
    try {
      const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ enabled: false }) }));
      await act(async () => {
        await act(async () => {
        ctrl.updateSettings({
          dictionaryPopup: makePopupSettings({ enabled: true }),
          cardCreator: makeCardCreatorSettings(),
          subtitleOverlayNativeLanguage: 'vi',
        });
        });
      });
      const host = document.querySelector('.js-cell-orbital-badge-host');
      expect(host).not.toBeNull();
      act(() => { ctrl.destroy() });
    } finally {
      setFullscreenElement(null);
      jest.mocked(isChildFrame).mockReturnValue(false);
    }
  });

  it('top frame hides the orbital badge while a child iframe is native-fullscreen', async () => {
    // Top frame: isChildFrame = false (default mock). The badge mounts, then
    // the fullscreenchange handler in mountOrbitalBadge must hide it when
    // document.fullscreenElement is an <iframe> (child video native fullscreen
    // covers the top viewport and the host badge cannot render over it).
    const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ enabled: false }) }));
    await act(async () => {
      await act(async () => {
      ctrl.updateSettings({
        dictionaryPopup: makePopupSettings({ enabled: true }),
        cardCreator: makeCardCreatorSettings(),
        subtitleOverlayNativeLanguage: 'vi',
      });
      });
    });
    const host = document.querySelector('.js-cell-orbital-badge-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.style.display).toBe(''); // visible before fullscreen

    // Simulate child iframe entering native fullscreen.
    const fakeIframe = document.createElement('iframe');
    setFullscreenElement(fakeIframe);
    act(() => { document.dispatchEvent(new Event('fullscreenchange')) });
    expect(host.style.display).toBe('none'); // hidden while iframe is fullscreen

    // Simulate exiting fullscreen → badge restored.
    setFullscreenElement(null);
    act(() => { document.dispatchEvent(new Event('fullscreenchange')) });
    expect(host.style.display).toBe('');
    act(() => { ctrl.destroy() });
  });

  it('updateSettings attaches and triggers popup when enabled', async () => {
    jest.useFakeTimers();
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ enabled: false }) }));
    const settings = {
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'hover' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    };
    await act(async () => {
    ctrl.updateSettings(settings);
    });

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const fakeRange = document.createRange();
    fakeRange.setStart(textNode, 0);
    fakeRange.setEnd(textNode, 4);
    const original = document.caretRangeFromPoint;
    document.caretRangeFromPoint = () => fakeRange;

    const move = new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 });
    Object.defineProperty(move, 'target', { value: p });
    act(() => { document.dispatchEvent(move) });

    act(() => { jest.advanceTimersByTime(150) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    document.caretRangeFromPoint = original;

    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
    act(() => { ctrl.destroy() });
    jest.useRealTimers();
  });

  it('opens the configured default active tab (image) after lookup', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({
      dictionaryPopupSettings: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: 'image' }),
    }));
    ctrl.attach('click');

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const fakeRange = document.createRange();
    fakeRange.setStart(textNode, 0);
    fakeRange.setEnd(textNode, 4);
    const original = document.caretRangeFromPoint;
    document.caretRangeFromPoint = () => fakeRange;

    const click = new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 10 });
    Object.defineProperty(click, 'target', { value: p });
    act(() => { document.dispatchEvent(click) });

    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    document.caretRangeFromPoint = original;

    const host = await waitFor(() => {
      const el = document.querySelector('.js-cell-popup-host') as HTMLElement | null;
      if (!el) throw new Error('popup host not found');
      return el;
    });
    const shadow = host.shadowRoot!;
    const activeBtn = await waitFor(() => {
      const el = shadow.querySelector('[data-cell-id="dictionary-tab-image"][aria-selected="true"]');
      if (!el) throw new Error('image tab not active');
      return el;
    });
    expect(activeBtn).not.toBeNull();
    expect(activeBtn.getAttribute('data-cell-id')).toBe('dictionary-tab-image');
    await waitFor(() => expect(shadow.querySelector('[data-cell-id="dictionary-image-panel"]')).not.toBeNull());
    act(() => { ctrl.destroy() });
  });

  it('updates default active tab at runtime and opens it after lookup', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({
      dictionaryPopupSettings: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: null }),
    }));
    ctrl.attach('click');
    await act(async () => {
    ctrl.updateSettings({
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: 'image' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    });
    });

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const fakeRange = document.createRange();
    fakeRange.setStart(textNode, 0);
    fakeRange.setEnd(textNode, 4);
    const original = document.caretRangeFromPoint;
    document.caretRangeFromPoint = () => fakeRange;

    const click = new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 10 });
    Object.defineProperty(click, 'target', { value: p });
    act(() => { document.dispatchEvent(click) });

    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    document.caretRangeFromPoint = original;

    const host = await waitFor(() => {
      const el = document.querySelector('.js-cell-popup-host') as HTMLElement | null;
      if (!el) throw new Error('popup host not found');
      return el;
    });
    const shadow = host.shadowRoot!;
    const activeBtn = await waitFor(() => {
      const el = shadow.querySelector('[data-cell-id="dictionary-tab-image"][aria-selected="true"]');
      if (!el) throw new Error('image tab not active');
      return el;
    });
    expect(activeBtn).not.toBeNull();
    expect(activeBtn.getAttribute('data-cell-id')).toBe('dictionary-tab-image');
    await waitFor(() => expect(shadow.querySelector('[data-cell-id="dictionary-image-panel"]')).not.toBeNull());
    act(() => { ctrl.destroy() });
  });

  it('clears active tab when defaultActiveTab is set to null at runtime', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({
      dictionaryPopupSettings: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: 'image' }),
    }));

    const request: LookupRequest = { term: 'Take', langCode: 'en', contextSentence: 'Take off your shoes.', cursorOffset: 0 };
    const anchorRect = new DOMRect(0, 0, 10, 10);
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(request, 'req-1', anchorRect, range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    // Now switch default to None and look up again.
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);
    await act(async () => {
    ctrl.updateSettings({
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: null }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    });
    });

    act(() => { ctrl.handleLookup(request, 'req-2', anchorRect, range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    const host = document.querySelector('.js-cell-popup-host') as HTMLElement | null;
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow?.querySelector('[data-cell-id^="dictionary-tab-"][aria-selected="true"]')).toBeNull();
    expect(shadow?.querySelector('[data-cell-id="dictionary-image-panel"]')).toBeNull();
    act(() => { ctrl.destroy() });
  });

  it('switches to hover mode and triggers lookup on mousemove', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({
      dictionaryPopupSettings: makePopupSettings({ enabled: true, triggerMode: 'click' }),
    }));

    // Switch to hover mode.
    await act(async () => {
    ctrl.updateSettings({
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'hover' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    });
    });

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);

    const textNode = p.firstChild as Text;
    const fakeRange = document.createRange();
    fakeRange.setStart(textNode, 0);
    fakeRange.setEnd(textNode, 4);
    const original = document.caretRangeFromPoint;
    document.caretRangeFromPoint = () => fakeRange;

    const move = new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 });
    Object.defineProperty(move, 'target', { value: p });
    act(() => { document.dispatchEvent(move) });

    // Wait for hover debounce (16–50 ms) plus microtask flush.
    await new Promise((r) => setTimeout(r, 100));
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    document.caretRangeFromPoint = original;

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'LOOKUP_REQUEST' }));
    act(() => { ctrl.destroy() });
  });

  it('destroy removes popup and highlight artifacts', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);
    act(() => { ctrl.showHighlight(range) });

    act(() => { ctrl.destroy() });

    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();
  });

  it('Send to Card routes to the integrated panel when panelController is present', async () => {
    const panelController = makePanelController();
    const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-send', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    // Media is fetched asynchronously before routing to the integrated panel.
    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    const prefill = panelController.sendToCard.mock.calls[0]![0];
    expect(prefill.term).toBe('take off');
    expect(prefill.contextSentence).toBe('Take off your shoes.');

    // Popup closes on click — media collection continues in the background.
    expect(document.querySelector('.js-cell-popup-host')).toBeNull();

    act(() => { ctrl.destroy() });
  });

  it('Send to Card forwards the popup selection snapshot to the integrated panel', async () => {
    const panelController = makePanelController();
    const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-send-selection', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;

    // Tick the only definition checkbox in the popup.
    const defEl = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-definition"]') as HTMLElement | null;
      if (!el) throw new Error('definition row not found');
      return el;
    });
    act(() => { defEl.click() });

    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    const prefill = panelController.sendToCard.mock.calls[0]![0];
    expect(prefill.selectedDefinitionIds).toEqual(['d1']);
    expect(prefill.selectedAudioIds).toEqual([]);
    expect(prefill.selectedImageIds).toEqual([]);
    expect(prefill.translationSelected).toBe(false);
    // The full popup state (lookup result + loaded media arrays) is cloned
    // so the integrated Dictionary can re-render the same candidate and tabs.
    expect(prefill.lookupResult).toEqual(expect.objectContaining({ term: 'take off' }));
    expect(prefill.audioItems).toEqual([]);
    expect(prefill.imageItems).toEqual([]);

    act(() => { ctrl.destroy() });
  });

  it('Send to Card from subtitle video includes captured screenshot and sentence audio', async () => {
    const panelController = makePanelController();
    const mockVideo = {
      videoWidth: 1920,
      readyState: 2,
      currentTime: 0.5,
      play: jest.fn(),
      pause: jest.fn(),
    } as unknown as HTMLVideoElement;
    const ctrl = createWebTextDictionaryController(makeDeps({
      panelController,
      hasVideo: true,
      video: mockVideo,
      getTargetCues: () => [{ index: 1, start: 0, end: 1000, text: 'Take off your shoes.' }],
    }));
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);
    mockSendMessage.mockResolvedValue({ success: true, data: { url: 'https://tts.example/sentence.mp3' } } as unknown as never);

    const block = document.createElement('div');
    block.dataset.cellId = 'subtitle-block';
    const line = document.createElement('div');
    line.dataset.role = 'target';
    const lineText = document.createElement('span');
    const token = document.createElement('span');
    token.className = 'js-cell-token';
    token.textContent = 'Take off your shoes.';
    lineText.appendChild(token);
    line.appendChild(lineText);
    block.appendChild(line);
    document.body.appendChild(block);
    const range = document.createRange();
    range.selectNodeContents(token.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-video-send', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    const prefill = panelController.sendToCard.mock.calls[0]![0];
    expect(prefill.term).toBe('take off');
    expect(prefill.contextSentence).toBe('Take off your shoes.');
    expect(prefill.video).toBe(mockVideo);
    expect(prefill.initialMedia).toHaveLength(2);
    expect((prefill.initialMedia ?? []).map((f: { kind: string }) => f.kind)).toEqual(['image', 'audio']);
    expect(prefill.cue).toMatchObject({ start: 0, end: 1000, targetText: 'Take off your shoes.' });
    // The recorded cue clip is the sentence audio — the popup's TTS sentence
    // URL must not leak through alongside it.
    expect(prefill.sentenceAudioUrls).toEqual([]);

    act(() => { ctrl.destroy() });
  });

  it('Send to Card from web text does not capture video media even when a video is configured', async () => {
    const panelController = makePanelController();
    const mockVideo = {
      videoWidth: 1920,
      readyState: 2,
      currentTime: 0.5,
      play: jest.fn(),
      pause: jest.fn(),
    } as unknown as HTMLVideoElement;
    const ctrl = createWebTextDictionaryController(makeDeps({
      panelController,
      hasVideo: true,
      video: mockVideo,
      getTargetCues: () => [{ index: 1, start: 0, end: 1000, text: 'Take off your shoes.' }],
    }));
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);
    mockSendMessage.mockResolvedValue({ success: true } as unknown as never);

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-web-send', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    const prefill = panelController.sendToCard.mock.calls[0]![0];
    expect(prefill.video).toBeUndefined();
    expect(prefill.initialMedia ?? []).toHaveLength(0);
    expect(prefill.cue).toBeUndefined();

    act(() => { ctrl.destroy() });
  });

  it('Send to Card from a subtitle panel cue seeks to and records that cue', async () => {
    const panelController = makePanelController();
    const mockVideo = {
      videoWidth: 1920,
      readyState: 2,
      currentTime: 50,
      play: jest.fn(),
      pause: jest.fn(),
    } as unknown as HTMLVideoElement;
    const ctrl = createWebTextDictionaryController(makeDeps({
      panelController,
      hasVideo: true,
      video: mockVideo,
      getTargetCues: () => [
        { index: 1, start: 0, end: 2000, text: 'Current cue.' },
        { index: 2, start: 10000, end: 12000, text: 'Clicked cue.' },
      ],
    }));
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);
    mockSendMessage.mockResolvedValue({ success: true, data: { url: 'https://tts.example/sentence.mp3' } } as unknown as never);

    const item = document.createElement('div');
    item.dataset.cellId = 'cue-item';
    item.dataset.cueStart = '10000';
    item.dataset.cueEnd = '12000';
    const text = document.createElement('div');
    text.dataset.allowLookup = '';
    text.textContent = 'Take off your shoes.';
    item.appendChild(text);
    document.body.appendChild(item);
    const range = document.createRange();
    range.selectNodeContents(text.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-panel-send', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    const prefill = panelController.sendToCard.mock.calls[0]![0];
    const seekCalls = jest.mocked(seekAndWaitReady).mock.calls;
    expect(seekCalls.length).toBe(1);
    expect(seekCalls[0]![0]).toBe(mockVideo);
    expect(seekCalls[0]![1]).toBe(10);
    const captureCalls = jest.mocked(captureSentenceAudio).mock.calls;
    expect(captureCalls[0]![0]).toBe(mockVideo);
    expect(captureCalls[0]![1]).toEqual({ start: 10000, end: 12000 });
    expect(prefill.video).toBe(mockVideo);
    expect(prefill.cue).toMatchObject({ start: 10000, end: 12000, targetText: 'Take off your shoes.' });
    expect((prefill.initialMedia ?? []).map((f: { kind: string }) => f.kind)).toEqual(['image', 'audio']);
    expect(prefill.sentenceAudioUrls).toEqual([]);

    act(() => { ctrl.destroy() });
  });

  it('Send to Card from a panel cue already playing skips the extra seek', async () => {
    const panelController = makePanelController();
    const mockVideo = {
      videoWidth: 1920,
      readyState: 2,
      currentTime: 11,
      play: jest.fn(),
      pause: jest.fn(),
    } as unknown as HTMLVideoElement;
    const ctrl = createWebTextDictionaryController(makeDeps({
      panelController,
      hasVideo: true,
      video: mockVideo,
      getTargetCues: () => [{ index: 2, start: 10000, end: 12000, text: 'Clicked cue.' }],
    }));
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);
    mockSendMessage.mockResolvedValue({ success: true, data: { url: 'https://tts.example/sentence.mp3' } } as unknown as never);

    const item = document.createElement('div');
    item.dataset.cellId = 'cue-item';
    item.dataset.cueStart = '10000';
    item.dataset.cueEnd = '12000';
    const text = document.createElement('div');
    text.dataset.allowLookup = '';
    text.textContent = 'Take off your shoes.';
    item.appendChild(text);
    document.body.appendChild(item);
    const range = document.createRange();
    range.selectNodeContents(text.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-panel-current', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    expect(jest.mocked(seekAndWaitReady).mock.calls.length).toBe(0);
    const captureCalls = jest.mocked(captureSentenceAudio).mock.calls;
    expect(captureCalls[0]![0]).toBe(mockVideo);
    expect(captureCalls[0]![1]).toEqual({ start: 10000, end: 12000 });

    act(() => { ctrl.destroy() });
  });

  it('Send to Card falls back to TTS when the panel cue seek cannot land', async () => {
    const panelController = makePanelController();
    const mockVideo = {
      videoWidth: 1920,
      readyState: 2,
      currentTime: 50,
      play: jest.fn(),
      pause: jest.fn(),
    } as unknown as HTMLVideoElement;
    jest.mocked(seekAndWaitReady).mockResolvedValue(false);
    const ctrl = createWebTextDictionaryController(makeDeps({
      panelController,
      hasVideo: true,
      video: mockVideo,
      getTargetCues: () => [{ index: 2, start: 10000, end: 12000, text: 'Clicked cue.' }],
    }));
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);
    mockSendMessage.mockResolvedValue({ success: true, data: { url: 'https://tts.example/sentence.mp3' } } as unknown as never);

    const item = document.createElement('div');
    item.dataset.cellId = 'cue-item';
    item.dataset.cueStart = '10000';
    item.dataset.cueEnd = '12000';
    const text = document.createElement('div');
    text.dataset.allowLookup = '';
    text.textContent = 'Take off your shoes.';
    item.appendChild(text);
    document.body.appendChild(item);
    const range = document.createRange();
    range.selectNodeContents(text.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-panel-seekfail', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    await waitFor(() => expect(panelController.sendToCard).toHaveBeenCalledTimes(1));
    const prefill = panelController.sendToCard.mock.calls[0]![0];
    expect(jest.mocked(captureSentenceAudio).mock.calls.length).toBe(0);
    expect(prefill.initialMedia ?? []).toHaveLength(0);
    expect(prefill.cue).toBeUndefined();
    expect(prefill.sentenceAudioUrls).toEqual(['https://tts.example/sentence.mp3']);

    act(() => { ctrl.destroy() });
  });

  it('Send to Card falls back to standalone dialog and hides popup when panelController is absent', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-fallback', new DOMRect(0, 0, 0, 0), range) });
    await new Promise((r) => setTimeout(r, 0));

    const popupHost = document.querySelector('.js-cell-popup-host')!;
    const sendBtn = await waitFor(() => {
      const el = popupHost.shadowRoot!.querySelector('[data-cell-id="dictionary-send-to-card"]') as HTMLButtonElement | null;
      if (!el) throw new Error('send to card button not found');
      return el;
    });
    await act(async () => { sendBtn.click(); });

    // Popup should hide after the async React send-to-card flow completes.
    await waitFor(() => expect(popupHost.shadowRoot?.querySelector('[data-cell-id="popup-dictionary"]')).toBeNull());

    act(() => { ctrl.destroy() });
  });

  it('pauses video on lookup and resumes on dismiss', async () => {
    jest.useFakeTimers();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    let paused = false;
    const mockVideo = {
      get paused() { return paused; },
      pause: jest.fn(() => { paused = true; }),
      play: jest.fn(() => { paused = false; }),
    } as unknown as HTMLVideoElement;

    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.configureVideo({ hasVideo: true, video: mockVideo, getTargetCues: () => [] });

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-video', new DOMRect(0, 0, 0, 0), range) });
    await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    });

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);

    act(() => { ctrl.dismissLookup() });
    act(() => { jest.advanceTimersByTime(500) });

    expect(mockVideo.play).toHaveBeenCalledTimes(1);

    act(() => { ctrl.destroy() });
    jest.useRealTimers();
  });

  it('pauses video as soon as the popup shell mounts, before lookup data arrives', async () => {
    let resolveLookup: ((value: unknown) => void) | undefined;
    mockSendMessage.mockReturnValueOnce(new Promise((resolve) => { resolveLookup = resolve; }) as never);

    let paused = false;
    const mockVideo = {
      get paused() { return paused; },
      pause: jest.fn(() => { paused = true; }),
      play: jest.fn(() => { paused = false; }),
    } as unknown as HTMLVideoElement;

    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.configureVideo({ hasVideo: true, video: mockVideo, getTargetCues: () => [] });

    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    act(() => { ctrl.handleLookup(makeRequest(), 'req-video-early', new DOMRect(0, 0, 0, 0), range) });

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLookup!({ success: true, data: [makeResult()] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);

    act(() => { ctrl.destroy() });
  });

  it('keeps the popup open and reuses it when the user clicks another subtitle token', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult({ term: 'over' })] } as unknown as never);

    let paused = false;
    const mockVideo = {
      get paused() { return paused; },
      pause: jest.fn(() => { paused = true; }),
      play: jest.fn(() => { paused = false; }),
    } as unknown as HTMLVideoElement;

    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.configureVideo({ hasVideo: true, video: mockVideo, getTargetCues: () => [] });

    const token1 = document.createElement('span');
    token1.className = 'js-cell-token';
    token1.dataset.cellTerm = 'over';
    token1.dataset.cellStart = '0';
    token1.dataset.cellEnd = '4';
    token1.dataset.cellBlockId = 'b1';
    token1.textContent = 'over';
    document.body.appendChild(token1);

    const token2 = document.createElement('span');
    token2.className = 'js-cell-token';
    token2.dataset.cellTerm = 'all';
    token2.dataset.cellStart = '5';
    token2.dataset.cellEnd = '8';
    token2.dataset.cellBlockId = 'b1';
    token2.textContent = 'all';
    document.body.appendChild(token2);

    act(() => { ctrl.handleLookup(makeRequest({ term: 'over' }), 'req-over', token1.getBoundingClientRect(), token1) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);
    const popup = document.querySelector('.js-cell-popup-host');
    expect(popup).not.toBeNull();

    // Pointerdown on another token should not close the popup.
    act(() => { token2.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true })); });
    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
    expect(mockVideo.play).not.toHaveBeenCalled();

    // The new lookup reuses the same popup host and re-anchors it.
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult({ term: 'all' })] } as unknown as never);
    act(() => { ctrl.handleLookup(makeRequest({ term: 'all' }), 'req-all', token2.getBoundingClientRect(), token2) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
    expect(mockVideo.pause).toHaveBeenCalledTimes(1);
    expect(mockVideo.play).not.toHaveBeenCalled();

    // A true outside click still dismisses and resumes once.
    act(() => { document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true })); });
    expect(document.querySelector('.js-cell-popup-host')).toBeNull();
    expect(mockVideo.play).toHaveBeenCalledTimes(1);

    token1.remove();
    token2.remove();
    act(() => { ctrl.destroy() });
  });

  it('keeps the popup open when the user clicks an OCR hitbox', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult({ term: 'over' })] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());

    const token1 = document.createElement('span');
    token1.className = 'js-cell-token';
    token1.dataset.cellTerm = 'over';
    token1.dataset.cellStart = '0';
    token1.dataset.cellEnd = '4';
    token1.dataset.cellBlockId = 'b1';
    token1.textContent = 'over';
    document.body.appendChild(token1);

    const hitbox = document.createElement('span');
    hitbox.className = 'cell-ocr-hitbox';
    hitbox.dataset.cellTerm = 'all';
    hitbox.textContent = 'all';
    document.body.appendChild(hitbox);

    act(() => { ctrl.handleLookup(makeRequest({ term: 'over' }), 'req-over', token1.getBoundingClientRect(), token1) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();

    act(() => { hitbox.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true })); });
    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();

    token1.remove();
    hitbox.remove();
    act(() => { ctrl.destroy() });
  });

  it('keeps the popup open when the user clicks a word in a non-tokenized lookup region', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult({ term: 'over' })] } as unknown as never);

    let paused = false;
    const mockVideo = {
      get paused() { return paused; },
      pause: jest.fn(() => { paused = true; }),
      play: jest.fn(() => { paused = false; }),
    } as unknown as HTMLVideoElement;

    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.configureVideo({ hasVideo: true, video: mockVideo, getTargetCues: () => [] });

    const token1 = document.createElement('span');
    token1.className = 'js-cell-token';
    token1.dataset.cellTerm = 'over';
    token1.dataset.cellStart = '0';
    token1.dataset.cellEnd = '4';
    token1.dataset.cellBlockId = 'b1';
    token1.textContent = 'over';
    document.body.appendChild(token1);

    const line = document.createElement('div');
    line.setAttribute('data-allow-lookup', 'true');
    line.textContent = 'over all the noise';
    document.body.appendChild(line);
    const lineText = line.firstChild as Text;

    const docWithCaret = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
    const originalCaret = docWithCaret.caretRangeFromPoint;
    const caretOnAll = document.createRange();
    caretOnAll.setStart(lineText, 6);
    caretOnAll.collapse(true);
    docWithCaret.caretRangeFromPoint = () => caretOnAll;

    act(() => { ctrl.handleLookup(makeRequest({ term: 'over' }), 'req-over', token1.getBoundingClientRect(), token1) });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
    expect(mockVideo.pause).toHaveBeenCalledTimes(1);

    act(() => { line.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, clientX: 30, clientY: 10 })); });
    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
    expect(mockVideo.play).not.toHaveBeenCalled();

    const caretOnWhitespace = document.createRange();
    caretOnWhitespace.setStart(lineText, 4);
    caretOnWhitespace.collapse(true);
    docWithCaret.caretRangeFromPoint = () => caretOnWhitespace;

    act(() => { line.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, clientX: 30, clientY: 10 })); });
    expect(document.querySelector('.js-cell-popup-host')).toBeNull();
    expect(mockVideo.play).toHaveBeenCalledTimes(1);

    docWithCaret.caretRangeFromPoint = originalCaret;
    token1.remove();
    line.remove();
    act(() => { ctrl.destroy() });
  });
});

describe('nested popup stack', () => {
  function makeLookupForTerms(): void {
    mockSendMessage.mockImplementation((message) => {
      const msg = message as { type?: string; payload?: { request?: { term?: string } } };
      if (msg.type === 'LOOKUP_REQUEST') {
        const term = msg.payload?.request?.term ?? 'x';
        return Promise.resolve({ success: true, data: [makeResult({ term })] } as unknown as never);
      }
      return Promise.resolve({} as unknown as never);
    });
  }

  function pageRange(text: string): Range {
    const p = document.createElement('p');
    p.textContent = text;
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);
    return range;
  }

  function rangeInPopup(host: Element, text: string): Range {
    const shadow = (host as HTMLElement).shadowRoot!;
    const span = document.createElement('span');
    span.textContent = text;
    shadow.appendChild(span);
    const range = document.createRange();
    range.selectNodeContents(span.firstChild as Text);
    return range;
  }

  function popupHosts(): HTMLElement[] {
    return Array.from(document.querySelectorAll('.js-cell-popup-host'));
  }

  async function flushLookup(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('re-uses level 1 for a second page lookup and re-anchors it', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'lock' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('lock')) });
    await flushLookup();
    expect(popupHosts()).toHaveLength(1);
    const first = popupHosts()[0]!;

    act(() => { ctrl.handleLookup(makeRequest({ term: 'clicking' }), 'r2', new DOMRect(200, 300, 60, 20), pageRange('clicking')) });
    await flushLookup();

    expect(popupHosts()).toHaveLength(1);
    expect(popupHosts()[0]).toBe(first);
    act(() => { ctrl.destroy() });
  });

  it('clicking a word inside level 1 mounts level 2 while level 1 stays', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'lock' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('lock')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;

    act(() => { ctrl.handleLookup(makeRequest({ term: 'fasten' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'fasten')) });
    await flushLookup();

    expect(popupHosts()).toHaveLength(2);
    expect(popupHosts()[0]).toBe(lv1);
    expect(document.body.contains(lv1)).toBe(true);
    act(() => { ctrl.destroy() });
  });

  it('clicking an ancestor level prunes deeper levels and reuses its child', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    const lv2 = popupHosts()[1]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'c' }), 'r3', new DOMRect(70, 80, 50, 20), rangeInPopup(lv2, 'c')) });
    await flushLookup();
    const lv3 = popupHosts()[2]!;
    expect(popupHosts()).toHaveLength(3);

    // Click a word in level 1 → level 3 pruned, level 2 reused for the result.
    act(() => { ctrl.handleLookup(makeRequest({ term: 'd' }), 'r4', new DOMRect(90, 100, 50, 20), rangeInPopup(lv1, 'd')) });
    await flushLookup();

    expect(popupHosts()).toHaveLength(2);
    expect(popupHosts()[0]).toBe(lv1);
    expect(popupHosts()[1]).toBe(lv2);
    expect(document.body.contains(lv3)).toBe(false);
    act(() => { ctrl.destroy() });
  });

  it('reuses the child level instead of stacking another popup', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    const lv2 = popupHosts()[1]!;

    act(() => { ctrl.handleLookup(makeRequest({ term: 'e' }), 'r5', new DOMRect(55, 65, 50, 20), rangeInPopup(lv1, 'e')) });
    await flushLookup();

    expect(popupHosts()).toHaveLength(2);
    expect(popupHosts()[1]).toBe(lv2);
    act(() => { ctrl.destroy() });
  });

  it('outside pointerdown dismisses the whole stack', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    expect(popupHosts()).toHaveLength(2);

    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    });

    expect(popupHosts()).toHaveLength(0);
    act(() => { ctrl.destroy() });
  });

  it('pointerdown inside an ancestor level closes deeper levels and focuses it', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    const lv2 = popupHosts()[1]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'c' }), 'r3', new DOMRect(70, 80, 50, 20), rangeInPopup(lv2, 'c')) });
    await flushLookup();
    const lv3 = popupHosts()[2]!;
    expect(popupHosts()).toHaveLength(3);

    act(() => {
      lv1.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    });

    expect(popupHosts()).toHaveLength(1);
    expect(popupHosts()[0]).toBe(lv1);
    expect(document.body.contains(lv2)).toBe(false);
    expect(document.body.contains(lv3)).toBe(false);
    const surface = lv1.shadowRoot!.querySelector('[data-cell-id="popup-dictionary"]') as HTMLElement;
    expect(lv1.shadowRoot!.activeElement).toBe(surface);
    act(() => { ctrl.destroy() });
  });

  it('pointerdown inside the top level keeps the stack intact', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    const lv2 = popupHosts()[1]!;

    act(() => {
      lv2.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    });

    expect(popupHosts()).toHaveLength(2);
    act(() => { ctrl.destroy() });
  });

  it('Escape on level 2 closes it and keeps level 1', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    const lv2 = popupHosts()[1]!;
    const surface = lv2.shadowRoot!.querySelector('[data-cell-id="popup-dictionary"]') as HTMLElement;
    expect(surface).not.toBeNull();

    await act(async () => {
      surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    });

    expect(popupHosts()).toHaveLength(1);
    expect(popupHosts()[0]).toBe(lv1);
    const lv1Surface = lv1.shadowRoot!.querySelector('[data-cell-id="popup-dictionary"]') as HTMLElement;
    expect(lv1.shadowRoot!.activeElement).toBe(lv1Surface);
    act(() => { ctrl.destroy() });
  });

  it('Escape with focus outside the popup walks the stack down level by level', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();
    const lv2 = popupHosts()[1]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'c' }), 'r3', new DOMRect(70, 80, 50, 20), rangeInPopup(lv2, 'c')) });
    await flushLookup();
    expect(popupHosts()).toHaveLength(3);

    const pressEscape = (): void => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };

    await act(async () => { pressEscape(); });
    expect(popupHosts()).toHaveLength(2);
    expect(lv2.shadowRoot!.activeElement).toBe(lv2.shadowRoot!.querySelector('[data-cell-id="popup-dictionary"]'));

    await act(async () => { pressEscape(); });
    expect(popupHosts()).toHaveLength(1);
    expect(lv1.shadowRoot!.activeElement).toBe(lv1.shadowRoot!.querySelector('[data-cell-id="popup-dictionary"]'));

    await act(async () => { pressEscape(); });
    expect(popupHosts()).toHaveLength(0);
    act(() => { ctrl.destroy() });
  });

  it('drops a stale response after the level moved on to a newer lookup', async () => {
    const resolvers = new Map<string, (v: unknown) => void>();
    mockSendMessage.mockImplementation((message) => {
      const msg = message as { type?: string; payload?: { requestId?: string; request?: { term?: string } } };
      if (msg.type === 'LOOKUP_REQUEST') {
        return new Promise((resolve) => {
          resolvers.set(msg.payload!.requestId!, resolve);
        }) as unknown as never;
      }
      return Promise.resolve({} as unknown as never);
    });

    const ctrl = createWebTextDictionaryController(makeDeps());
    act(() => { ctrl.handleLookup(makeRequest({ term: 'first' }), 'req-old', new DOMRect(10, 10, 40, 20), pageRange('first')) });
    act(() => { ctrl.handleLookup(makeRequest({ term: 'second' }), 'req-new', new DOMRect(50, 60, 40, 20), pageRange('second')) });

    // The newer request resolves first.
    await act(async () => {
      resolvers.get('req-new')?.({ success: true, data: [makeResult({ term: 'second' })] });
      await Promise.resolve();
      await Promise.resolve();
    });
    // The stale response arrives late — it must be dropped, not rendered.
    await act(async () => {
      resolvers.get('req-old')?.({ success: true, data: [makeResult({ term: 'first' })] });
      await Promise.resolve();
      await Promise.resolve();
    });

    const hosts = popupHosts();
    expect(hosts).toHaveLength(1);
    const termEl = hosts[0]!.shadowRoot!.querySelector('[data-cell-id="dictionary-term"]');
    if (termEl) expect(termEl.textContent).toBe('second');
    act(() => { ctrl.destroy() });
  });

  it('pauses video once and resumes only when the whole stack is gone', async () => {
    jest.useFakeTimers();
    makeLookupForTerms();
    let paused = false;
    const mockVideo = {
      get paused() { return paused; },
      pause: jest.fn(() => { paused = true; }),
      play: jest.fn(() => { paused = false; }),
    } as unknown as HTMLVideoElement;

    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.configureVideo({ hasVideo: true, video: mockVideo, getTargetCues: () => [] });

    act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
    await flushLookup();
    const lv1 = popupHosts()[0]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
    await flushLookup();

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);
    expect(popupHosts()).toHaveLength(2);

    // Closing level 2 alone must not resume the video.
    const surface = popupHosts()[1]!.shadowRoot!.querySelector('[data-cell-id="popup-dictionary"]') as HTMLElement;
    await act(async () => {
      surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    });
    expect(popupHosts()).toHaveLength(1);
    expect(mockVideo.play).not.toHaveBeenCalled();

    // Closing the last level resumes playback.
    act(() => { ctrl.dismissLookup() });
    act(() => { jest.advanceTimersByTime(600) });
    await flushLookup();
    expect(popupHosts()).toHaveLength(0);
    expect(mockVideo.play).toHaveBeenCalledTimes(1);
    act(() => { ctrl.destroy() });
    jest.useRealTimers();
  });

  it('stacks without a depth cap — a lookup in the deepest level mounts a new level', async () => {
    makeLookupForTerms();
    const ctrl = createWebTextDictionaryController(makeDeps());

    act(() => { ctrl.handleLookup(makeRequest({ term: 'l1' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('l1')) });
    await flushLookup();
    for (let i = 2; i <= 7; i++) {
      const parent = popupHosts()[i - 2]!;
      act(() => { ctrl.handleLookup(makeRequest({ term: `l${i}` }), `r${i}`, new DOMRect(10 + i, 10 + i, 40, 20), rangeInPopup(parent, `l${i}`)) });
      await flushLookup();
    }
    expect(popupHosts()).toHaveLength(7);

    const deepest = popupHosts()[6]!;
    act(() => { ctrl.handleLookup(makeRequest({ term: 'l8' }), 'r8', new DOMRect(90, 90, 40, 20), rangeInPopup(deepest, 'l8')) });
    await flushLookup();
    expect(popupHosts()).toHaveLength(8);
    expect(popupHosts()[6]).toBe(deepest);
    act(() => { ctrl.destroy() });
  });

  describe('popup z-index vs universal panel', () => {
    function panelRange(text: string): Range {
      const host = document.createElement('div');
      host.id = UNIVERSAL_PANEL_HOST_ID;
      const shadow = host.attachShadow({ mode: 'open' });
      const span = document.createElement('span');
      span.textContent = text;
      shadow.appendChild(span);
      document.body.appendChild(host);
      const range = document.createRange();
      range.selectNodeContents(span.firstChild as Text);
      return range;
    }

    it('keeps the popup on top when the lookup originates inside the open panel', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      panelController.isOpen.mockReturnValue(true);
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest(), 'r1', new DOMRect(10, 10, 40, 20), panelRange('word')) });
      await flushLookup();

      expect(popupHosts()).toHaveLength(1);
      expect(popupHosts()[0]!.style.zIndex).toBe('var(--z-overlay-top)');
      act(() => { ctrl.destroy() });
    });

    it('renders the popup below the panel when the lookup originates outside an open panel', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      panelController.isOpen.mockReturnValue(true);
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest(), 'r1', new DOMRect(10, 10, 40, 20), pageRange('word')) });
      await flushLookup();

      expect(popupHosts()).toHaveLength(1);
      expect(popupHosts()[0]!.style.zIndex).toBe('var(--z-overlay-settings)');
      act(() => { ctrl.destroy() });
    });

    it('keeps the popup on top when the panel is closed', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest(), 'r1', new DOMRect(10, 10, 40, 20), pageRange('word')) });
      await flushLookup();

      expect(popupHosts()).toHaveLength(1);
      expect(popupHosts()[0]!.style.zIndex).toBe('var(--z-overlay-top)');
      act(() => { ctrl.destroy() });
    });

    it('keeps a nested popup above the panel when its parent lookup came from the panel', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      panelController.isOpen.mockReturnValue(true);
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), panelRange('a')) });
      await flushLookup();
      const lv1 = popupHosts()[0]!;
      expect(lv1.style.zIndex).toBe('var(--z-overlay-top)');

      act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
      await flushLookup();

      expect(popupHosts()).toHaveLength(2);
      expect(popupHosts()[1]!.style.zIndex).toBe('var(--z-overlay-top)');
      act(() => { ctrl.destroy() });
    });

    it('drops a page popup below the panel when the panel opens after the lookup', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest(), 'r1', new DOMRect(10, 10, 40, 20), pageRange('word')) });
      await flushLookup();
      const host = popupHosts()[0]!;
      expect(host.style.zIndex).toBe('var(--z-overlay-top)');

      const openChange = (panelController.onOpenChange as jest.Mock).mock.calls[0]?.[0] as ((open: boolean) => void) | undefined;
      expect(openChange).toBeDefined();

      panelController.isOpen.mockReturnValue(true);
      act(() => { openChange?.(true); });
      expect(host.style.zIndex).toBe('var(--z-overlay-settings)');

      panelController.isOpen.mockReturnValue(false);
      act(() => { openChange?.(false); });
      expect(host.style.zIndex).toBe('var(--z-overlay-top)');
      act(() => { ctrl.destroy() });
    });

    it('keeps a panel-rooted popup chain above when the panel re-opens', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      panelController.isOpen.mockReturnValue(true);
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), panelRange('a')) });
      await flushLookup();
      const lv1 = popupHosts()[0]!;
      act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), rangeInPopup(lv1, 'b')) });
      await flushLookup();
      const lv2 = popupHosts()[1]!;

      const openChange = (panelController.onOpenChange as jest.Mock).mock.calls[0]?.[0] as ((open: boolean) => void) | undefined;
      panelController.isOpen.mockReturnValue(false);
      act(() => { openChange?.(false); });
      panelController.isOpen.mockReturnValue(true);
      act(() => { openChange?.(true); });

      expect(lv1.style.zIndex).toBe('var(--z-overlay-top)');
      expect(lv2.style.zIndex).toBe('var(--z-overlay-top)');
      act(() => { ctrl.destroy() });
    });

    it('re-resolves the z-index when the reused root level changes origin', async () => {
      makeLookupForTerms();
      const panelController = makePanelController();
      panelController.isOpen.mockReturnValue(true);
      const ctrl = createWebTextDictionaryController(makeDeps({ panelController }));

      act(() => { ctrl.handleLookup(makeRequest({ term: 'a' }), 'r1', new DOMRect(10, 10, 40, 20), pageRange('a')) });
      await flushLookup();
      const host = popupHosts()[0]!;
      expect(host.style.zIndex).toBe('var(--z-overlay-settings)');

      act(() => { ctrl.handleLookup(makeRequest({ term: 'b' }), 'r2', new DOMRect(50, 60, 50, 20), panelRange('b')) });
      await flushLookup();

      expect(popupHosts()).toHaveLength(1);
      expect(popupHosts()[0]).toBe(host);
      expect(host.style.zIndex).toBe('var(--z-overlay-top)');
      act(() => { ctrl.destroy() });
    });
  });
});
