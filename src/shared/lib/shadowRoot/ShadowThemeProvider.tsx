import { type ReactNode } from 'react';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';

interface ShadowThemeProviderProps {
  /**
   * Inner DOM element inside the shadow root where theme tokens and
   * `data-theme` are applied. This should be the same element the React tree
   * is rendered into so `[data-theme]` selectors inside the shadow style match
   * and component tokens re-resolve against the active palette.
   */
  container: HTMLElement;
  /** Children rendered inside the shadow root. */
  children: ReactNode;
}

/**
 * Theme provider for React trees mounted inside a shadow root.
 *
 * Wraps the popup/sidepanel `ThemeProvider` and tells it to apply CSS vars
 * and `data-theme` onto the inner shadow container instead of the document
 * root, so tokens resolve correctly within the shadow boundary.
 */
export function ShadowThemeProvider({ container, children }: ShadowThemeProviderProps): React.JSX.Element {
  return (
    <ThemeProvider container={container}>
      {children}
    </ThemeProvider>
  );
}
