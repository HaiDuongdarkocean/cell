import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { createElement, useRef } from 'react';
import { usePaneResize } from './usePaneResize';

const STORAGE_KEY = 'testPanePct';
const storageData: Record<string, unknown> = {};

beforeEach(() => {
  for (const k of Object.keys(storageData)) delete storageData[k];
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: {
        get: jest.fn((keys: unknown) =>
          Promise.resolve(
            typeof keys === 'string'
              ? { [keys]: storageData[keys] }
              : { ...storageData },
          ),
        ),
        set: jest.fn((items: Record<string, unknown>) => {
          Object.assign(storageData, items);
          return Promise.resolve();
        }),
      },
    },
  };
});

function Probe({ defaultPct = 50, minPct = 25, maxPct = 75 } = {}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleProps } = usePaneResize({
    containerRef,
    storageKey: STORAGE_KEY,
    defaultPct,
    minPct,
    maxPct,
  });
  return createElement(
    'div',
    { 'data-tihoka-id': 'container', ref: containerRef },
    createElement('div', { 'data-tihoka-id': 'handle', ...handleProps }),
  );
}

function setup(): HTMLElement {
  const { getByTestId } = render(createElement(Probe));
  const container = getByTestId('container');
  const handle = getByTestId('handle');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ width: 1000 }),
    configurable: true,
  });
  handle.setPointerCapture = jest.fn() as unknown as typeof handle.setPointerCapture;
  handle.releasePointerCapture = jest.fn() as unknown as typeof handle.releasePointerCapture;
  return handle;
}

function firePointer(el: HTMLElement, type: string, clientX: number): void {
  const e = new Event(type, { bubbles: true });
  Object.defineProperty(e, 'clientX', { value: clientX });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  fireEvent(el, e);
}

describe('usePaneResize', () => {
  it('grows pct when dragging left and persists on pointerup', async () => {
    const handle = setup();
    firePointer(handle, 'pointerdown', 500);
    firePointer(handle, 'pointermove', 400); // -100px of 1000 → +10
    expect(handle.getAttribute('aria-valuenow')).toBe('60');
    firePointer(handle, 'pointerup', 400);
    await waitFor(() => expect(storageData[STORAGE_KEY]).toBe(60));
  });

  it('clamps pct at max', () => {
    const handle = setup();
    firePointer(handle, 'pointerdown', 500);
    firePointer(handle, 'pointermove', -1000); // way past max
    expect(handle.getAttribute('aria-valuenow')).toBe('75');
  });

  it('resizes via keyboard arrows and Home/End', () => {
    const handle = setup();
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle.getAttribute('aria-valuenow')).toBe('55');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle.getAttribute('aria-valuenow')).toBe('50');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle.getAttribute('aria-valuenow')).toBe('75');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle.getAttribute('aria-valuenow')).toBe('25');
  });

  it('loads the persisted pct on mount', async () => {
    storageData[STORAGE_KEY] = 65;
    const handle = setup();
    await waitFor(() => expect(handle.getAttribute('aria-valuenow')).toBe('65'));
  });
});
