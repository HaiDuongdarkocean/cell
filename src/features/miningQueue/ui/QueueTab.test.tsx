import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueueTab } from './QueueTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MiningQueueItem, MiningQueueRow } from '@/entities/miningQueue';

const ROWS: MiningQueueRow[] = [
  {
    id: 'q1',
    kind: 'term',
    term: '猫',
    pos: 'n',
    sentence: '猫が好き',
    sourceLabel: 'Show',
    createdAt: Date.now() - 5 * 60_000,
  },
  {
    id: 'q2',
    kind: 'sentence',
    sentence: 'sentence row',
    cueStart: 83_000,
    createdAt: Date.now() - 60_000,
  },
];

const FULL_ITEM: MiningQueueItem = {
  id: 'q1',
  dedupeKey: 'term|猫|猫が好き',
  createdAt: Date.now(),
  kind: 'term',
  term: '猫',
  langCode: 'ja',
  sentence: '猫が好き',
};

function calls(sendMessage: jest.Mock<Promise<unknown>, [unknown]>, type: string): number {
  return sendMessage.mock.calls.filter(
    (call) => (call[0] as { type: string }).type === type,
  ).length;
}

describe('QueueTab', () => {
  const sendMessage = jest.fn<Promise<unknown>, [unknown]>();
  const onCardify = jest.fn();
  const onQuickAdd = jest.fn();
  const onActionError = jest.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    sendMessage.mockReset().mockImplementation((message: unknown) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.QUEUE_LIST) {
        return Promise.resolve({ success: true, data: { rows: ROWS } });
      }
      if (type === MESSAGE_TYPES.QUEUE_GET) {
        return Promise.resolve({ success: true, data: { item: FULL_ITEM } });
      }
      return Promise.resolve({ success: true, data: {} });
    });
    onCardify.mockReset();
    onQuickAdd.mockReset();
    onActionError.mockReset();
    (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage = sendMessage;
  });

  afterEach(() => {
    delete (globalThis as { __cellSendMessage?: typeof sendMessage }).__cellSendMessage;
  });

  it('lists rows with kind chip, sentence, and relative age', async () => {
    render(<QueueTab onCardify={onCardify} onQuickAdd={onQuickAdd} onActionError={onActionError} />);
    await waitFor(() => expect(screen.getByText('猫 · n')).toBeInTheDocument());
    expect(screen.getByText('猫が好き')).toBeInTheDocument();
    expect(screen.getByText('sentence row')).toBeInTheDocument();
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    expect(screen.getByText(/1:23/)).toBeInTheDocument();
  });

  it('hides quick-add on sentence rows', async () => {
    render(<QueueTab onCardify={onCardify} onQuickAdd={onQuickAdd} onActionError={onActionError} />);
    await waitFor(() => expect(screen.getByText('sentence row')).toBeInTheDocument());
    const termRow = document.querySelector('[data-queue-id="q1"]')!;
    const sentenceRow = document.querySelector('[data-queue-id="q2"]')!;
    expect(termRow.querySelector('[data-cell-id="queue-quick-add"]')).not.toBeNull();
    expect(sentenceRow.querySelector('[data-cell-id="queue-quick-add"]')).toBeNull();
  });

  it('fetches the full item before cardify so the row is removed only after success', async () => {
    render(<QueueTab onCardify={onCardify} onQuickAdd={onQuickAdd} onActionError={onActionError} />);
    await waitFor(() => expect(screen.getByText('猫 · n')).toBeInTheDocument());
    const termRow = document.querySelector('[data-queue-id="q1"]')!;
    fireEvent.click(termRow.querySelector('[data-cell-id="queue-cardify"]')!);
    await waitFor(() => expect(onCardify).toHaveBeenCalledWith(FULL_ITEM));
    expect(calls(sendMessage, MESSAGE_TYPES.QUEUE_REMOVE)).toBe(0);
  });

  it('reports an action error when the item vanished between list and click', async () => {
    render(<QueueTab onCardify={onCardify} onQuickAdd={onQuickAdd} onActionError={onActionError} />);
    await waitFor(() => expect(screen.getByText('猫 · n')).toBeInTheDocument());
    sendMessage.mockImplementation((message: unknown) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.QUEUE_GET) {
        return Promise.resolve({ success: true, data: {} });
      }
      return Promise.resolve({ success: true, data: { rows: ROWS } });
    });
    const termRow = document.querySelector('[data-queue-id="q1"]')!;
    fireEvent.click(termRow.querySelector('[data-cell-id="queue-cardify"]')!);
    await waitFor(() => expect(onActionError).toHaveBeenCalled());
    expect(onCardify).not.toHaveBeenCalled();
  });

  it('discards optimistically and re-lists on removal failure', async () => {
    render(<QueueTab onCardify={onCardify} onQuickAdd={onQuickAdd} onActionError={onActionError} />);
    await waitFor(() => expect(screen.getByText('sentence row')).toBeInTheDocument());
    sendMessage.mockImplementation((message: unknown) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.QUEUE_REMOVE) {
        return Promise.resolve({ success: false, error: 'nope' });
      }
      if (type === MESSAGE_TYPES.QUEUE_LIST) {
        return Promise.resolve({ success: true, data: { rows: ROWS } });
      }
      return Promise.resolve({ success: true, data: {} });
    });
    const sentenceRow = document.querySelector('[data-queue-id="q2"]')!;
    fireEvent.click(sentenceRow.querySelector('[data-cell-id="queue-discard"]')!);
    await waitFor(() => expect(onActionError).toHaveBeenCalledWith('nope'));
    await waitFor(() => expect(screen.getByText('sentence row')).toBeInTheDocument());
  });

  it('shows the empty state when the queue has no rows', async () => {
    sendMessage.mockResolvedValue({ success: true, data: { rows: [] } });
    render(<QueueTab onCardify={onCardify} onQuickAdd={onQuickAdd} onActionError={onActionError} />);
    await waitFor(() => expect(screen.getByText('Queue is empty')).toBeInTheDocument());
  });
});
