import { createContext, useContext } from 'react';

export interface ShowcaseNavigationContextValue {
  navigateToShowcase: (title: string) => void;
}

export const ShowcaseNavigationContext = createContext<ShowcaseNavigationContextValue | null>(null);

export function useShowcaseNavigation(): ShowcaseNavigationContextValue {
  const ctx = useContext(ShowcaseNavigationContext);
  if (!ctx) {
    throw new Error('useShowcaseNavigation must be used within ShowcaseNavigationContext.Provider');
  }
  return ctx;
}
