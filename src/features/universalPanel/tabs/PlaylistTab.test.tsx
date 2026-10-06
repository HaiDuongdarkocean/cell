import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlaylistTab } from './PlaylistTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { CondensedAudioRecord } from '@/entities/condensedAudio';
import type { MessageResponse, CondenseAudioReadResult } from '@/entities/message';

const RECORD: CondensedAudioRecord = {
  id: 'rec-1',
  title: 'Demo audio',
  source: { kind: 'stream', pageKey: 'page-1' },
  leg: 'record',
  durationMs: 60_000,
  sizeBytes: 1024,
  mimeType: 'audio/mpeg',
  opfsPath: '/condensed/rec-1',
  exportFilename: null,
  exportState: 'none',
  driveFileId: null,
  driveSyncedAt: null,
  status: 'ready',
  error: null,
  createdAt: 0,
  updatedAt: 0,
};

const READ_RESULT: CondenseAudioReadResult = { dataBase64: 'AQ==', sizeBytes: 1, done: true };

function ok(data: unknown): Promise<MessageResponse<unknown>> {
  return Promise.resolve({ success: true, data });
}

describe('PlaylistTab', () => {
  const sendMessage = jest.fn<Promise<unknown>, [unknown]>();

  beforeAll(() => {
    global.chrome = {
      runtime: {
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
      },
    } as unknown as typeof chrome;
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    let counter = 0;
    URL.createObjectURL = jest.fn(() => `blob:preview-${++counter}`);
    URL.revokeObjectURL = jest.fn();
    (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage = sendMessage;

    sendMessage.mockReset().mockImplementation((message: unknown) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.CONDENSE_AUDIO_LIST) return ok([RECORD]);
      if (type === MESSAGE_TYPES.CONDENSE_AUDIO_READ) return ok(READ_RESULT);
      return ok(undefined);
    });
  });

  afterAll(() => {
    delete (global as { chrome?: unknown }).chrome;
    delete (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage;
  });

  async function renderLoadedTab(isActive = true) {
    const utils = render(<PlaylistTab isActive={isActive} />);
    await waitFor(() =>
      expect(screen.getByTestId('playlist-preview-btn-rec-1')).toBeInTheDocument(),
    );
    return utils;
  }

  it('mounts the preview audio while active and lists records', async () => {
    await renderLoadedTab();
    fireEvent.click(screen.getByTestId('playlist-preview-btn-rec-1'));
    await waitFor(() =>
      expect(screen.getByTestId('playlist-preview-rec-1')).toBeInTheDocument(),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('tears down the preview and revokes the blob URL when isActive flips false', async () => {
    const { rerender } = await renderLoadedTab();
    fireEvent.click(screen.getByTestId('playlist-preview-btn-rec-1'));
    await waitFor(() => screen.getByTestId('playlist-preview-rec-1'));

    rerender(<PlaylistTab isActive={false} />);

    await waitFor(() =>
      expect(screen.queryByTestId('playlist-preview-rec-1')).not.toBeInTheDocument(),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('revokes a preview that resolves while the pane is inactive', async () => {
    const pending: { resolve?: (r: MessageResponse<CondenseAudioReadResult>) => void } = {};
    sendMessage.mockImplementation((message: unknown) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.CONDENSE_AUDIO_LIST) return ok([RECORD]);
      if (type === MESSAGE_TYPES.CONDENSE_AUDIO_READ) {
        return new Promise((resolve) => {
          pending.resolve = resolve;
        });
      }
      return ok(undefined);
    });

    const { rerender } = await renderLoadedTab();
    fireEvent.click(screen.getByTestId('playlist-preview-btn-rec-1'));

    // Deactivate while the chunk read is still in flight.
    rerender(<PlaylistTab isActive={false} />);
    await waitFor(() => expect(pending.resolve).toBeDefined());
    pending.resolve?.({ success: true, data: READ_RESULT });

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1'));
    expect(screen.queryByTestId('playlist-preview-rec-1')).not.toBeInTheDocument();
  });

  it('keeps the preview while active and releases it on unmount', async () => {
    const { unmount } = await renderLoadedTab();
    fireEvent.click(screen.getByTestId('playlist-preview-btn-rec-1'));
    await waitFor(() => screen.getByTestId('playlist-preview-rec-1'));

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });
});
