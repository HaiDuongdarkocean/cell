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

  it('right column has 2 sub-columns with correct buttons (ADR-027)', () => {
    const dom = createSubtitleBlockDOM();

    // Right column contains: primary column + secondary column (popover is
    // inside primary — absolute positioned to the left of it)
    const children = Array.from(dom.rightColumn.children);
    expect(children.length).toBe(2);
    expect(children[0]).toBe(dom.rightColPrimary);
    expect(children[1]).toBe(dom.rightColSecondary);

    // Primary column: quick add, edit card, more button, more popover
    const primaryChildren = Array.from(dom.rightColPrimary.children);
    expect(primaryChildren.length).toBe(4);
    expect(primaryChildren[0]).toBe(dom.quickUpdateBtn);
    expect(primaryChildren[1]).toBe(dom.editCardBtn);
    expect(primaryChildren[2]).toBe(dom.moreBtn);
    expect(primaryChildren[3]).toBe(dom.morePopover);

    // Secondary column: update current card, generate native, manager icon slot
    const secondaryChildren = Array.from(dom.rightColSecondary.children);
    expect(secondaryChildren.length).toBe(3);
    expect(secondaryChildren[0]).toBe(dom.updateCurrentCardBtn);
    expect(secondaryChildren[1]).toBe(dom.generateNativeBtn);
    expect(secondaryChildren[2]).toBe(dom.managerIconSlot);
  });

  it('more button has chevron-left icon, testid and accessible label', () => {
    const dom = createSubtitleBlockDOM();

    expect(dom.moreBtn.classList.contains('cluster-btn')).toBe(true);
    expect(dom.moreBtn.getAttribute('data-testid')).toBe('right-col-more');
    expect(dom.moreBtn.getAttribute('aria-label')).toBe('More tools');
    expect(dom.moreBtn.getAttribute('aria-expanded')).toBe('false');
    expect(dom.moreBtn.getAttribute('aria-haspopup')).toBe('true');
    expect(dom.moreBtn.type).toBe('button');
  });

  it('more popover has slots for panel-toggle and import-button', () => {
    const dom = createSubtitleBlockDOM();

    expect(dom.morePopover.classList.contains('more-popover')).toBe(true);
    const slots = Array.from(dom.morePopover.children);
    expect(slots.length).toBe(2);
    expect(slots[0]).toBe(dom.panelToggleSlot);
    expect(slots[1]).toBe(dom.importButtonSlot);
  });

  it('update current card button uses cluster-btn class, testid and accessible label', () => {
    const dom = createSubtitleBlockDOM();

    expect(dom.updateCurrentCardBtn.classList.contains('cluster-btn')).toBe(true);
    expect(dom.updateCurrentCardBtn.getAttribute('data-testid')).toBe('card-creator-update-current');
    expect(dom.updateCurrentCardBtn.getAttribute('aria-label')).toBe('Update current card');
    expect(dom.updateCurrentCardBtn.type).toBe('button');
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

  it('cluster column B has rewind, play-pause, forward buttons in order', () => {
    const dom = createSubtitleBlockDOM();
    const children = Array.from(dom.clusterColumnB.children);

    expect(children.length).toBe(3);
    expect(children[0]).toBe(dom.rewindBtn);
    expect(children[1]).toBe(dom.playPauseBtn);
    expect(children[2]).toBe(dom.forwardBtn);
  });

  it('play-pause button has correct testid, label and play icon', () => {
    const dom = createSubtitleBlockDOM();

    expect(dom.playPauseBtn.classList.contains('cluster-btn')).toBe(true);
    expect(dom.playPauseBtn.getAttribute('data-testid')).toBe('cluster-play-pause');
    expect(dom.playPauseBtn.getAttribute('aria-label')).toBe('Play or pause video');
    expect(dom.playPauseBtn.type).toBe('button');

    const svg = dom.playPauseBtn.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });
});
