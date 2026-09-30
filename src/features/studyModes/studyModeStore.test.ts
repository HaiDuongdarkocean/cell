import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { useStudyModeStore, loadStudyModeState } from './studyModeStore';
import { getActiveStudyMode, setActiveStudyMode } from './content/studyModeController';
import { STORAGE_KEYS } from '@/shared/config/config';
import { findActiveMode } from './lib/findActiveMode';

describe('studyModeStore', () => {
  const storageGet = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
  const storageSet = jest.fn<Promise<void>, [Record<string, unknown>]>();
  const sendMessage = jest.fn<Promise<unknown>, [unknown]>();

  beforeAll(() => {
    global.chrome = {
      storage: {
        local: {
          get: storageGet as unknown as typeof chrome.storage.local.get,
          set: storageSet as unknown as typeof chrome.storage.local.set,
        },
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      },
      runtime: { sendMessage: jest.fn() },
    } as unknown as typeof chrome;
    (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage = sendMessage;
  });

  beforeEach(() => {
    storageGet.mockReset().mockResolvedValue({});
    storageSet.mockReset().mockResolvedValue(undefined);
    sendMessage.mockReset().mockResolvedValue(undefined);
    useStudyModeStore.setState({
      version: 1,
      activeModeId: 'normal',
      customModes: [],
      advanced: { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
      isLoaded: true,
      advancedOpen: false,
    });
    setActiveStudyMode(null);
  });

  afterAll(() => {
    delete (global as { chrome?: unknown }).chrome;
    delete (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage;
  });

  it('findActiveMode returns preset by id', () => {
    const state = useStudyModeStore.getState();
    expect(findActiveMode(state).id).toBe('normal');
  });

  it('setActiveModeId changes active mode and applies it to the player in-context', () => {
    useStudyModeStore.getState().setActiveModeId('listen');
    expect(useStudyModeStore.getState().activeModeId).toBe('listen');
    expect(storageSet).toHaveBeenCalled();
    expect(getActiveStudyMode()?.activeMode.id).toBe('listen');
  });

  it('creates a custom mode and activates it', () => {
    const mode = useStudyModeStore.getState().createCustomMode('Shadowing', [
      { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    ]);
    expect(mode).not.toBeNull();
    expect(useStudyModeStore.getState().activeModeId).toBe(mode!.id);
    expect(useStudyModeStore.getState().customModes).toHaveLength(1);
    expect(storageSet).toHaveBeenCalled();
  });

  it('rejects duplicate custom mode name', () => {
    useStudyModeStore.getState().createCustomMode('Shadowing', [
      { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    ]);
    const second = useStudyModeStore.getState().createCustomMode('Shadowing', [
      { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    ]);
    expect(second).toBeNull();
  });

  it('deletes a custom mode and falls back to normal', () => {
    const mode = useStudyModeStore.getState().createCustomMode('Shadowing', [
      { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    ]);
    useStudyModeStore.getState().deleteCustomMode(mode!.id);
    expect(useStudyModeStore.getState().customModes).toHaveLength(0);
    expect(useStudyModeStore.getState().activeModeId).toBe('normal');
  });

  it('loads persisted state and applies migration', async () => {
    storageGet.mockResolvedValue({
      [STORAGE_KEYS.STUDY_MODES]: {
        version: 1,
        activeModeId: 'listen',
        customModes: [],
        advanced: { skipNoDialogue: 'JUMP', removeBracketed: true, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
      },
    });
    await loadStudyModeState();
    expect(useStudyModeStore.getState().activeModeId).toBe('listen');
    expect(useStudyModeStore.getState().advanced.skipNoDialogue).toBe('JUMP');
  });

  it('falls back to normal when active mode no longer exists', async () => {
    storageGet.mockResolvedValue({
      [STORAGE_KEYS.STUDY_MODES]: {
        version: 1,
        activeModeId: 'custom-999',
        customModes: [],
        advanced: { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true },
      },
    });
    await loadStudyModeState();
    expect(useStudyModeStore.getState().activeModeId).toBe('normal');
  });

  it('persists advancedOpen toggle and restores it on reload', async () => {
    useStudyModeStore.getState().setAdvancedOpen(true);
    expect(storageSet).toHaveBeenCalledWith({ [STORAGE_KEYS.STUDY_MODES_ADVANCED_OPEN]: true });

    useStudyModeStore.setState({ advancedOpen: false });
    storageGet.mockResolvedValue({ [STORAGE_KEYS.STUDY_MODES_ADVANCED_OPEN]: true });
    await loadStudyModeState();
    expect(useStudyModeStore.getState().advancedOpen).toBe(true);
  });

  it('registers the storage sync listener at most once across reloads', async () => {
    const addListener = chrome.storage.onChanged.addListener as jest.Mock;
    const before = addListener.mock.calls.length;
    await loadStudyModeState();
    await loadStudyModeState();
    expect(addListener.mock.calls.length - before).toBeLessThanOrEqual(1);
  });
});
