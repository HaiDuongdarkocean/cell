import { describe, expect, it, jest, afterEach, beforeEach } from '@jest/globals';
import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import { useSheet } from './useSheet';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

jest.mock('@/shared/lib/chrome-apis', () => ({
  getStorage: jest.fn(async () => ({})),
  setStorage: jest.fn(async () => undefined),
}));

const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;
const mockSetStorage = setStorage as jest.MockedFunction<typeof setStorage>;

function Probe({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const { onPointerDownHandle } = useSheet({ onClose });
  return createElement('div', { 'data-tihoka-id': 'handle', onPointerDown: onPointerDownHandle });
}

function firePointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  const e = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  target.dispatchEvent(e);
}

describe('useSheet ghost-click swallower', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function closeViaHandle(): { readonly sentinel: jest.Mock; readonly onClose: jest.Mock } {
    const onClose = jest.fn();
    const { getByTestId } = render(createElement(Probe, { onClose }));
    const handle = getByTestId('handle');
    const sentinel = jest.fn();
    document.addEventListener('click', sentinel);
    act(() => {
      firePointer(handle, 'pointerdown', 100, 200);
      firePointer(document, 'pointerup', 100, 200);
    });
    return { sentinel, onClose };
  }

  it('closes on handle click and swallows the retargeted ghost click', () => {
    jest.useFakeTimers();
    const { sentinel, onClose } = closeViaHandle();
    expect(onClose).toHaveBeenCalledTimes(1);

    const ghost = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    document.body.dispatchEvent(ghost);
    expect(sentinel).not.toHaveBeenCalled();
    expect(ghost.defaultPrevented).toBe(true);
  });

  it('lets keyboard clicks (detail 0) pass through', () => {
    jest.useFakeTimers();
    const { sentinel } = closeViaHandle();
    const keyClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
    document.body.dispatchEvent(keyClick);
    expect(sentinel).toHaveBeenCalledTimes(1);
    expect(keyClick.defaultPrevented).toBe(false);
  });

  it('disarms itself so a later click reaches listeners', () => {
    jest.useFakeTimers();
    const { sentinel } = closeViaHandle();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const late = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    document.body.dispatchEvent(late);
    expect(sentinel).toHaveBeenCalledTimes(1);
    expect(late.defaultPrevented).toBe(false);
  });
});

describe('useSheet content pull-to-dismiss', () => {
  function ContentProbe({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
    const { onPointerDownContent } = useSheet({ onClose });
    return createElement('div', {
      'data-tihoka-id': 'content',
      onPointerDown: onPointerDownContent,
      style: { overflowY: 'auto' },
    }, createElement('div', { 'data-tihoka-id': 'inner', style: { overflowY: 'auto' } }));
  }

  function setScrollable(el: HTMLElement, scrollTop: number): void {
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, configurable: true });
  }

  function drag(content: EventTarget, fromY: number, toY: number): void {
    act(() => {
      firePointer(content, 'pointerdown', 100, fromY);
      firePointer(document, 'pointermove', 100, toY);
      firePointer(document, 'pointerup', 100, toY);
      jest.advanceTimersByTime(400);
    });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('closes when content is scrolled to top', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const { getByTestId } = render(createElement(ContentProbe, { onClose }));
    drag(getByTestId('inner'), 200, 350);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close while a nested scroller still has room above', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const { getByTestId } = render(createElement(ContentProbe, { onClose }));
    setScrollable(getByTestId('inner'), 50);
    drag(getByTestId('inner'), 200, 350);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useSheet persistKey', () => {
  function PersistProbe(): React.JSX.Element {
    const { sheetHeight, onKeyDownHandle } = useSheet({ persistKey: 'testSheetVh' });
    return createElement('div', {
      'data-tihoka-id': 'handle',
      style: { height: sheetHeight },
      onKeyDown: onKeyDownHandle,
    });
  }

  beforeEach(() => {
    mockGetStorage.mockClear();
    mockSetStorage.mockClear().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 800, configurable: true });
  });

  it('restores the stored %vh height on mount', async () => {
    mockGetStorage.mockResolvedValue({ testSheetVh: 50 });
    const { getByTestId } = render(createElement(PersistProbe));
    await act(async () => undefined);
    const vh = document.documentElement.clientHeight;
    expect(getByTestId('handle').style.height).toBe(`${Math.round(vh * 0.5)}px`);
  });

  it('saves %vh on keyboard resize and clamps to 95', async () => {
    mockGetStorage.mockResolvedValue({ testSheetVh: 99 });
    const { getByTestId } = render(createElement(PersistProbe));
    await act(async () => undefined);
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      getByTestId('handle').dispatchEvent(e);
    });
    expect(mockSetStorage).toHaveBeenCalled();
    const arg = mockSetStorage.mock.calls[0][0] as { testSheetVh: number };
    expect(arg.testSheetVh).toBeLessThanOrEqual(95);
    expect(arg.testSheetVh).toBeGreaterThanOrEqual(20);
  });
});
