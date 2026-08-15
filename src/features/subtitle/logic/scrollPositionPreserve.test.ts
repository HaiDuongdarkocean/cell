import {
  saveScrollPosition,
  restoreScrollPosition,
  findScrollElement,
} from './scrollPositionPreserve';

function setupPanel(scrollTop: number): { panel: HTMLElement; scrollEl: HTMLElement } {
  document.body.innerHTML = '';
  const panel = document.createElement('div');
  panel.setAttribute('data-cell-split-view', 'panel');
  const shadow = panel.attachShadow({ mode: 'open' });
  const scrollEl = document.createElement('div');
  scrollEl.setAttribute('data-cell-id', 'cue-list-scroll');
  scrollEl.style.cssText = 'height:200px;overflow:scroll;';
  // jsdom doesn't layout, so scrollHeight/clientHeight are 0.
  // Mock scrollTop as a plain property to test save/restore logic.
  Object.defineProperty(scrollEl, 'scrollTop', {
    get: () => scrollTop,
    set: (v: number) => { scrollTop = v; },
    configurable: true,
  });
  shadow.appendChild(scrollEl);
  document.body.appendChild(panel);
  return { panel, scrollEl };
}

describe('findScrollElement', () => {
  it('finds the scroll element inside panel shadow root', () => {
    const { scrollEl } = setupPanel(0);
    expect(findScrollElement()).toBe(scrollEl);
  });

  it('returns null when no panel exists', () => {
    document.body.innerHTML = '';
    expect(findScrollElement()).toBeNull();
  });

  it('returns null when panel has no shadow root', () => {
    document.body.innerHTML = '';
    const panel = document.createElement('div');
    panel.setAttribute('data-cell-split-view', 'panel');
    document.body.appendChild(panel);
    expect(findScrollElement()).toBeNull();
  });
});

describe('saveScrollPosition', () => {
  it('returns current scrollTop when panel exists', () => {
    setupPanel(500);
    expect(saveScrollPosition()).toBe(500);
  });

  it('returns null when no panel exists', () => {
    document.body.innerHTML = '';
    expect(saveScrollPosition()).toBeNull();
  });
});

describe('restoreScrollPosition', () => {
  it('restores scrollTop to saved value', () => {
    let scrollTop = 0;
    const { panel } = setupPanel(0);
    const scrollEl = panel.shadowRoot!.querySelector<HTMLElement>('[data-cell-id="cue-list-scroll"]')!;
    Object.defineProperty(scrollEl, 'scrollTop', {
      get: () => scrollTop,
      set: (v: number) => { scrollTop = v; },
      configurable: true,
    });
    const result = restoreScrollPosition(panel, 750);
    expect(result).toBe(true);
    expect(scrollTop).toBe(750);
  });

  it('returns false when saved is null', () => {
    const { panel } = setupPanel(0);
    expect(restoreScrollPosition(panel, null)).toBe(false);
  });

  it('returns false when scroll element not found in target', () => {
    const panel = document.createElement('div');
    panel.attachShadow({ mode: 'open' });
    expect(restoreScrollPosition(panel, 100)).toBe(false);
  });
});
