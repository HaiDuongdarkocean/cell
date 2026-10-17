import { renderHook, act } from '@testing-library/react';
import { useCopyFlash } from './useCopyFlash';

const writeText = jest.fn<Promise<void>, [string]>();

beforeEach(() => {
  jest.useFakeTimers();
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

test('copy sets copied then resets after duration', async () => {
  writeText.mockResolvedValue(undefined);
  const { result } = renderHook(() => useCopyFlash(1000));
  const el = document.createElement('div');
  await act(async () => {
    await result.current.copy('hello', el);
  });
  expect(writeText).toHaveBeenCalledWith('hello');
  expect(result.current.copied).toBe(true);
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(result.current.copied).toBe(false);
});

test('re-copy resets the pending reset timer', async () => {
  writeText.mockResolvedValue(undefined);
  const { result } = renderHook(() => useCopyFlash(1000));
  const el = document.createElement('div');
  await act(async () => {
    await result.current.copy('a', el);
  });
  act(() => {
    jest.advanceTimersByTime(900);
  });
  await act(async () => {
    await result.current.copy('b', el);
  });
  act(() => {
    jest.advanceTimersByTime(900);
  });
  expect(result.current.copied).toBe(true);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(result.current.copied).toBe(false);
});

test('clipboard failure falls back to range selection', async () => {
  writeText.mockRejectedValue(new Error('denied'));
  const addRange = jest.fn();
  const removeAllRanges = jest.fn();
  const spy = jest.spyOn(window, 'getSelection').mockReturnValue({
    removeAllRanges,
    addRange,
  } as unknown as Selection);
  const { result } = renderHook(() => useCopyFlash(1000));
  const el = document.createElement('div');
  el.textContent = 'select me';
  document.body.appendChild(el);
  await act(async () => {
    await result.current.copy('x', el);
  });
  expect(result.current.copied).toBe(false);
  expect(removeAllRanges).toHaveBeenCalled();
  expect(addRange).toHaveBeenCalled();
  spy.mockRestore();
  document.body.removeChild(el);
});
