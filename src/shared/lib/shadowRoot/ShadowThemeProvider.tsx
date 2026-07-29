import { type ReactNode } from 'react';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';

interface ShadowThemeProviderProps {
  /** The shadow host element where theme tokens + `data-theme` are applied. */
  host: HTMLElement;
  /** Children rendered inside the shadow root. */
  children: ReactNode;
}

/**
 * Theme provider for React trees mounted inside a shadow root.
 *
 * Wraps the popup/sidepanel `ThemeProvider` and tells it to apply CSS vars
 * and `data-theme` onto the shadow host instead of the document root, so
 * tokens resolve correctly within the shadow boundary.
 */
export function ShadowThemeProvider({ host, children }: ShadowThemeProviderProps): React.JSX.Element {
  return (
    <ThemeProvider container={host}>
      {children}
    </ThemeProvider>
  );
}
