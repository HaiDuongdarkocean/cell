import { pinLayerInsideStage } from './pinLayerInsideStage';

describe('pinLayerInsideStage', () => {
  it('converts a viewport-pinned layer to absolute and keeps its authored anchors', () => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.inset = '0';

    pinLayerInsideStage(el);

    expect(el.style.getPropertyValue('position')).toBe('absolute');
    expect(el.style.getPropertyPriority('position')).toBe('important');
  });

  it('keeps a bottom-anchored fixed bar on the bottom edge instead of pinning it to the top', () => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.bottom = '0';

    pinLayerInsideStage(el);

    expect(el.style.getPropertyValue('position')).toBe('absolute');
    expect(el.style.getPropertyValue('top')).toBe('');
    expect(el.style.getPropertyValue('bottom')).toBe('0px');
  });

  it('leaves already-absolute host chrome untouched — YouTube .ytp-chrome-bottom keeps bottom:0, never gets top:0', () => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.bottom = '0';

    pinLayerInsideStage(el);

    expect(el.style.getPropertyValue('position')).toBe('absolute');
    expect(el.style.getPropertyValue('top')).toBe('');
    expect(el.style.getPropertyValue('inset')).toBe('');
  });
});
