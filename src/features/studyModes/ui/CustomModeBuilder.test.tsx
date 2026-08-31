import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomModeBuilder } from './CustomModeBuilder';
import { useStudyModeStore } from '../studyModeStore';
import { INITIAL_STUDY_MODE_STATE } from '../lib/migrateStudyModeState';

describe('CustomModeBuilder', () => {
  const storageGet = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
  const storageSet = jest.fn<Promise<void>, [Record<string, unknown>]>();
  const onOpenChange = jest.fn();

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
  });

  beforeEach(() => {
    storageGet.mockReset().mockResolvedValue({});
    storageSet.mockReset().mockResolvedValue(undefined);
    onOpenChange.mockReset();
    useStudyModeStore.setState({ ...INITIAL_STUDY_MODE_STATE, isLoaded: true });
  });

  afterAll(() => {
    delete (global as { chrome?: unknown }).chrome;
  });

  it('creates a custom mode after entering a name and saving', async () => {
    render(<CustomModeBuilder open={true} onOpenChange={onOpenChange} editingId={null} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const input = screen.getByTestId('builder-title-input');
    fireEvent.change(input, { target: { value: 'Shadowing' } });

    fireEvent.click(screen.getByTestId('builder-save'));

    await waitFor(() => {
      expect(useStudyModeStore.getState().customModes).toHaveLength(1);
    });

    expect(useStudyModeStore.getState().customModes[0]?.title).toBe('Shadowing');
    expect(useStudyModeStore.getState().activeModeId).toBe(useStudyModeStore.getState().customModes[0]?.id);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows validation error for empty name', async () => {
    render(<CustomModeBuilder open={true} onOpenChange={onOpenChange} editingId={null} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('builder-save'));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    expect(useStudyModeStore.getState().customModes).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('edits an existing custom mode and saves changes', async () => {
    useStudyModeStore.getState().createCustomMode('My combo', [
      { subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
    ]);
    const mode = useStudyModeStore.getState().customModes[0];
    expect(mode).toBeDefined();

    render(<CustomModeBuilder open={true} onOpenChange={onOpenChange} editingId={mode!.id} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const input = screen.getByTestId('builder-title-input');
    fireEvent.change(input, { target: { value: 'Updated combo' } });

    fireEvent.click(screen.getByTestId('builder-save'));

    await waitFor(() => {
      expect(useStudyModeStore.getState().customModes[0]?.title).toBe('Updated combo');
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cancels without saving when there are no changes', async () => {
    render(<CustomModeBuilder open={true} onOpenChange={onOpenChange} editingId={null} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('builder-cancel'));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(useStudyModeStore.getState().customModes).toHaveLength(0);
  });

  it('adds and reorders steps via the cue strip', async () => {
    render(<CustomModeBuilder open={true} onOpenChange={onOpenChange} editingId={null} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cue-add-step'));

    await waitFor(() => {
      expect(screen.getByTestId('cue-step-1')).toBeInTheDocument();
    });

    const cue = screen.getByTestId('cue-step-1');
    fireEvent.keyDown(cue, { key: 'ArrowLeft', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('step-row-0')).toBeInTheDocument();
    });
  });
});
