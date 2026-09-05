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
}));
// isChildFrame is the single source of truth for the child-frame orbital-badge
// gate. Mocked so tests can toggle the frame context without touching window.top.
jest.mock('@/features/subtitle/logic/iframeContext', () => ({
  isChildFrame: jest.fn(() => false),
}));

import { createWebTextDictionaryController } from './webTextDictionaryController';
import type { WebTextDictionaryControllerDeps } from './webTextDictionaryController';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { isChildFrame } from '@/features/subtitle/logic/iframeContext';
import type { LookupResult, LookupRequest } from '@/features/dictionaryPopup/types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';

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
      examples: ['Take off your shoes.'],
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
  } as unknown as jest.Mocked<NonNullable<WebTextDictionaryControllerDeps['panelController']>>;
}

beforeEach(() => {
  mockSendMessage.mockReset().mockImplementation((message) => {
    const msg = message as { type?: string };
    if (msg.type === 'WORD_STATUS_SET') {
      return Promise.resolve({ success: true } as unknown as never);
    }
    return Promise.resolve({} as unknown as never);
  });
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
    ctrl.destroy();
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

    ctrl.handleLookup(request, 'req-1', anchorRect, range);

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_REQUEST',
      payload: { requestId: 'req-1', request },
    });

    await Promise.resolve(); // flush microtasks
    await Promise.resolve();

    const popupHost = document.querySelector('.js-cell-popup-host');
    expect(popupHost).not.toBeNull();
    ctrl.destroy();
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

    ctrl.handleLookup(makeRequest(), 'req-dismiss', new DOMRect(0, 0, 0, 0), range);
    ctrl.dismissLookup();

    // In-flight cancel is immediate.
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_CANCEL',
      payload: { requestId: 'req-dismiss' },
    });
    // Popup dismiss is delayed — not cleared yet.
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();
    // Flush the 500ms dismiss timer.
    jest.advanceTimersByTime(500);
    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();

    ctrl.destroy();
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

    ctrl.handleLookup(makeRequest({ term: 'shoes' }), 'req-1', new DOMRect(0, 0, 0, 0), range);
    // Let the first lookup's result resolve so highlight shows.
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();

    ctrl.dismissLookup(); // schedules dismiss in 500ms

    // Before the timer fires, a new lookup arrives.
    jest.advanceTimersByTime(300);
    ctrl.handleLookup(makeRequest({ term: 'shoes' }), 'req-2', new DOMRect(0, 0, 0, 0), range);
    await Promise.resolve();
    await Promise.resolve();

    // Flush past the original 500ms — dismiss should NOT have fired.
    jest.advanceTimersByTime(300);
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();

    ctrl.destroy();
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

    ctrl.handleLookup(request, 'req-stale', anchorRect, range);
    ctrl.dismissLookup();

    // Flush dismiss timer + microtasks.
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();

    // Popup host should be removed after the delayed destroy; no term should
    // render from the stale response.
    const host = document.querySelector('.js-cell-popup-host');
    if (host && host.shadowRoot) {
      const popup = host.shadowRoot.querySelector('[data-cell-id="popup-dictionary"]');
      expect(popup).toBeNull();
    }
    const termEl = host && host.shadowRoot ? host.shadowRoot.querySelector('[data-cell-id="dictionary-term"]') : null;
    expect(termEl?.textContent).not.toBe(result.term);

    ctrl.destroy();
    jest.useRealTimers();
  });

  it('handleLookup propagates popup status cycle to deps.onStatusChange', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const onStatusChange = jest.fn();
    const ctrl = createWebTextDictionaryController(makeDeps({ onStatusChange }));
    const request = makeRequest();
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    ctrl.handleLookup(request, 'req-status', new DOMRect(0, 0, 0, 0), range);
    await Promise.resolve();
    await Promise.resolve();

    // Click the status badge inside the popup to cycle unknown → tracking.
    const popupHost = document.querySelector('.js-cell-popup-host') as Element & { shadowRoot?: ShadowRoot };
    await waitFor(() => expect(popupHost).not.toBeNull());
    const shadow = popupHost.shadowRoot!;
    const statusBadge = await waitFor(() => {
      const el = shadow.querySelector('[data-cell-id="dictionary-status-cycle"]') as HTMLButtonElement | null;
      if (!el) throw new Error('status badge not found');
      return el;
    });
    statusBadge.click();

    expect(onStatusChange).toHaveBeenCalledWith('take off', 'en', 'tracking');
    ctrl.destroy();
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

    ctrl.handleLookup(request, 'req-2', new DOMRect(0, 0, 0, 0), range);

    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    ctrl.destroy();
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

    ctrl.handleLookup(request, 'req-3', new DOMRect(0, 0, 0, 0), range);

    await Promise.resolve();
    await Promise.resolve();

    const popupHost = document.querySelector('.js-cell-popup-host');
    expect(popupHost).not.toBeNull();
    ctrl.destroy();
  });

  it('cancelLookup sends LOOKUP_CANCEL', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.cancelLookup('req-4');
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'LOOKUP_CANCEL',
      payload: { requestId: 'req-4' },
    });
    ctrl.destroy();
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
    ctrl.handleLookup(request, 'req-cache-1', new DOMRect(0, 0, 0, 0), range);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(takeCalls()).toHaveLength(1);
    expect(offCalls()).toHaveLength(1);

    // Second lookup for the same term should hit the cache and not send a new request.
    ctrl.handleLookup(request, 'req-cache-2', new DOMRect(0, 0, 0, 0), range);
    await Promise.resolve();
    await Promise.resolve();

    expect(takeCalls()).toHaveLength(1);
    // Prefetch for 'off' is skipped because it is already cached.
    expect(offCalls()).toHaveLength(1);

    const popupHost = document.querySelector('.js-cell-popup-host');
    expect(popupHost).not.toBeNull();
    ctrl.destroy();
  });

  it('attach and detach create/destroy WebTriggerController without error', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    ctrl.attach('hover');
    ctrl.detach();
    ctrl.attach('click');
    ctrl.detach();
    ctrl.destroy();
  });

  it('showHighlight and clearHighlight work', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    ctrl.showHighlight(range);
    expect(document.querySelector('span.js-cell-word-highlight')).not.toBeNull();

    ctrl.clearHighlight();
    expect(document.querySelector('span.js-cell-word-highlight')).toBeNull();

    ctrl.destroy();
  });

  it('updateSettings re-attaches with new trigger mode', () => {
    const ctrl = createWebTextDictionaryController(makeDeps({ dictionaryPopupSettings: makePopupSettings({ triggerMode: 'click' }) }));
    ctrl.attach('click');
    const settings = {
      dictionaryPopup: makePopupSettings({ triggerMode: 'hover' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    };
    ctrl.updateSettings(settings);
    // No error + controller still functional.
    expect(typeof ctrl.handleLookup).toBe('function');
    ctrl.destroy();
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
    ctrl.destroy();
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
      ctrl.updateSettings({
        ...settings,
        dictionaryPopup: makePopupSettings({ enabled: true, badgePointerTrigger: { position: 'top', size: 36, pointerScale: 0.25 } }),
      });
    });

    const hosts = document.querySelectorAll('.js-cell-orbital-badge-host');
    expect(hosts.length).toBe(1);
    expect(hosts[0]).toBe(host1);
    ctrl.destroy();
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
        ctrl.updateSettings({
          dictionaryPopup: makePopupSettings({ enabled: true }),
          cardCreator: makeCardCreatorSettings(),
          subtitleOverlayNativeLanguage: 'vi',
        });
      });
      // No badge in a child frame while the top-frame badge covers the viewport.
      expect(document.querySelector('.js-cell-orbital-badge-host')).toBeNull();
      ctrl.destroy();
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
        ctrl.updateSettings({
          dictionaryPopup: makePopupSettings({ enabled: true }),
          cardCreator: makeCardCreatorSettings(),
          subtitleOverlayNativeLanguage: 'vi',
        });
      });
      const host = document.querySelector('.js-cell-orbital-badge-host');
      expect(host).not.toBeNull();
      ctrl.destroy();
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
      ctrl.updateSettings({
        dictionaryPopup: makePopupSettings({ enabled: true }),
        cardCreator: makeCardCreatorSettings(),
        subtitleOverlayNativeLanguage: 'vi',
      });
    });
    const host = document.querySelector('.js-cell-orbital-badge-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.style.display).toBe(''); // visible before fullscreen

    // Simulate child iframe entering native fullscreen.
    const fakeIframe = document.createElement('iframe');
    setFullscreenElement(fakeIframe);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(host.style.display).toBe('none'); // hidden while iframe is fullscreen

    // Simulate exiting fullscreen → badge restored.
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(host.style.display).toBe('');
    ctrl.destroy();
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
    ctrl.updateSettings(settings);

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
    document.dispatchEvent(move);

    jest.advanceTimersByTime(150);
    await Promise.resolve();
    await Promise.resolve();

    document.caretRangeFromPoint = original;

    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
    ctrl.destroy();
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
    document.dispatchEvent(click);

    await Promise.resolve();
    await Promise.resolve();

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
    ctrl.destroy();
  });

  it('updates default active tab at runtime and opens it after lookup', async () => {
    const result = makeResult();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({
      dictionaryPopupSettings: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: null }),
    }));
    ctrl.attach('click');
    ctrl.updateSettings({
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: 'image' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
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
    document.dispatchEvent(click);

    await Promise.resolve();
    await Promise.resolve();

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
    ctrl.destroy();
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

    ctrl.handleLookup(request, 'req-1', anchorRect, range);
    await Promise.resolve();
    await Promise.resolve();

    // Now switch default to None and look up again.
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [result] } as unknown as never);
    ctrl.updateSettings({
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'click', defaultActiveTab: null }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
    });

    ctrl.handleLookup(request, 'req-2', anchorRect, range);
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('.js-cell-popup-host') as HTMLElement | null;
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow?.querySelector('[data-cell-id^="dictionary-tab-"][aria-selected="true"]')).toBeNull();
    expect(shadow?.querySelector('[data-cell-id="dictionary-image-panel"]')).toBeNull();
    ctrl.destroy();
  });

  it('switches to hover mode and triggers lookup on mousemove', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps({
      dictionaryPopupSettings: makePopupSettings({ enabled: true, triggerMode: 'click' }),
    }));

    // Switch to hover mode.
    ctrl.updateSettings({
      dictionaryPopup: makePopupSettings({ enabled: true, triggerMode: 'hover' }),
      cardCreator: makeCardCreatorSettings(),
      subtitleOverlayNativeLanguage: 'vi',
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
    document.dispatchEvent(move);

    // Wait for hover debounce (16–50 ms) plus microtask flush.
    await new Promise((r) => setTimeout(r, 100));
    await Promise.resolve();
    await Promise.resolve();

    document.caretRangeFromPoint = original;

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'LOOKUP_REQUEST' }));
    ctrl.destroy();
  });

  it('destroy removes popup and highlight artifacts', () => {
    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);
    ctrl.showHighlight(range);

    ctrl.destroy();

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

    ctrl.handleLookup(makeRequest(), 'req-send', new DOMRect(0, 0, 0, 0), range);
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

    // Popup should remain visible.
    const popupEl = popupHost.shadowRoot?.querySelector('[data-cell-id="popup-dictionary"]') as HTMLDivElement;
    expect(popupEl).not.toBeNull();

    ctrl.destroy();
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
    mockSendMessage.mockResolvedValue({ success: true } as unknown as never);

    const line = document.createElement('div');
    line.className = 'subtitle-line';
    const token = document.createElement('span');
    token.className = 'js-cell-token';
    token.textContent = 'Take off your shoes.';
    line.appendChild(token);
    document.body.appendChild(line);
    const range = document.createRange();
    range.selectNodeContents(token.firstChild as Text);

    ctrl.handleLookup(makeRequest(), 'req-video-send', new DOMRect(0, 0, 0, 0), range);
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

    ctrl.destroy();
  });

  it('Send to Card falls back to standalone dialog and hides popup when panelController is absent', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult()] } as unknown as never);

    const ctrl = createWebTextDictionaryController(makeDeps());
    const p = document.createElement('p');
    p.textContent = 'Take off your shoes.';
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p.firstChild as Text);

    ctrl.handleLookup(makeRequest(), 'req-fallback', new DOMRect(0, 0, 0, 0), range);
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

    ctrl.destroy();
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

    ctrl.handleLookup(makeRequest(), 'req-video', new DOMRect(0, 0, 0, 0), range);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);

    ctrl.dismissLookup();
    jest.advanceTimersByTime(500);

    expect(mockVideo.play).toHaveBeenCalledTimes(1);

    ctrl.destroy();
    jest.useRealTimers();
  });
});
