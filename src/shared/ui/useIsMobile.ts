import { useEffect, useState } from 'react';
import { BREAKPOINTS } from '@/shared/lib/tokens';

/** Minimal matchMedia hook — returns true when viewport < breakpoint. */
export function useIsMobile(breakpoint: number = BREAKPOINTS.medium): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (): void => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
}
