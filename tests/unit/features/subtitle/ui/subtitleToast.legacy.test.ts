import { createDebouncedToast } from '@/features/subtitle/ui/subtitleToast.legacy';
import { showToast } from '@/features/subtitle/ui/subtitleUI';
import type { ToastOptions } from '@/features/subtitle/ui/subtitleUI';

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
      (msg: string, el: HTMLElement, _options?: ToastOptions) => {
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
      (msg: string, el: HTMLElement, _options?: ToastOptions) => {
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
      (msg: string, el: HTMLElement, _options?: ToastOptions) => {
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
    const show = createDebouncedToast((msg, el, _options) => {
      captured = { msg, el };
    }, 300);
    show('Test message', container);
    jest.advanceTimersByTime(300);
    expect(captured).toEqual({ msg: 'Test message', el: container });
  });

  it('passes through variant options to the underlying showToast', () => {
    jest.useFakeTimers();
    let captured: { msg: string; el: HTMLElement; options?: ToastOptions } | null = null;
    const show = createDebouncedToast((msg, el, options) => {
      captured = { msg, el, options };
    }, 300);
    show('Test message', container, { variant: 'success' });
    jest.advanceTimersByTime(300);
    expect(captured).toEqual({ msg: 'Test message', el: container, options: { variant: 'success' } });
  });
});

describe('showToast', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders success variant with icon and success-colored CSS var', () => {
    showToast('Subtitles loaded', container, { variant: 'success' });
    const toast = container.querySelector('[data-testid="subtitle-toast"]');
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute('data-variant')).toBe('success');
    expect((toast as HTMLElement).style.getPropertyValue('--toast-variant-color')).toBe('var(--color-success)');
    // Icon comes from ICON_CATALOG (mocked in tests as generic SVG)
    expect(toast?.querySelector('.subtitle-toast-icon svg')).toBeTruthy();
  });

  it('renders error variant with icon and error-colored CSS var', () => {
    showToast('Could not load subtitles', container, { variant: 'error' });
    const toast = container.querySelector('[data-testid="subtitle-toast"]');
    expect(toast?.getAttribute('data-variant')).toBe('error');
    expect((toast as HTMLElement).style.getPropertyValue('--toast-variant-color')).toBe('var(--color-error)');
    expect(toast?.querySelector('.subtitle-toast-icon svg')).toBeTruthy();
  });

  it('defaults to info variant when no options provided', () => {
    showToast('No subtitles detected', container);
    const toast = container.querySelector('[data-testid="subtitle-toast"]');
    expect(toast?.getAttribute('data-variant')).toBe('info');
    expect((toast as HTMLElement).style.getPropertyValue('--toast-variant-color')).toBe('var(--color-info)');
  });
});
