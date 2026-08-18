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
      targetLoadStatus: { state: 'idle' },
      nativeLoadStatus: { state: 'idle' },
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

  it('setCues transitions loading→loaded (preserves languageLabel + source)', () => {
    useCuesStore.getState().setLoadStatus('target', { state: 'loading', languageLabel: 'English', source: 'auto' });
    useCuesStore.getState().setCues([makeCue(0, 'hi')], []);
    const status = useCuesStore.getState().targetLoadStatus;
    expect(status.state).toBe('loaded');
    expect(status.languageLabel).toBe('English');
    expect(status.source).toBe('auto');
  });

  it('setCues does NOT re-trigger loaded when already idle (no status flicker on cue gaps)', () => {
    // Simulate: loading → loaded (cues arrive) → auto-clear 5s → idle
    useCuesStore.getState().setLoadStatus('target', { state: 'loading', languageLabel: 'English' });
    useCuesStore.getState().setCues([makeCue(0, 'hi')], []);
    expect(useCuesStore.getState().targetLoadStatus.state).toBe('loaded');
    // Auto-clear (SubtitleBlock useEffect fires after 5s)
    useCuesStore.getState().setLoadStatus('target', { state: 'idle' });
    // setCues fires again on next timeupdate (cue gap) — must stay idle
    useCuesStore.getState().setCues([makeCue(0, 'hi')], []);
    expect(useCuesStore.getState().targetLoadStatus.state).toBe('idle');
  });

  it('setCues does NOT re-trigger loaded when already loaded', () => {
    useCuesStore.getState().setLoadStatus('target', { state: 'loading', languageLabel: 'English' });
    useCuesStore.getState().setCues([makeCue(0, 'hi')], []);
    const firstStatus = useCuesStore.getState().targetLoadStatus;
    // setCues fires again on timeupdate — should not create a NEW loaded status
    useCuesStore.getState().setCues([makeCue(0, 'hi')], []);
    const secondStatus = useCuesStore.getState().targetLoadStatus;
    expect(secondStatus.state).toBe('loaded');
    // Same object reference (no new object created) — prevents useEffect re-trigger
    expect(secondStatus).toBe(firstStatus);
  });
});
