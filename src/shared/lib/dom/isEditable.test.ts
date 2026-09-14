import { isEditableTarget, isEditableEvent, isActivatableTarget } from './isEditable';

describe('isEditableTarget', () => {
  it('returns true for input, textarea, and select', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
  });

  it('returns true for contenteditable elements', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns false for div and null', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isEditableEvent', () => {
  it('returns true when composedPath()[0] is an input', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    Object.defineProperty(event, 'composedPath', {
      value: () => [input, document.body],
      configurable: true,
    });
    expect(isEditableEvent(event)).toBe(true);
  });

  it('returns false when composedPath()[0] is a plain div', () => {
    const div = document.createElement('div');
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    Object.defineProperty(event, 'composedPath', {
      value: () => [div, document.body],
      configurable: true,
    });
    expect(isEditableEvent(event)).toBe(false);
  });

  it('falls back to e.target when composedPath is unavailable', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, configurable: true });
    Object.defineProperty(event, 'composedPath', { value: () => [], configurable: true });
    expect(isEditableEvent(event)).toBe(true);
  });
});

describe('isActivatableTarget', () => {
  it('returns true for button, anchor, and role="button"', () => {
    expect(isActivatableTarget(document.createElement('button'))).toBe(true);
    expect(isActivatableTarget(document.createElement('a'))).toBe(true);
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    expect(isActivatableTarget(div)).toBe(true);
  });

  it('returns false for div and null', () => {
    expect(isActivatableTarget(document.createElement('div'))).toBe(false);
    expect(isActivatableTarget(null)).toBe(false);
  });
});
