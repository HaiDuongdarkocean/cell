import { describe, it, expect } from '@jest/globals';
import { handleClusterKeydown, handleClusterKeyup, createInitialKeyboardState, cancelRepeatHold } from '@/features/subtitle/ui/navClusterKeyboard';

function makeKeydownEvent(key: string, opts: { repeat?: boolean; target?: EventTarget | null } = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, repeat: opts.repeat ?? false });
  if (opts.target !== undefined) {
    Object.defineProperty(e, 'target', { value: opts.target });
  }
  return e;
}

function makeKeyupEvent(key: string): KeyboardEvent {
  return new KeyboardEvent('keyup', { key, bubbles: true });
}

function makeEditableTarget(): HTMLElement {
  const input = document.createElement('input');
  return input;
}

describe('navClusterKeyboard — pure state machine (ADR-018 D4, spec §F12)', () => {
  describe('handleClusterKeydown', () => {
    it('ArrowLeft → prev-sentence action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('ArrowLeft'), state);
      expect(result.action).toBe('prev-sentence');
    });

    it('ArrowRight → next-sentence action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('ArrowRight'), state);
      expect(result.action).toBe('next-sentence');
    });

    it('r keydown (not repeat) → repeat-toggle action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('r'), state);
      expect(result.action).toBe('repeat-toggle');
    });

    it('R (uppercase) keydown → repeat-toggle', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('R'), state);
      expect(result.action).toBe('repeat-toggle');
    });

    it('r keydown with e.repeat=true → no action (ignore auto-repeat)', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('r', { repeat: true }), state);
      expect(result.action).toBeNull();
    });

    it('< keydown → seek-rewind-5 action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('<'), state);
      expect(result.action).toBe('seek-rewind-5');
    });

    it(', keydown → seek-rewind-5 action (fallback for layouts without Shift)', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent(','), state);
      expect(result.action).toBe('seek-rewind-5');
    });

    it('> keydown → seek-forward-10 action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('>'), state);
      expect(result.action).toBe('seek-forward-10');
    });

    it('. keydown → seek-forward-10 action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('.'), state);
      expect(result.action).toBe('seek-forward-10');
    });

    it('unmapped key → no action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('a'), state);
      expect(result.action).toBeNull();
    });

    it('editable target (input) → no action', () => {
      const state = createInitialKeyboardState();
      const target = makeEditableTarget();
      const result = handleClusterKeydown(makeKeydownEvent('ArrowLeft', { target }), state);
      expect(result.action).toBeNull();
    });

    it('editable target (textarea) → no action', () => {
      const state = createInitialKeyboardState();
      const target = document.createElement('textarea');
      const result = handleClusterKeydown(makeKeydownEvent('ArrowLeft', { target }), state);
      expect(result.action).toBeNull();
    });

    it('contenteditable target → no action', () => {
      const state = createInitialKeyboardState();
      const target = document.createElement('div');
      target.setAttribute('contenteditable', 'true');
      const result = handleClusterKeydown(makeKeydownEvent('ArrowLeft', { target }), state);
      expect(result.action).toBeNull();
    });
  });

  describe('handleClusterKeyup', () => {
    it('r keyup → no action (3-state repeat is toggle-on-keydown)', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeyup(makeKeyupEvent('r'), state);
      expect(result.action).toBeNull();
    });

    it('other key keyup → no action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeyup(makeKeyupEvent('ArrowLeft'), state);
      expect(result.action).toBeNull();
    });
  });

  describe('cancelRepeatHold (blur/visibilitychange)', () => {
    it('cancelRepeatHold → no action (loop is not tied to key hold)', () => {
      const state = createInitialKeyboardState();
      const result = cancelRepeatHold(state);
      expect(result.action).toBeNull();
    });
  });
});
