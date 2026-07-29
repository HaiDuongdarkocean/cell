import { useCuesStore } from './cuesStore';
import type { SrtCue } from '@/entities/media/types';

const makeCue = (index: number, text: string): SrtCue => ({
  index,
  start: index * 1000,
  end: index * 1000 + 500,
  text,
});

describe('cuesStore', () => {
  beforeEach(() => {
    useCuesStore.setState({
      targetCues: [],
      nativeCues: [],
      targetActiveIndex: -1,
      nativeActiveIndex: -1,
    });
  });

  it('updates target/native cues and resets active indices', () => {
    const targetCues = [makeCue(1, 'target 1')];
    const nativeCues = [makeCue(2, 'native 2')];
    useCuesStore.getState().setCues(targetCues, nativeCues);
    const state = useCuesStore.getState();
    expect(state.targetCues).toEqual(targetCues);
    expect(state.nativeCues).toEqual(nativeCues);
    expect(state.targetActiveIndex).toBe(-1);
    expect(state.nativeActiveIndex).toBe(-1);
  });

  it('updates active indices', () => {
    useCuesStore.getState().setActiveIndex(3, 4);
    expect(useCuesStore.getState().targetActiveIndex).toBe(3);
    expect(useCuesStore.getState().nativeActiveIndex).toBe(4);
  });

  it('subscribes to slices independently', () => {
    const listener = jest.fn();
    const unsubscribe = useCuesStore.subscribe((state) => state.targetActiveIndex, listener);

    useCuesStore.getState().setCues([makeCue(1, 'a')], [makeCue(2, 'b')]);
    expect(listener).not.toHaveBeenCalled();

    useCuesStore.getState().setActiveIndex(2, 1);
    expect(listener).toHaveBeenCalledWith(2, -1);

    unsubscribe();
  });

  it('listens to cell:cues:updated event', () => {
    const targetCues = [makeCue(0, 'target 0')];
    const nativeCues = [makeCue(0, 'native 0')];
    document.dispatchEvent(
      new CustomEvent('cell:cues:updated', {
        detail: { targetCues, nativeCues, targetActiveIndex: 0, nativeActiveIndex: 0 },
      }),
    );
    const state = useCuesStore.getState();
    expect(state.targetCues).toEqual(targetCues);
    expect(state.nativeCues).toEqual(nativeCues);
    expect(state.targetActiveIndex).toBe(0);
    expect(state.nativeActiveIndex).toBe(0);
  });
});
