import {
  handleShortcutKey,
  isEditableTarget,
  isActivatableTarget,
  isEditableEvent,
} from '@/features/subtitle/ui/subtitleShortcuts';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/shared/config/config';
import type { KeyboardShortcut } from '@/entities/media';

describe('handleShortcutKey', () => {
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;

  it('returns prev-cue action when key is "a"', () => {
    const action = handleShortcutKey('a', shortcuts, createDivTarget());
    expect(action).toBe('prev-cue');
  });

  it('returns next-cue action when key is "d"', () => {
    const action = handleShortcutKey('d', shortcuts, createDivTarget());
    expect(action).toBe('next-cue');
  });

  it('returns replay-cue action when key is "s"', () => {
    const action = handleShortcutKey('s', shortcuts, createDivTarget());
    expect(action).toBe('replay-cue');
  });

  it('returns toggle-overlay action when key is "w"', () => {
    const action = handleShortcutKey('w', shortcuts, createDivTarget());
    expect(action).toBe('toggle-overlay');
  });

  it('returns toggle-panel action when key is "t"', () => {
    const action = handleShortcutKey('t', shortcuts, createDivTarget());
    expect(action).toBe('toggle-panel');
  });

  it('returns Player Mode action when key is "g"', () => {
    const action = handleShortcutKey('g', shortcuts, createDivTarget());
    expect(action).toBe('toggle-player-mode');
  });

  it('returns generate-native action when key is "h"', () => {
    const action = handleShortcutKey('h', shortcuts, createDivTarget());
    expect(action).toBe('generate-native');
  });

  it('returns play-pause action when key is " " (spacebar)', () => {
    const action = handleShortcutKey(' ', shortcuts, createDivTarget());
    expect(action).toBe('play-pause');
  });

  it('returns null when key does not match any shortcut', () => {
    const action = handleShortcutKey('x', shortcuts, createDivTarget());
    expect(action).toBeNull();
  });

  it('returns null when key is uppercase (case-sensitive match)', () => {
    // ponytail: key should be lowercase — caller normalizes via e.key.toLowerCase()
    const action = handleShortcutKey('A', shortcuts, createDivTarget());
    expect(action).toBeNull();
  });

  it('returns null when target is an input element', () => {
    const inputTarget = createInputTarget('input');
    const action = handleShortcutKey('a', shortcuts, inputTarget);
    expect(action).toBeNull();
  });

  it('returns null when target is a textarea element', () => {
    const textareaTarget = createInputTarget('textarea');
    const action = handleShortcutKey('a', shortcuts, textareaTarget);
    expect(action).toBeNull();
  });

  it('returns null when target is contenteditable', () => {
    const editableTarget = createContentEditableTarget();
    const action = handleShortcutKey('a', shortcuts, editableTarget);
    expect(action).toBeNull();
  });

  it('returns null when target is a select element', () => {
    const selectTarget = createInputTarget('select');
    const action = handleShortcutKey('a', shortcuts, selectTarget);
    expect(action).toBeNull();
  });

  it('respects remapped shortcuts', () => {
    const remapped: KeyboardShortcut[] = [
      { action: 'prev-cue', key: 'q' },
      { action: 'next-cue', key: 'e' },
      { action: 'replay-cue', key: 'r' },
      { action: 'play-pause', key: 'p' },
      { action: 'toggle-overlay', key: 'f' },
      { action: 'toggle-panel', key: 'g' },
    ];
    expect(handleShortcutKey('a', remapped, createDivTarget())).toBeNull();
    expect(handleShortcutKey('q', remapped, createDivTarget())).toBe('prev-cue');
    expect(handleShortcutKey('e', remapped, createDivTarget())).toBe('next-cue');
    expect(handleShortcutKey('p', remapped, createDivTarget())).toBe('play-pause');
  });

  it('returns null when shortcuts array is empty', () => {
    const action = handleShortcutKey('a', [], createDivTarget());
    expect(action).toBeNull();
  });
});

describe('isActivatableTarget', () => {
  it('returns true for button element', () => {
    expect(isActivatableTarget(document.createElement('button'))).toBe(true);
  });

  it('returns true for anchor element', () => {
    expect(isActivatableTarget(document.createElement('a'))).toBe(true);
  });

  it('returns true for role="button" element', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    expect(isActivatableTarget(div)).toBe(true);
  });

  it('returns false for div element', () => {
    expect(isActivatableTarget(createDivTarget())).toBe(false);
  });

  it('returns false for null target', () => {
    expect(isActivatableTarget(null)).toBe(false);
  });
});

describe('isEditableEvent', () => {
  it('returns true when real target is an input (simulated shadow retargeting)', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true });
    // jsdom does not populate composedPath() for synthetic keyboard events, so
    // we simulate retargeting: e.target would be the shadow host, but the real
    // focused element is the first entry in composedPath().
    Object.defineProperty(event, 'composedPath', {
      value: () => [input, document.body],
      configurable: true,
    });

    expect(isEditableEvent(event)).toBe(true);
  });

  it('returns false when real target is a non-editable surface element', () => {
    const panel = document.createElement('div');
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'composedPath', {
      value: () => [panel, document.body],
      configurable: true,
    });

    expect(isEditableEvent(event)).toBe(false);
  });
});

describe('isEditableTarget', () => {
  it('returns true for input element', () => {
    expect(isEditableTarget(createInputTarget('input'))).toBe(true);
  });

  it('returns true for textarea element', () => {
    expect(isEditableTarget(createInputTarget('textarea'))).toBe(true);
  });

  it('returns true for select element', () => {
    expect(isEditableTarget(createInputTarget('select'))).toBe(true);
  });

  it('returns true for contenteditable element', () => {
    expect(isEditableTarget(createContentEditableTarget())).toBe(true);
  });

  it('returns false for div element', () => {
    expect(isEditableTarget(createDivTarget())).toBe(false);
  });

  it('returns false for null target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});

// --- Helpers ---

function createDivTarget(): EventTarget {
  return document.createElement('div');
}

function createInputTarget(tag: 'input' | 'textarea' | 'select'): EventTarget {
  return document.createElement(tag);
}

function createContentEditableTarget(): EventTarget {
  const div = document.createElement('div');
  div.setAttribute('contenteditable', 'true');
  return div;
}
