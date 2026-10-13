import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueSidebar } from './QueueSidebar';
import type { CardCreatorQueueItem, Toast } from '../types';

const makeItem = (
  term: string,
  status: CardCreatorQueueItem['status'] = 'unknown',
): CardCreatorQueueItem => ({ term, definitions: `def of ${term}`, status });

const baseProps = () => ({
  queueItems: [makeItem('alpha'), makeItem('beta'), makeItem('gamma')],
  queueActiveIndex: 0,
  onSelectQueueItem: jest.fn(),
  onDeleteQueueItem: jest.fn(),
  onUndoDeleteQueueItem: jest.fn(),
  toasts: [] as Toast[],
  onDismissToast: jest.fn(),
});

describe('QueueSidebar', () => {
  it('End focuses the last queue item button, not its delete button', () => {
    render(<QueueSidebar {...baseProps()} />);
    const aside = screen.getByTestId('cc-queue-sidebar');
    fireEvent.keyDown(aside, { key: 'End' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Select gamma/i }),
    );
  });

  it('Home focuses the first queue item button', () => {
    render(<QueueSidebar {...baseProps()} />);
    const aside = screen.getByTestId('cc-queue-sidebar');
    screen.getByRole('button', { name: /Select gamma/i }).focus();
    fireEvent.keyDown(aside, { key: 'Home' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Select alpha/i }),
    );
  });

  it('skips rows whose term is blank', () => {
    const props = baseProps();
    render(
      <QueueSidebar {...props} queueItems={[makeItem('alpha'), makeItem('  '), makeItem('gamma')]} />,
    );
    expect(screen.queryByRole('button', { name: /Select\s+$/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Select /i })).toHaveLength(2);
  });

  it('renders an empty state with undo when overlay queue is drained', () => {
    const props = {
      ...baseProps(),
      queueItems: [],
      toasts: [{ id: 1, kind: 'warning' as const, message: 'Removed "gamma"', undoable: true }],
    };
    render(<QueueSidebar {...props} overlay />);

    expect(screen.getByTestId('cc-queue-empty')).toHaveTextContent('Queue is empty');
    const undo = screen.getByRole('button', { name: /Undo last deletion/i });
    fireEvent.click(undo);
    expect(props.onUndoDeleteQueueItem).toHaveBeenCalled();
    expect(props.onDismissToast).toHaveBeenCalledWith(1);
  });

  it('renders nothing (non-overlay) when the queue is empty', () => {
    const { container } = render(<QueueSidebar {...baseProps()} queueItems={[]} />);
    expect(container.querySelector('[data-tihoka-id="cc-queue-sidebar"]')).toBeNull();
  });
});
