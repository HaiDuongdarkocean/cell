import { SUBTITLE_BLOCK_CSS } from '@/features/subtitle/ui/subtitleBlockCss';

describe('SUBTITLE_BLOCK_CSS — overlay button press animation (ADR-026 overlay appearance)', () => {
  it('defines :active scale(0.88) for cluster buttons', () => {
    expect(SUBTITLE_BLOCK_CSS).toMatch(/\.cluster-btn:active\s*\{[^}]*transform:\s*scale\(0\.88\)/);
  });

  it('defines :active scale(0.88) for the 3 overlay icon buttons by data-testid', () => {
    const selectors = ['panel-toggle', 'subtitle-manager-icon', 'subtitle-import-button'];
    // The 3 selectors share one rule block — match each selector appears in a
    // :active rule block that contains transform: scale(0.88).
    const blockRe = /\[data-testid="(?:panel-toggle|subtitle-manager-icon|subtitle-import-button)"\]:active[\s\S]*?transform:\s*scale\(0\.88\)/;
    expect(SUBTITLE_BLOCK_CSS).toMatch(blockRe);
    for (const testid of selectors) {
      const re = new RegExp(`\\[data-testid="${testid}"\\]:active`);
      expect(SUBTITLE_BLOCK_CSS).toMatch(re);
    }
  });
});
