import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueSidePanel } from './QueueSidePanel';
import type { CardCreatorQueueItem } from '../types';

const makeItem = (
  term: string,
  status: CardCreatorQueueItem['status'] = 'unknown',
): CardCreatorQueueItem => ({ term, definitions: `def of ${term}`, status });

const baseProps = () => ({
  queueItems: [makeItem('lyin'), makeItem('isn'), makeItem('better')],
  queueActiveIndex: 0,
  onSelectQueueItem: jest.fn(),
  onDeleteQueueItem: jest.fn(),
  onUndoDeleteQueueItem: jest.fn(),
  toasts: [],
  onDismissToast: jest.fn(),
});

describe('QueueSidePanel', () => {
  it('renders nothing when closed', () => {
    render(<QueueSidePanel {...baseProps()} open={false} onClose={jest.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the queue list as a dialog layer when open', () => {
    render(<QueueSidePanel {...baseProps()} open onClose={jest.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-cell-id', 'cc-queue-panel');
    expect(screen.getByText('lyin')).toBeInTheDocument();
    expect(screen.getByText('better')).toBeInTheDocument();
  });

  it('selects an item and closes the panel (jump-to-fill)', () => {
    const props = baseProps();
    const onClose = jest.fn();
    render(<QueueSidePanel {...props} open onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Select isn/i }));
    expect(props.onSelectQueueItem).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes an item without closing (pruning multiple)', () => {
    const props = baseProps();
    const onClose = jest.fn();
    render(<QueueSidePanel {...props} open onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Remove isn from queue/i }));
    expect(props.onDeleteQueueItem).toHaveBeenCalledWith(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes via Escape', () => {
    const onClose = jest.fn();
    render(<QueueSidePanel {...baseProps()} open onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
