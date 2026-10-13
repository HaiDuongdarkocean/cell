import { useEffect, useRef } from 'react';

const SWALLOWED_EVENTS = [
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointercancel',
  'pointerover',
  'pointerout',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
  'touchstart',
  'touchmove',
  'touchend',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseover',
  'mouseout',
];

export interface LockShieldProps {
  className?: string;
}

/**
 * Transparent pointer shield for the interaction-lock state: covers the
 * video area with pointer-events:auto and swallows every input event so
 * host player controls/overlays underneath can never be hovered or
 * activated. Only Tihoka surfaces rendered above the shield stay interactive.
 */
export function LockShield({ className }: LockShieldProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event): void => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    for (const name of SWALLOWED_EVENTS) {
      el.addEventListener(name, block, { passive: false });
    }
    return () => {
      for (const name of SWALLOWED_EVENTS) {
        el.removeEventListener(name, block);
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      aria-hidden="true"
      data-tihoka-id="lock-shield"
    />
  );
}
