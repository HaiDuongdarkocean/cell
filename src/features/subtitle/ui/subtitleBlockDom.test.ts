import { createSubtitleBlockDOM } from './subtitleBlockDom';

describe('createSubtitleBlockDOM', () => {
  it('creates subtitle block with cluster, subtitle lines and right column', () => {
    const dom = createSubtitleBlockDOM();

    expect(dom.block.getAttribute('data-testid')).toBe('subtitle-block');
    expect(dom.block.getAttribute('role')).toBe('region');
    expect(dom.body.classList.contains('block-body')).toBe(true);

    expect(dom.clusterColumns.getAttribute('data-testid')).toBe('subtitle-block-cluster');
    expect(dom.subtitleColumn.getAttribute('data-testid')).toBe('subtitle-block-subtitles');
    expect(dom.targetLine.getAttribute('data-testid')).toBe('subtitle-target-line');
    expect(dom.nativeLine.getAttribute('data-testid')).toBe('subtitle-native-line');

    expect(dom.rightColumn.classList.contains('block-right-column')).toBe(true);
  });

  it('places generate-native button last in right column', () => {
    const dom = createSubtitleBlockDOM();

    const children = Array.from(dom.rightColumn.children);
    expect(children.length).toBe(3);
    expect(children[0]).toBe(dom.quickUpdateBtn);
    expect(children[1]).toBe(dom.editCardBtn);
    expect(children[2]).toBe(dom.generateNativeBtn);
  });

  it('generate-native button uses cluster-btn class, testid and accessible label', () => {
    const dom = createSubtitleBlockDOM();

    expect(dom.generateNativeBtn.classList.contains('cluster-btn')).toBe(true);
    expect(dom.generateNativeBtn.getAttribute('data-testid')).toBe('generate-native');
    expect(dom.generateNativeBtn.getAttribute('aria-label')).toBe('Generate native subtitle');
    expect(dom.generateNativeBtn.getAttribute('title')).toBe('Generate native subtitle (G)');
    expect(dom.generateNativeBtn.type).toBe('button');
  });

  it('generate-native button contains an SVG icon with cluster style contract', () => {
    const dom = createSubtitleBlockDOM();
    const svg = dom.generateNativeBtn.querySelector('svg');

    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('fill')).toBe('none');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');

    // stroke is on the <svg> root (ICON_CATALOG convention) — inherited by children
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });
});
