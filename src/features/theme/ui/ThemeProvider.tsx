// ThemeProvider — boot theme system cho popup/sidepanel/options (ADR-022 D3).
//
// 1. themeStore.init() — load mode + config from storage (seed legacy settings.theme)
// 2. applyTheme(resolvedMode, config) — set :root CSS vars + data-theme attr
// 3. registerSystemModeListener — re-apply khi OS theme đổi (chỉ khi mode='system')
// 4. storage.onChanged listener — re-apply khi themeMode/themeConfig đổi từ nơi khác
//
// Content-script KHÔNG dùng ThemeProvider (isolated world) — dùng themeTokens.ts.

import { useEffect, useRef, type ReactNode } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { applyTheme, resolveMode, registerSystemModeListener } from '@/features/theme/logic/themeManager';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeConfig } from '@/entities/theme';

interface ThemeProviderProps {
  /** Children to wrap. */
  children: ReactNode;
  /**
   * Optional DOM element to apply theme tokens + `data-theme` onto.
   * Defaults to `document.documentElement`.
   */
  container?: HTMLElement;
}

const THEME_TRANSITION_MS = 300;

export function ThemeProvider({ children, container }: ThemeProviderProps): React.JSX.Element {
  const mode = useThemeStore((s) => s.mode);
  const config = useThemeStore((s) => s.config);
  const isLoaded = useThemeStore((s) => s.isLoaded);
  const init = useThemeStore((s) => s.init);
  const isFirstApply = useRef(true);
  const target = container ?? document.documentElement;

  // Boot: init store once.
  useEffect(() => {
    void init();
  }, [init]);

  // Apply theme whenever mode/config changes (after init).
  // Add a short transition class on subsequent changes so theme colors
  // animate smoothly while respecting prefers-reduced-motion.
  useEffect(() => {
    if (!isLoaded) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isFirstApply.current && !prefersReduced) {
      target.classList.add('theme-transitioning');
    }

    applyTheme(resolveMode(mode), config, target);

    if (isFirstApply.current) {
      isFirstApply.current = false;
      return;
    }

    if (prefersReduced) return;
    const timeout = setTimeout(() => target.classList.remove('theme-transitioning'), THEME_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [mode, config, isLoaded, target]);

  // System mode listener — re-apply when OS theme changes (only matters if mode='system').
  useEffect(() => {
    if (!isLoaded || mode !== 'system') return;
    const cleanup = registerSystemModeListener((resolved) => {
      applyTheme(resolved, useThemeStore.getState().config, target);
    });
    return cleanup;
  }, [mode, isLoaded, target]);

  // storage.onChanged — sync từ nơi khác (e.g. options page thay đổi, popup phải follow).
  useEffect(() => {
    if (!isLoaded) return;
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.THEME_MODE]?.newValue) {
        const newMode = changes[STORAGE_KEYS.THEME_MODE].newValue;
        if (newMode === 'light' || newMode === 'dark' || newMode === 'system') {
          useThemeStore.setState({ mode: newMode });
        }
      }
      if (changes[STORAGE_KEYS.THEME_CONFIG]?.newValue) {
        const newConfig = changes[STORAGE_KEYS.THEME_CONFIG].newValue as ThemeConfig;
        useThemeStore.setState({ config: newConfig });
      }
    };
    onStorageChanged(onChanged);
    return () => removeOnStorageChangedListener(onChanged);
  }, [isLoaded]);

  return <>{children}</>;
}
