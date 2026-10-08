import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dictionary } from './Dictionary';
import { createPopupLifecycle, type PopupLifecycleDeps } from '../controller/popupLifecycle';
import { mountPopupDictionary, type PopupDictionaryMountController } from './mountPopupDictionary';
import { levelIndexForTarget } from '../controller/lookupTargetDom';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { LookupRequest, LookupResult } from '@/entities/dictionary';

jest.mock('./usePopupPosition', () => ({
  usePopupPosition: jest.fn(() => ({
    style: {},
    isSheet: false,
    popupRef: { current: null },
    onPointerDownHeader: jest.fn(),
    onPointerDownResize: jest.fn(),
    onPointerDownSheet: jest.fn(),
    onPointerDownContent: jest.fn(),
  })),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  ...jest.requireActual<typeof import('@/shared/lib/chrome-apis')>('@/shared/lib/chrome-apis'),
  sendMessage: jest.fn(),
}));
jest.mock('@/shared/lib/perfMarks', () => ({
  markLookup: jest.fn(),
  measureLookup: jest.fn(),
  clearLookupMarks: jest.fn(),
  markAudio: jest.fn(),
  measureAudio: jest.fn(),
  clearAudioMarks: jest.fn(),
}));
jest.mock('./mountPopupDictionary', () => ({ mountPopupDictionary: jest.fn() }));
jest.mock('./wordHighlight', () => ({
  createWordHighlight: jest.fn(() => ({ show: jest.fn(), clear: jest.fn(), destroy: jest.fn() })),
}));
jest.mock('@/features/dictionary', () => ({
  emitWordStatusChanged: jest.fn(),
  setWordStatus: jest.fn(),
}));
jest.mock('../controller/lookupTargetDom', () => ({
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
  POPUP_OPEN_CLASS: 'cell-popup-open',
}));
jest.mock('../controller/phraseHighlight', () => ({
  computeTextOffset: jest.fn(() => 0),
  expandHighlightForTerm: jest.fn(),
}));
jest.mock('../controller/lookupCache', () => ({ prefetchAdjacentTerms: jest.fn() }));
jest.mock('../controller/panelBridge', () => ({ openSettingsSection: jest.fn() }));

jest.mock('./DictionaryPanelView', () => ({
  DictionaryPanelView: function DictionaryPanelViewMock(props: Record<string, unknown>) {
    return (
      <div
        data-cell-id="dictionary-panel"
        data-mock-is-open={String(props.isOpen)}
        data-mock-lang={props.langCode as string}
      >
        {props.initialTerm ? <span data-cell-id="dictionary-mock-initial">{props.initialTerm as string}</span> : null}
      </div>
    );
  },
}));

const defaultAnchor = { top: 70, left: 100, right: 150, bottom: 100 };

describe('Dictionary', () => {
  it('renders the popup variant with chrome and panel', () => {
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('popup-dictionary')).toBeInTheDocument();
    expect(screen.queryByTestId('popup-dictionary-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('popup-dictionary-content')).toBeInTheDocument();
    expect(screen.getByTestId('popup-dictionary-resize')).toBeInTheDocument();
    // Sheet handle only renders in sheet mode (via shared Sheet atom); in
    // popup mode (isSheet=false from the mock) it is absent.
    expect(screen.queryByTestId('popup-dictionary-sheet-handle')).not.toBeInTheDocument();

    const panel = screen.getByTestId('dictionary-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-mock-is-open', 'true');
    expect(panel).toHaveAttribute('data-mock-lang', 'en');
  });

  it('passes the search term to the popup panel', () => {
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        initialTerm="hello"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('dictionary-mock-initial')).toHaveTextContent('hello');
  });

  it('renders the integrated variant without popup chrome', () => {
    render(
      <Dictionary
        variant="integrated"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    expect(screen.queryByTestId('popup-dictionary-header')).not.toBeInTheDocument();

    const panel = screen.getByTestId('dictionary-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-mock-is-open', 'true');
    expect(panel).toHaveAttribute('data-mock-lang', 'en');
    expect(screen.getByTestId('dictionary-mock-initial')).toHaveTextContent('hello');
  });

  it('passes isOpen to the integrated panel', () => {
    render(
      <Dictionary
        variant="integrated"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        isOpen={false}
      />,
    );

    expect(screen.getByTestId('dictionary-panel')).toHaveAttribute('data-mock-is-open', 'false');
  });

  it('does not close when non-Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <Dictionary
        variant="popup"
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        anchor={defaultAnchor}
        onClose={onClose}
      />,
    );
    const popup = screen.getByTestId('popup-dictionary');
    fireEvent.keyDown(popup, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

const mockSendMessage = jest.mocked(sendMessage);
const mockMountPopupDictionary = jest.mocked(mountPopupDictionary);
const mockLevelIndexForTarget = jest.mocked(levelIndexForTarget);

const lifecycleAnchorRect = { top: 10, left: 10, right: 50, bottom: 20 } as DOMRect;
const lifecycleTarget = {} as never;

function makeLifecycleRequest(term: string): LookupRequest {
  return {
    term,
    langCode: 'en',
    contextSentence: '',
    cursorOffset: 0,
    trigger: 'click',
  } as LookupRequest;
}

function makeLifecycleResult(term: string): LookupResult {
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

function makeLifecycleMount(host: HTMLElement): PopupDictionaryMountController {
  return {
    host,
    setAnchor: jest.fn(),
    setLoading: jest.fn(),
    setOptions: jest.fn(),
    setResult: jest.fn(),
    setStatus: jest.fn(),
    destroy: jest.fn(),
    focus: jest.fn(),
  } as unknown as PopupDictionaryMountController;
}

function makeLifecycleDeps(): PopupLifecycleDeps {
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

describe('popup lifecycle Escape layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, data: [makeLifecycleResult('hello')] } as never);
  });

  it('pops the top level on Escape with focus outside every popup host', () => {
    mockMountPopupDictionary.mockReturnValue(
      makeLifecycleMount(document.createElement('div')),
    );
    mockLevelIndexForTarget.mockReturnValueOnce(-1).mockReturnValueOnce(0);
    const lifecycle = createPopupLifecycle(makeLifecycleDeps());
    lifecycle.handleLookup(makeLifecycleRequest('hello'), 'r1', lifecycleAnchorRect, lifecycleTarget);
    lifecycle.handleLookup(makeLifecycleRequest('world'), 'r2', lifecycleAnchorRect, lifecycleTarget);
    expect(lifecycle.hasOpenPopup()).toBe(true);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(lifecycle.hasOpenPopup()).toBe(true);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(lifecycle.hasOpenPopup()).toBe(false);
    lifecycle.dispose();
  });

  it('pops the level owning the event composedPath', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    mockMountPopupDictionary.mockReturnValue(makeLifecycleMount(host));
    const lifecycle = createPopupLifecycle(makeLifecycleDeps());
    lifecycle.handleLookup(makeLifecycleRequest('hello'), 'r1', lifecycleAnchorRect, lifecycleTarget);
    expect(lifecycle.hasOpenPopup()).toBe(true);

    const inner = document.createElement('button');
    host.appendChild(inner);
    fireEvent.keyDown(inner, { key: 'Escape' });
    expect(lifecycle.hasOpenPopup()).toBe(false);
    host.remove();
    lifecycle.dispose();
  });

  it('ignores non-Escape keys', () => {
    mockMountPopupDictionary.mockReturnValue(
      makeLifecycleMount(document.createElement('div')),
    );
    const lifecycle = createPopupLifecycle(makeLifecycleDeps());
    lifecycle.handleLookup(makeLifecycleRequest('hello'), 'r1', lifecycleAnchorRect, lifecycleTarget);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(lifecycle.hasOpenPopup()).toBe(true);
    lifecycle.dispose();
  });
});
