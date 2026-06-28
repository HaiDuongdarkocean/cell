import { useSidePanelStore } from '@/sidepanel/store/sidePanelStore';
import type { BilingualCue } from '@/types/media';

describe('sidePanelStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useSidePanelStore.setState({
      cues: [],
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
    });
  });

  const sampleCues: BilingualCue[] = [
    { index: 1, start: 1000, end: 3000, targetText: 'Hello', nativeText: 'Xin chào' },
    { index: 2, start: 3500, end: 5000, targetText: 'World', nativeText: 'Thế giới' },
  ];

  it('starts with empty state', () => {
    const state = useSidePanelStore.getState();
    expect(state.cues).toEqual([]);
    expect(state.currentTimeMs).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it('setCues stores cues', () => {
    useSidePanelStore.getState().setCues(sampleCues);
    expect(useSidePanelStore.getState().cues).toEqual(sampleCues);
  });

  it('setCurrentTime updates currentTime + duration', () => {
    useSidePanelStore.getState().setCurrentTime(2500, 60000);
    expect(useSidePanelStore.getState().currentTimeMs).toBe(2500);
    expect(useSidePanelStore.getState().durationMs).toBe(60000);
  });

  it('setPlaying updates isPlaying', () => {
    useSidePanelStore.getState().setPlaying(true);
    expect(useSidePanelStore.getState().isPlaying).toBe(true);
  });

  it('currentCueIndex returns -1 when no cues', () => {
    expect(useSidePanelStore.getState().currentCueIndex()).toBe(-1);
  });

  it('currentCueIndex returns index of active cue', () => {
    useSidePanelStore.getState().setCues(sampleCues);
    useSidePanelStore.getState().setCurrentTime(2000, 60000);
    // 2000ms is within cue 1 (1000-3000)
    expect(useSidePanelStore.getState().currentCueIndex()).toBe(0);
  });

  it('currentCueIndex returns -1 when between cues', () => {
    useSidePanelStore.getState().setCues(sampleCues);
    useSidePanelStore.getState().setCurrentTime(3200, 60000);
    // 3200ms is between cue 1 (end 3000) and cue 2 (start 3500)
    expect(useSidePanelStore.getState().currentCueIndex()).toBe(-1);
  });

  it('currentCueIndex returns second cue when in range', () => {
    useSidePanelStore.getState().setCues(sampleCues);
    useSidePanelStore.getState().setCurrentTime(4000, 60000);
    // 4000ms is within cue 2 (3500-5000)
    expect(useSidePanelStore.getState().currentCueIndex()).toBe(1);
  });
});
