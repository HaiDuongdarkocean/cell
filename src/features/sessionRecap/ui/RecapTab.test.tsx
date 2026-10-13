import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { RecapTab } from './RecapTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { SessionRecap } from '../types';

const SESSION: SessionRecap = {
  id: 'session-1',
  videoId: 'video-1',
  sourceLabel: 'Demo video',
  kind: 'stream',
  startMs: 0,
  endMs: 60_000,
  durationMs: 60_000,
  positionMs: 0,
  live: false,
};

function recapCalls(sendMessage: jest.Mock<Promise<unknown>, [unknown]>): number {
  return sendMessage.mock.calls.filter(
    (call) => (call[0] as { type: string }).type === MESSAGE_TYPES.GET_SESSION_RECAP,
  ).length;
}

describe('RecapTab', () => {
  const sendMessage = jest.fn<Promise<unknown>, [unknown]>();
  const onLookup = jest.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    sendMessage.mockReset().mockResolvedValue({ success: true, data: { sessions: [SESSION] } });
    (globalThis as { __TihokaSendMessage?: typeof sendMessage }).__TihokaSendMessage = sendMessage;
  });

  afterEach(() => {
    delete (globalThis as { __TihokaSendMessage?: typeof sendMessage }).__TihokaSendMessage;
  });

  it('loads the recap on activation', async () => {
    render(<RecapTab isActive onLookup={onLookup} />);
    await waitFor(() => expect(screen.getByText('Demo video')).toBeInTheDocument());
    expect(recapCalls(sendMessage)).toBe(1);
  });

  it('does not load while inactive', async () => {
    render(<RecapTab isActive={false} onLookup={onLookup} />);
    await waitFor(() => expect(screen.getByText('Loading recap…')).toBeInTheDocument());
    expect(recapCalls(sendMessage)).toBe(0);
  });

  it('revalidates on each activation while the pane stays mounted', async () => {
    const { rerender } = render(<RecapTab isActive onLookup={onLookup} />);
    await waitFor(() => expect(screen.getByText('Demo video')).toBeInTheDocument());
    expect(recapCalls(sendMessage)).toBe(1);

    rerender(<RecapTab isActive={false} onLookup={onLookup} />);
    rerender(<RecapTab isActive onLookup={onLookup} />);
    await waitFor(() => expect(recapCalls(sendMessage)).toBe(2));
    expect(screen.getByText('Demo video')).toBeInTheDocument();
  });

  it('keeps the stale list when a refresh fails over displayed data', async () => {
    const { rerender } = render(<RecapTab isActive onLookup={onLookup} />);
    await waitFor(() => expect(screen.getByText('Demo video')).toBeInTheDocument());

    sendMessage.mockResolvedValue({ success: false });
    rerender(<RecapTab isActive={false} onLookup={onLookup} />);
    rerender(<RecapTab isActive onLookup={onLookup} />);

    await waitFor(() => expect(recapCalls(sendMessage)).toBe(2));
    expect(screen.getByText('Demo video')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error view only when the cache is empty', async () => {
    sendMessage.mockResolvedValue({ success: false });
    render(<RecapTab isActive onLookup={onLookup} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
