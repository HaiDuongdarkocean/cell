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
      expect(result.state.repeatHolding).toBe(false);
    });

    it('ArrowRight → next-sentence action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('ArrowRight'), state);
      expect(result.action).toBe('next-sentence');
    });

    it('r keydown (not repeat) → repeat-start action + repeatHolding=true', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('r'), state);
      expect(result.action).toBe('repeat-start');
      expect(result.state.repeatHolding).toBe(true);
    });

    it('R (uppercase) keydown → repeat-start', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('R'), state);
      expect(result.action).toBe('repeat-start');
      expect(result.state.repeatHolding).toBe(true);
    });

    it('r keydown with e.repeat=true → no action (ignore auto-repeat)', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeydown(makeKeydownEvent('r', { repeat: true }), state);
      expect(result.action).toBeNull();
      expect(result.state.repeatHolding).toBe(false);
    });

    it('r keydown when already repeatHolding → no action', () => {
      const state = { ...createInitialKeyboardState(), repeatHolding: true };
      const result = handleClusterKeydown(makeKeydownEvent('r'), state);
      expect(result.action).toBeNull();
      expect(result.state.repeatHolding).toBe(true);
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
    it('r keyup when repeatHolding → repeat-stop action + repeatHolding=false', () => {
      const state = { ...createInitialKeyboardState(), repeatHolding: true };
      const result = handleClusterKeyup(makeKeyupEvent('r'), state);
      expect(result.action).toBe('repeat-stop');
      expect(result.state.repeatHolding).toBe(false);
    });

    it('R keyup when repeatHolding → repeat-stop', () => {
      const state = { ...createInitialKeyboardState(), repeatHolding: true };
      const result = handleClusterKeyup(makeKeyupEvent('R'), state);
      expect(result.action).toBe('repeat-stop');
      expect(result.state.repeatHolding).toBe(false);
    });

    it('r keyup when not repeatHolding → no action', () => {
      const state = createInitialKeyboardState();
      const result = handleClusterKeyup(makeKeyupEvent('r'), state);
      expect(result.action).toBeNull();
      expect(result.state.repeatHolding).toBe(false);
    });

    it('other key keyup when repeatHolding → no action (keep holding)', () => {
      const state = { ...createInitialKeyboardState(), repeatHolding: true };
      const result = handleClusterKeyup(makeKeyupEvent('ArrowLeft'), state);
      expect(result.action).toBeNull();
      expect(result.state.repeatHolding).toBe(true);
    });
  });

  describe('cancelRepeatHold (blur/visibilitychange)', () => {
    it('cancelRepeatHold when repeatHolding → repeat-stop + repeatHolding=false', () => {
      const state = { ...createInitialKeyboardState(), repeatHolding: true };
      const result = cancelRepeatHold(state);
      expect(result.action).toBe('repeat-stop');
      expect(result.state.repeatHolding).toBe(false);
    });

    it('cancelRepeatHold when not repeatHolding → no action', () => {
      const state = createInitialKeyboardState();
      const result = cancelRepeatHold(state);
      expect(result.action).toBeNull();
      expect(result.state.repeatHolding).toBe(false);
    });
  });
});
