/**
 * Tests for cardCreatorKeyboard — q/e shortcuts + guards.
 */
import { handleCardCreatorKeydown } from './cardCreatorKeyboard';

function makeEvent(key: string, opts: { target?: EventTarget | null; repeat?: boolean } = {}): KeyboardEvent {
  return {
    key,
    target: opts.target ?? null,
    repeat: opts.repeat ?? false,
  } as unknown as KeyboardEvent;
}

describe('cardCreatorKeyboard', () => {
  it('q → quick-update', () => {
    expect(handleCardCreatorKeydown(makeEvent('q'), false).action).toBe('quick-update');
  });

  it('Q (shift) → quick-update', () => {
    expect(handleCardCreatorKeydown(makeEvent('Q'), false).action).toBe('quick-update');
  });

  it('e → edit-card', () => {
    expect(handleCardCreatorKeydown(makeEvent('e'), false).action).toBe('edit-card');
  });

  it('E (shift) → edit-card', () => {
    expect(handleCardCreatorKeydown(makeEvent('E'), false).action).toBe('edit-card');
  });

  it('other key → null', () => {
    expect(handleCardCreatorKeydown(makeEvent('a'), false).action).toBeNull();
    expect(handleCardCreatorKeydown(makeEvent('ArrowLeft'), false).action).toBeNull();
  });

  it('dialog open → null (no action)', () => {
    expect(handleCardCreatorKeydown(makeEvent('q'), true).action).toBeNull();
    expect(handleCardCreatorKeydown(makeEvent('e'), true).action).toBeNull();
  });

  it('typing in input → null', () => {
    const input = document.createElement('input');
    expect(handleCardCreatorKeydown(makeEvent('q', { target: input }), false).action).toBeNull();
  });

  it('typing in textarea → null', () => {
    const textarea = document.createElement('textarea');
    expect(handleCardCreatorKeydown(makeEvent('e', { target: textarea }), false).action).toBeNull();
  });

  it('auto-repeat → null', () => {
    expect(handleCardCreatorKeydown(makeEvent('q', { repeat: true }), false).action).toBeNull();
  });
});
