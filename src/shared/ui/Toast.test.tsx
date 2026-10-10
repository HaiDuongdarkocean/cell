import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastStack, enqueueToast, upsertToast, type ToastItem } from './Toast';

function toast(id: number, leaving = false): ToastItem {
  return { id, kind: 'success', message: 'Copied', leaving };
}

describe('enqueueToast', () => {
  it('keeps up to two toasts visible', () => {
    expect(enqueueToast([], toast(1))).toHaveLength(1);
    expect(enqueueToast([toast(1)], toast(2))).toHaveLength(2);
  });

  it('marks the oldest toast leaving when a third arrives', () => {
    const next = enqueueToast([toast(1), toast(2)], toast(3));
    expect(next).toHaveLength(3);
    expect(next[0]!.leaving).toBe(true);
    expect(next[1]!.leaving).toBe(false);
    expect(next[2]!.leaving).toBe(false);
  });

  it('evicts the oldest still-visible toast, not one already leaving', () => {
    const next = enqueueToast([toast(1, true), toast(2), toast(3)], toast(4));
    expect(next[1]!.leaving).toBe(true);
    expect(next[3]!.leaving).toBe(false);
  });
});

describe('upsertToast', () => {
  it('replaces the toast with the same actionId in place, keeping its id', () => {
    const pending: ToastItem = { id: 1, kind: 'pending', message: 'Saving…', leaving: false, actionId: 'a' };
    const next = upsertToast([pending, toast(2)], {
      id: 9,
      kind: 'success',
      message: 'Saved',
      leaving: false,
      actionId: 'a',
    });
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ id: 1, kind: 'success', message: 'Saved', leaving: false, actionId: 'a' });
  });

  it('enqueues when no live toast shares the actionId', () => {
    const gone: ToastItem = { id: 1, kind: 'pending', message: 'Saving…', leaving: true, actionId: 'a' };
    const next = upsertToast([gone], { id: 2, kind: 'success', message: 'Saved', leaving: false, actionId: 'a' });
    expect(next).toHaveLength(2);
    expect(next[1]!.id).toBe(2);
  });
});

describe('ToastStack', () => {
  it('renders a status pill per toast', () => {
    render(<ToastStack toasts={[toast(1), toast(2)]} onExited={jest.fn()} />);
    expect(screen.getAllByText('Copied')).toHaveLength(2);
  });

  it('marks error toasts for the error style', () => {
    render(<ToastStack toasts={[{ id: 1, kind: 'error', message: 'Failed', leaving: false }]} onExited={jest.fn()} />);
    expect(screen.getByText('Failed').closest('[data-kind]')).toHaveAttribute('data-kind', 'error');
  });

  it('reports a leaving toast as exited when its exit animation ends', () => {
    const onExited = jest.fn<(id: number) => void>();
    render(<ToastStack toasts={[toast(1, true), toast(2)]} onExited={onExited} />);
    const pills = screen.getAllByText('Copied');
    fireEvent.animationEnd(pills[0]!);
    expect(onExited).toHaveBeenCalledWith(1);
    fireEvent.animationEnd(pills[1]!);
    expect(onExited).toHaveBeenCalledTimes(1);
  });
});
