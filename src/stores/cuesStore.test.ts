import { useCuesStore } from './cuesStore';
import type { BilingualCue } from '@/entities/media/types';

const makeCue = (index: number): BilingualCue => ({
  index,
  start: index * 1000,
  end: index * 1000 + 500,
  targetText: `target ${index}`,
  nativeText: `native ${index}`,
});

describe('cuesStore', () => {
  beforeEach(() => {
    useCuesStore.setState({ cues: [], activeIndex: 0 });
  });

  it('updates cues and resets active index', () => {
    const cues = [makeCue(1), makeCue(2)];
    useCuesStore.getState().setCues(cues);
    const state = useCuesStore.getState();
    expect(state.cues).toEqual(cues);
    expect(state.activeIndex).toBe(0);
  });

  it('updates active index', () => {
    useCuesStore.getState().setActiveIndex(3);
    expect(useCuesStore.getState().activeIndex).toBe(3);
  });

  it('subscribes to slices independently', () => {
    const listener = jest.fn();
    const unsubscribe = useCuesStore.subscribe((state) => state.activeIndex, listener);

    useCuesStore.getState().setCues([makeCue(1)]);
    expect(listener).not.toHaveBeenCalled();

    useCuesStore.getState().setActiveIndex(2);
    expect(listener).toHaveBeenCalledWith(2, 0);

    unsubscribe();
  });
});
