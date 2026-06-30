import { createDebouncedToast } from '../../../src/features/subtitle/ui/subtitleToast';

describe('createDebouncedToast (ADR-015 — toast debounce)', () => {
  let container: HTMLDivElement;
  let toasts: HTMLDivElement[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    toasts = [];
  });

  afterEach(() => {
    container.remove();
    jest.useRealTimers();
  });

  it('single call shows 1 toast after delay', () => {
    jest.useFakeTimers();
    const show = createDebouncedToast(
      (msg: string, el: HTMLElement) => {
        const toast = document.createElement('div');
        toast.setAttribute('data-testid', 'subtitle-toast');
        toast.textContent = msg;
        el.appendChild(toast);
        toasts.push(toast);
      },
      500,
    );
    show('Hello', container);
    expect(toasts.length).toBe(0);
    jest.advanceTimersByTime(500);
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toBe('Hello');
  });

  it('rapid calls only show 1 toast (trailing)', () => {
    jest.useFakeTimers();
    const show = createDebouncedToast(
      (msg: string, el: HTMLElement) => {
        const toast = document.createElement('div');
        toast.setAttribute('data-testid', 'subtitle-toast');
        toast.textContent = msg;
        el.appendChild(toast);
        toasts.push(toast);
      },
      500,
    );
    show('A', container);
    jest.advanceTimersByTime(100);
    show('B', container);
    jest.advanceTimersByTime(100);
    show('C', container);
    jest.advanceTimersByTime(100);
    expect(toasts.length).toBe(0);
    jest.advanceTimersByTime(500);
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toBe('C');
  });

  it('two spaced calls show 2 toasts', () => {
    jest.useFakeTimers();
    const show = createDebouncedToast(
      (msg: string, el: HTMLElement) => {
        const toast = document.createElement('div');
        toast.setAttribute('data-testid', 'subtitle-toast');
        toast.textContent = msg;
        el.appendChild(toast);
        toasts.push(toast);
      },
      500,
    );
    show('A', container);
    jest.advanceTimersByTime(500);
    show('B', container);
    jest.advanceTimersByTime(500);
    expect(toasts.length).toBe(2);
    expect(toasts[0].textContent).toBe('A');
    expect(toasts[1].textContent).toBe('B');
  });

  it('passes through the message and container', () => {
    jest.useFakeTimers();
    let captured: { msg: string; el: HTMLElement } | null = null;
    const show = createDebouncedToast((msg, el) => {
      captured = { msg, el };
    }, 300);
    show('Test message', container);
    jest.advanceTimersByTime(300);
    expect(captured).toEqual({ msg: 'Test message', el: container });
  });
});
