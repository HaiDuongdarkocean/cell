import { dispatchCuesUpdated, CELL_CUES_UPDATED, type CuesUpdatedEvent } from './events';
import type { SrtCue } from '@/entities/media/types';

const makeCue = (index: number): SrtCue => ({
  index,
  start: index * 1000,
  end: index * 1000 + 500,
  text: `cue ${index}`,
});

describe('subtitle events', () => {
  it('dispatches cell:cues:updated with correct detail', () => {
    const target = document.createElement('div');
    const handler = jest.fn();
    target.addEventListener(CELL_CUES_UPDATED, handler);

    const detail = {
      targetCues: [makeCue(1)],
      nativeCues: [makeCue(2)],
      targetActiveIndex: 0,
      nativeActiveIndex: 0,
      trackId: 'en',
    };
    dispatchCuesUpdated(target, detail);

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CuesUpdatedEvent;
    expect(event.detail).toEqual(detail);
  });
});
