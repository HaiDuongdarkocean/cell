import { renderHook, waitFor } from '@testing-library/react';
import { useSubtitleActions } from './useSubtitleActions';
import { loadSettings } from '@/shared/lib/storage/settingsStore';

const handleLookupMock = jest.fn();
const updateSettingsMock = jest.fn();
const destroyMock = jest.fn();

jest.mock('@/features/dictionaryPopup/controller/webTextDictionaryController', () => ({
  createWebTextDictionaryController: jest.fn(() => ({
    handleLookup: handleLookupMock,
    updateSettings: updateSettingsMock,
    destroy: destroyMock,
  })),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
}));

jest.mock('@/features/cardCreator/service/cardCreatorActionPorts', () => ({
  createCardCreatorActionPorts: jest.fn(() => ({})),
}));

jest.mock('@/features/subtitle/actions/cardActions', () => ({
  handleCardCreatorAction: jest.fn(),
}));

jest.mock('@/features/subtitle/actions/generateNativeAction', () => ({
  startGenerateNative: jest.fn(async () => false),
}));

const loadSettingsMock = loadSettings as jest.MockedFunction<typeof loadSettings>;

function renderActions() {
  const videoRef = { current: document.createElement('video') };
  return renderHook(() => useSubtitleActions({ videoRef, offsetMs: 0 }));
}

beforeEach(() => {
  handleLookupMock.mockClear();
  updateSettingsMock.mockClear();
  destroyMock.mockClear();
  loadSettingsMock.mockReset().mockResolvedValue({
    subtitleOverlayTargetLanguage: 'en',
    subtitleOverlayNativeLanguage: 'vi',
  } as never);
});

describe('useSubtitleActions cueListTokenize', () => {
  it('exposes a tokenize adapter with the configured target language', async () => {
    const { result } = renderActions();
    await waitFor(() => expect(result.current.cueListTokenize).not.toBeNull());
    expect(result.current.cueListTokenize?.langCode).toBe('en');
  });

  it('routes token clicks through the dictionary controller lookup', async () => {
    const { result } = renderActions();
    await waitFor(() => expect(result.current.cueListTokenize).not.toBeNull());

    const element = document.createElement('span');
    element.setAttribute('data-cell-start', '5');
    element.setAttribute('data-cue-start', '1000');
    element.setAttribute('data-cue-end', '2000');
    const rect = { x: 1, y: 2, width: 3, height: 4, top: 2, left: 1, right: 4, bottom: 6, toJSON: () => ({}) } as DOMRect;
    element.getBoundingClientRect = jest.fn(() => rect);

    result.current.cueListTokenize?.onTokenClick('rare', element, 'a rare word');

    expect(handleLookupMock).toHaveBeenCalledTimes(1);
    const [request, requestId, anchorRect, highlightTarget] = handleLookupMock.mock.calls[0];
    expect(request).toEqual({
      term: 'rare',
      langCode: 'en',
      contextSentence: 'a rare word',
      cursorOffset: 5,
    });
    expect(typeof requestId).toBe('string');
    expect(anchorRect).toBe(rect);
    expect(highlightTarget).toBe(element);
  });

  it('falls back to cursorOffset 0 when the element lacks data-cell-start', async () => {
    const { result } = renderActions();
    await waitFor(() => expect(result.current.cueListTokenize).not.toBeNull());

    const element = document.createElement('span');
    result.current.cueListTokenize?.onTokenClick('w', element, 'w here');
    expect(handleLookupMock.mock.calls[0][0].cursorOffset).toBe(0);
  });

  it('stays null when no target language is configured', async () => {
    loadSettingsMock.mockResolvedValue({
      subtitleOverlayTargetLanguage: undefined,
      subtitleOverlayNativeLanguage: 'vi',
    } as never);
    const { result } = renderActions();
    await waitFor(() => expect(updateSettingsMock).toHaveBeenCalled());
    expect(result.current.cueListTokenize).toBeNull();
  });

  it('clears the adapter on unmount', async () => {
    const { result, unmount } = renderActions();
    await waitFor(() => expect(result.current.cueListTokenize).not.toBeNull());
    unmount();
    expect(destroyMock).toHaveBeenCalled();
  });
});
