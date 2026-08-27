import {
  applyMetadata,
  CANONICAL_META,
  getCategoryPriority,
  groupByLevelThenCategory,
  inferBasename,
  inferCategoryFromBasename,
  inferLevelFromPath,
  inferTitle,
  normalizeCategory,
} from '@/entrypoints/design-system-showcase/autoDiscovery.logic';

describe('autoDiscovery taxonomy inference', () => {
  describe('inferBasename', () => {
    it('extracts showcase basename', () => {
      expect(inferBasename('/src/shared/ui/Button.showcase.tsx')).toBe('Button');
    });

    it('extracts plain component basename', () => {
      expect(inferBasename('/src/shared/ui/Button.tsx')).toBe('Button');
    });
  });

  describe('inferTitle', () => {
    it('splits camelCase into title', () => {
      expect(inferTitle('/src/shared/ui/IconButton.tsx')).toBe('Icon Button');
    });
  });

  describe('inferLevelFromPath', () => {
    it.each([
      ['/src/shared/ui/Button.showcase.tsx', 'atoms'],
      ['/src/shared/domain/dictionary/atoms/Atom.showcase.tsx', 'atoms'],
      ['/src/features/cardCreator/ui/CardCreatorDialog.showcase.tsx', 'organisms'],
      ['/src/features/subtitle/molecules/SubtitleRow.showcase.tsx', 'molecules'],
      ['/src/features/subtitle/organisms/SubtitleManager.showcase.tsx', 'organisms'],
      ['/src/entrypoints/design-system-showcase/pages/PopupPage.showcase.tsx', 'pages'],
      ['/src/entrypoints/design-system-showcase/templates/PageShell.showcase.tsx', 'templates'],
    ])('infers %s as %s', (path, expected) => {
      expect(inferLevelFromPath(path)).toBe(expected);
    });
  });

  describe('inferCategoryFromBasename', () => {
    it.each([
      ['Button', 'Action'],
      ['IconButton', 'Action'],
      ['NavItem', 'Navigation'],
      ['Input', 'Input'],
      ['SearchField', 'Input'],
      ['Dialog', 'Overlay'],
      ['BottomSheet', 'Overlay'],
      ['Tabs', 'Navigation'],
      ['Alert', 'Feedback'],
      ['Card', 'Display'],
      ['Avatar', 'Content'],
      ['Text', 'Content'],
      ['Transition', 'Utility'],
      ['UnknownComponent', undefined],
    ])('infers %s as %s', (name, expected) => {
      expect(inferCategoryFromBasename(name)).toBe(expected);
    });
  });

  describe('normalizeCategory', () => {
    it('normalizes aliases to canonical categories', () => {
      expect(normalizeCategory('molecules', 'Shared UI — Input')).toBe('Input');
    });

    it('falls back to Other for unrecognized categories', () => {
      expect(normalizeCategory('atoms', 'Gibberish')).toBe('Other');
    });
  });

  describe('applyMetadata', () => {
    it('uses showcaseMeta first, then path inference as fallback', () => {
      const { meta } = applyMetadata('/src/shared/ui/Button.showcase.tsx', undefined, 'Button');
      expect(meta.level).toBe('atoms');
      expect(meta.category).toBe('Action');
      expect(meta.title).toBe('Button');
    });

    it('overrides with CANONICAL_META for hidden entries', () => {
      const { meta } = applyMetadata('/src/shared/ui/M3Tokens.showcase.tsx', undefined, 'M3Tokens');
      expect(meta.level).toBe('foundations');
      expect(meta.category).toBe('Archive');
      expect(meta.status).toBe('deprecated');
    });

    it('ignores CANONICAL_META level/category when showcaseMeta provides them', () => {
      const { meta } = applyMetadata(
        '/src/shared/ui/Button.showcase.tsx',
        { level: 'molecules', category: 'Input' },
        'Button',
      );
      expect(meta.level).toBe('molecules');
      expect(meta.category).toBe('Input');
    });

    it('classifies page components correctly', () => {
      const { meta } = applyMetadata('/src/entrypoints/design-system-showcase/pages/PopupPage.showcase.tsx', undefined, 'PopupPage');
      expect(meta.level).toBe('pages');
    });
  });

  describe('getCategoryPriority', () => {
    it('returns order index for known categories', () => {
      expect(getCategoryPriority('atoms', 'Action')).toBe(0);
      expect(getCategoryPriority('atoms', 'Other')).toBeGreaterThan(0);
    });
  });

  describe('groupByLevelThenCategory', () => {
    it('returns empty groups for all levels', () => {
      const grouped = groupByLevelThenCategory([]);
      expect(Object.keys(grouped)).toEqual(['foundations', 'atoms', 'molecules', 'organisms', 'templates', 'pages']);
    });
  });

  describe('CANONICAL_META', () => {
    it('only contains special-case overrides', () => {
      const keys = Object.keys(CANONICAL_META);
      expect(keys.length).toBeLessThanOrEqual(10);
      for (const key of keys) {
        const meta = CANONICAL_META[key];
        // Every override must be special: hidden, deprecated, or a title/level/category adjustment.
        const isSpecial =
          meta.hidden === true ||
          meta.status === 'deprecated' ||
          (meta.level !== undefined || meta.category !== undefined || meta.title !== undefined);
        expect(isSpecial).toBe(true);
      }
    });
  });
});
