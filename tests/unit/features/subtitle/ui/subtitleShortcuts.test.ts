import { handleShortcutKey, isEditableTarget } from '@/features/subtitle/ui/subtitleShortcuts';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/shared/config/config';
import type { KeyboardShortcut } from '@/types/media';

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
      { action: 'toggle-overlay', key: 'f' },
      { action: 'toggle-panel', key: 'g' },
    ];
    expect(handleShortcutKey('a', remapped, createDivTarget())).toBeNull();
    expect(handleShortcutKey('q', remapped, createDivTarget())).toBe('prev-cue');
    expect(handleShortcutKey('e', remapped, createDivTarget())).toBe('next-cue');
  });

  it('returns null when shortcuts array is empty', () => {
    const action = handleShortcutKey('a', [], createDivTarget());
    expect(action).toBeNull();
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
