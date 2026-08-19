import { useEffect, useState } from 'react';
import { BREAKPOINTS } from '@/shared/lib/tokens';

/** Minimal matchMedia hook — returns true when viewport < breakpoint. */
export function useIsMobile(breakpoint: number = BREAKPOINTS.tablet): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (): void => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
}
