import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { createPopupLifecycle, type PopupLifecycleDeps } from './popupLifecycle';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { markLookup, measureLookup, clearLookupMarks } from '@/shared/lib/perfMarks';
import type { LookupRequest, LookupResult } from '@/entities/dictionary';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';

jest.mock('@/shared/lib/chrome-apis', () => ({ sendMessage: jest.fn() }));
jest.mock('@/shared/lib/perfMarks', () => ({
  markLookup: jest.fn(),
  measureLookup: jest.fn(),
  clearLookupMarks: jest.fn(),
  markAudio: jest.fn(),
  measureAudio: jest.fn(),
  clearAudioMarks: jest.fn(),
}));
jest.mock('../ui/mountPopupDictionary', () => ({
  mountPopupDictionary: jest.fn(() => ({
    host: { style: {} },
    setAnchor: jest.fn(),
    setLoading: jest.fn(),
    setOptions: jest.fn(),
    setResult: jest.fn(),
    setStatus: jest.fn(),
    destroy: jest.fn(),
    focus: jest.fn(),
  })),
}));
jest.mock('@/features/dictionaryPopup/ui/wordHighlight', () => ({
  createWordHighlight: jest.fn(() => ({ show: jest.fn(), clear: jest.fn(), destroy: jest.fn() })),
}));
jest.mock('@/features/dictionary', () => ({
  emitWordStatusChanged: jest.fn(),
  setWordStatus: jest.fn(),
}));
jest.mock('./lookupTargetDom', () => ({
  applyTokenStatus: jest.fn(),
  clearPopupTokenId: jest.fn(),
  computeLineRect: jest.fn(() => null),
  getTokenById: jest.fn(() => null),
  getTokenElement: jest.fn(() => null),
  isInsideStackHostEvent: jest.fn(() => false),
  isLookupFromUniversalPanel: jest.fn(() => false),
  isReanchorPointerDown: jest.fn(() => false),
  levelIndexForTarget: jest.fn(() => -1),
  setPopupTokenId: jest.fn(),
  POPUP_OPEN_CLASS: 'Tihoka-popup-open',
}));
jest.mock('./phraseHighlight', () => ({
  computeTextOffset: jest.fn(() => 0),
  expandHighlightForTerm: jest.fn(),
}));
jest.mock('./lookupCache', () => ({ prefetchAdjacentTerms: jest.fn() }));
jest.mock('./panelBridge', () => ({ openSettingsSection: jest.fn() }));

const mockSendMessage = jest.mocked(sendMessage);
const mockMarkLookup = jest.mocked(markLookup);
const mockMeasureLookup = jest.mocked(measureLookup);
const mockClearLookupMarks = jest.mocked(clearLookupMarks);

function makeRequest(term: string): LookupRequest {
  return {
    term,
    langCode: 'en',
    contextSentence: '',
    cursorOffset: 0,
    trigger: 'click',
  } as LookupRequest;
}

function makeResult(term: string): LookupResult {
  return {
    term,
    langCode: 'en',
    reading: '',
    readingKind: 'none',
    frequencies: [],
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [{ id: 'd1', text: 'gloss', examples: [], source: 'e2e', defaultSelected: false }],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
  } as LookupResult;
}

function makeDeps(): PopupLifecycleDeps {
  return {
    getDpSettings: () => DEFAULT_DICTIONARY_POPUP_SETTINGS,
    setDpSettings: jest.fn(),
    getNativeLang: () => 'vi',
    lookupCache: { get: jest.fn(() => undefined), set: jest.fn(), invalidate: jest.fn() } as never,
    pauseVideo: jest.fn(),
    resumeVideo: jest.fn(),
    resetVideoPlaying: jest.fn(),
    sendLookupCancel: jest.fn(),
    onCardCreatorAction: jest.fn(() => ({ handled: false })) as never,
    onQuickAdd: jest.fn(),
  };
}

const anchorRect = { top: 10, left: 10, right: 50, bottom: 20 } as DOMRect;
const target = {} as never;

function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    const cb = (globalThis.requestAnimationFrame ?? ((f: () => void) => setTimeout(f, 0)));
    cb(() => resolve());
  });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await flushRaf();
}

describe('lookup perf marks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, data: [makeResult('hello')] } as never);
  });

  it('marks dispatch → response → render in order', async () => {
    const lifecycle = createPopupLifecycle(makeDeps());
    lifecycle.handleLookup(makeRequest('hello'), 'r1', anchorRect, target);
    expect(mockMarkLookup).toHaveBeenNthCalledWith(1, 'dispatch', 'r1');
    await settle();
    expect(mockMarkLookup).toHaveBeenNthCalledWith(2, 'response', 'r1');
    expect(mockMarkLookup).toHaveBeenNthCalledWith(3, 'render', 'r1');
    expect(mockMeasureLookup).toHaveBeenCalledWith('dispatch', 'response', 'r1');
    expect(mockMeasureLookup).toHaveBeenCalledWith('dispatch', 'render', 'r1');
    expect(mockClearLookupMarks).toHaveBeenCalledWith('r1');
    lifecycle.dispose();
  });

  it('does not measure stale responses after a newer lookup takes the level', async () => {
    let resolveFirst!: (v: unknown) => void;
    mockSendMessage
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r as (v: unknown) => void; }) as never)
      .mockResolvedValueOnce({ success: true, data: [makeResult('world')] } as never);
    const lifecycle = createPopupLifecycle(makeDeps());
    lifecycle.handleLookup(makeRequest('hello'), 'r1', anchorRect, target);
    lifecycle.handleLookup(makeRequest('world'), 'r2', anchorRect, target);
    resolveFirst({ success: true, data: [makeResult('hello')] });
    await settle();
    expect(mockMarkLookup).toHaveBeenCalledWith('dispatch', 'r1');
    expect(mockMarkLookup).not.toHaveBeenCalledWith('response', 'r1');
    expect(mockMeasureLookup).not.toHaveBeenCalledWith('dispatch', 'response', 'r1');
    expect(mockMarkLookup).toHaveBeenCalledWith('response', 'r2');
    lifecycle.dispose();
  });

  it('skips marks on the cache-hit fast path', async () => {
    const deps = makeDeps();
    (deps.lookupCache.get as ReturnType<typeof jest.fn>).mockReturnValue([makeResult('hello')]);
    const lifecycle = createPopupLifecycle(deps);
    lifecycle.handleLookup(makeRequest('hello'), 'r9', anchorRect, target);
    await settle();
    expect(mockMarkLookup).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
    lifecycle.dispose();
  });
});
