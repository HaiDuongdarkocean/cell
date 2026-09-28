import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { StudyModesTab } from './StudyModesTab';
import { useStudyModeStore } from '../studyModeStore';
import { getActiveStudyMode, setActiveStudyMode } from '../content/studyModeController';
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
    useStudyModeStore.setState({ ...INITIAL_STUDY_MODE_STATE, isLoaded: true, advancedOpen: false });
    setActiveStudyMode(null);
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

  it('selects a different preset on click and applies it to the player', async () => {
    render(<StudyModesTab />);
    const presets = await waitFor(() => screen.getByLabelText('Preset study modes'));
    const listen = within(presets).getByText('Listen');
    fireEvent.click(listen.closest('[role="radio"]') ?? listen);
    await waitFor(() => {
      expect(useStudyModeStore.getState().activeModeId).toBe('listen');
    });
    expect(getActiveStudyMode()?.activeMode.id).toBe('listen');
  });

  it('keeps the Advanced section open across unmount and remount', async () => {
    const first = render(<StudyModesTab />);
    const toggle = await screen.findByTestId('advanced-toggle');
    fireEvent.click(toggle);
    expect(await screen.findByText('Skip when there is no dialogue')).toBeInTheDocument();
    first.unmount();
    render(<StudyModesTab />);
    expect(await screen.findByText('Skip when there is no dialogue')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-toggle')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('level chips', () => {
  const storageGet = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

  beforeAll(() => {
    global.chrome = {
      storage: {
        local: { get: storageGet as unknown as typeof chrome.storage.local.get, set: jest.fn() },
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      },
      runtime: { sendMessage: jest.fn() },
    } as unknown as typeof chrome;
    (globalThis as { __cellSendMessage?: unknown }).__cellSendMessage = jest.fn();
  });

  beforeEach(() => {
    storageGet.mockReset().mockResolvedValue({});
  });

  it('keeps level chips hidden with pauseOnUnknown OFF', async () => {
    useStudyModeStore.setState({ ...INITIAL_STUDY_MODE_STATE, isLoaded: true, advancedOpen: false });
    render(<StudyModesTab />);
    const toggle = await screen.findByTestId('advanced-toggle');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Advanced' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('group', { name: 'Unknown word frequency level' })).not.toBeInTheDocument();
  });
});
