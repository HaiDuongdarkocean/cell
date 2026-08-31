import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { StudyModesTab } from './StudyModesTab';
import { useStudyModeStore } from '../studyModeStore';
import { INITIAL_STUDY_MODE_STATE } from '../lib/migrateStudyModeState';

describe('StudyModesTab', () => {
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
    useStudyModeStore.setState({ ...INITIAL_STUDY_MODE_STATE, isLoaded: true });
  });

  afterAll(() => {
    delete (global as { chrome?: unknown }).chrome;
    delete (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage;
  });

  it('renders preset cards and custom modes section', async () => {
    render(<StudyModesTab />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Play mode' })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Custom' })).toBeInTheDocument();
    const presets = screen.getByLabelText('Preset study modes');
    expect(within(presets).getByText('Normal')).toBeInTheDocument();
    expect(within(presets).getByText('Listen')).toBeInTheDocument();
  });

  it('selects a different preset on click', async () => {
    render(<StudyModesTab />);
    const presets = await waitFor(() => screen.getByLabelText('Preset study modes'));
    const listen = within(presets).getByText('Listen');
    fireEvent.click(listen.closest('[role="radio"]') ?? listen);
    await waitFor(() => {
      expect(useStudyModeStore.getState().activeModeId).toBe('listen');
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'APPLY_STUDY_MODE' }),
    );
  });
});
