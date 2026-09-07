import { applyTheme, resolveMode, registerSystemModeListener, getPalette } from '@/features/theme/logic/themeManager';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import type { ThemeConfig } from '@/entities/theme';

// jsdom provides window.matchMedia but cần mock (jsdom default returns false matches).
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  }
});

beforeEach(() => {
  document.documentElement.style.cssText = '';
  document.documentElement.removeAttribute('data-theme');
});

describe('themeManager', () => {
  describe('resolveMode', () => {
    it('returns light/dark as-is', () => {
      expect(resolveMode('light')).toBe('light');
      expect(resolveMode('dark')).toBe('dark');
    });
    it('resolves system via matchMedia (dark)', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
      expect(resolveMode('system')).toBe('dark');
    });
    it('resolves system via matchMedia (light)', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
      expect(resolveMode('system')).toBe('light');
    });
  });

  describe('applyTheme', () => {
    it('sets 9 core CSS vars on :root for dark', () => {
      applyTheme('dark', DEFAULT_THEME_CONFIG);
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--color-primary')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.primary);
      expect(root.style.getPropertyValue('--color-background')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.background);
      expect(root.style.getPropertyValue('--color-surface')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.surface);
      expect(root.style.getPropertyValue('--color-text')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.text);
      expect(root.style.getPropertyValue('--color-text-secondary')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.textSecondary);
      expect(root.style.getPropertyValue('--color-border')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.border);
      expect(root.style.getPropertyValue('--color-success')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.success);
      expect(root.style.getPropertyValue('--color-warning')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.warning);
      expect(root.style.getPropertyValue('--color-error')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.error);
    });

    it('sets 9 core CSS vars for light', () => {
      applyTheme('light', DEFAULT_THEME_CONFIG);
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(DEFAULT_THEME_CONFIG.customColors.light.primary);
    });

    it('derives secondary tokens', () => {
      applyTheme('dark', DEFAULT_THEME_CONFIG);
      const root = document.documentElement;
      // Dawn preset uses hand-tuned derived values from tokens.json
      expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#5EA5E9');
      expect(root.style.getPropertyValue('--color-border-focus')).toBe(
        DEFAULT_THEME_CONFIG.customColors.dark.primary,
      );
      expect(root.style.getPropertyValue('--color-primary-subtle')).toBe(
        'rgba(106,178,245,0.12)',
      );
    });

    it('sets data-theme attribute', () => {
      applyTheme('dark', DEFAULT_THEME_CONFIG);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      applyTheme('light', DEFAULT_THEME_CONFIG);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('overrides previous vars on re-apply (no stale)', () => {
      const custom: ThemeConfig = {
        preset: 'dawn',
        customColors: {
          light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#ff0000' },
          dark: DEFAULT_THEME_CONFIG.customColors.dark,
        },
      };
      applyTheme('light', custom);
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#ff0000');
      applyTheme('light', DEFAULT_THEME_CONFIG);
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(DEFAULT_THEME_CONFIG.customColors.light.primary);
    });
  });

  describe('registerSystemModeListener', () => {
    it('registers + cleanup removes listener', () => {
      const addEventListener = jest.fn();
      const removeEventListener = jest.fn();
      window.matchMedia = jest.fn().mockReturnValue({
        matches: false,
        addEventListener,
        removeEventListener,
      }) as unknown as typeof window.matchMedia;
      const cleanup = registerSystemModeListener(jest.fn());
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      cleanup();
      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('getPalette', () => {
    it('returns palette for mode', () => {
      expect(getPalette(DEFAULT_THEME_CONFIG, 'dark')).toEqual(DEFAULT_THEME_CONFIG.customColors.dark);
      expect(getPalette(DEFAULT_THEME_CONFIG, 'light')).toEqual(DEFAULT_THEME_CONFIG.customColors.light);
    });
  });
});


