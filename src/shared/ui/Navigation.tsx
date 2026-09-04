import {
  useState,
  useId,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type Ref,
} from 'react';
import { NavItem, type NavItemProps } from './NavItem';
import styles from './Navigation.module.css';

export type NavigationOrientation = 'vertical' | 'horizontal';

export interface NavigationProps {
  /** Navigation content — typically NavItem elements with data-section-id. */
  children: ReactNode;
  /** Layout orientation. Default: 'vertical'. */
  orientation?: NavigationOrientation;
  /** Controlled active section id. If omitted, Navigation manages internally. */
  activeId?: string;
  /** Called when active section changes (click or scroll-spy). */
  onActiveChange?: (id: string) => void;
  /** Content scroll container ref — required for scroll-spy + click-to-scroll. */
  contentRef?: Ref<HTMLElement>;
  /** Section refs map — consumer provides refs to content sections for scroll-spy. */
  sectionRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
  /** Accessible label for the navigation landmark. */
  ariaLabel?: string;
  /** Optional class name. */
  className?: string;
}

/**
 * Navigation — self-contained navigation organism with floating active pill animation (water-flow rAF).
 *
 * - Supports `orientation="vertical"` (sidebar/drawer) and `orientation="horizontal"` (tabs/chip-bar).
 * - Owns: active state, floating bg animation (rAF ease-in-out cubic), scroll-spy, scroll-to-active.
 * - Consumer provides: contentRef + sectionRefs for scroll-spy integration (optional).
 *
 * Children should be `NavItem` elements with `data-section-id` attribute.
 * Navigation injects `aria-current` + click handler via event delegation.
 */
export function Navigation({
  children,
  orientation = 'vertical',
  activeId: controlledActiveId,
  onActiveChange,
  contentRef,
  sectionRefs,
  ariaLabel,
  className,
}: NavigationProps): React.JSX.Element {
  const [internalActiveId, setInternalActiveId] = useState<string>('');
  const activeId = controlledActiveId !== undefined ? controlledActiveId : internalActiveId;
  const id = useId();
  const navRef = useRef<HTMLElement>(null);
  const clickScrollingRef = useRef(false);

  const setActiveId = useCallback(
    (nextId: string): void => {
      if (controlledActiveId === undefined) setInternalActiveId(nextId);
      onActiveChange?.(nextId);
    },
    [controlledActiveId, onActiveChange],
  );

  // Auto-scroll navigation container to keep active item in view.
  const scrollNavToId = useCallback(
    (sectionId: string): void => {
      const nav = navRef.current;
      if (!nav) return;
      const item = nav.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
      if (!item) return;

      if (orientation === 'horizontal') {
        const itemCenter = item.offsetLeft - nav.offsetLeft + item.offsetWidth / 2;
        const ideal = itemCenter - nav.clientWidth / 2;
        const clamped = Math.max(0, Math.min(ideal, nav.scrollWidth - nav.clientWidth));
        nav.scrollTo({ left: clamped, behavior: 'smooth' });
      } else {
        const itemTop = item.offsetTop - nav.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        const viewTop = nav.scrollTop;
        const viewBottom = viewTop + nav.clientHeight;
        if (itemTop < viewTop) {
          nav.scrollTo({ top: itemTop, behavior: 'smooth' });
        } else if (itemBottom > viewBottom) {
          nav.scrollTo({ top: itemBottom - nav.clientHeight, behavior: 'smooth' });
        }
      }
    },
    [orientation],
  );

  // Scroll nav container when activeId changes.
  useLayoutEffect(() => {
    if (activeId) scrollNavToId(activeId);
  }, [activeId, scrollNavToId]);

  // Sync aria-current on children + update floating pill CSS custom properties.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    nav.querySelectorAll('[data-section-id]').forEach((el) => {
      const sectionId = el.getAttribute('data-section-id');
      if (sectionId === activeId) {
        el.setAttribute('aria-current', 'true');
      } else {
        el.removeAttribute('aria-current');
      }
    });

    const active = nav.querySelector('[aria-current="true"]') as HTMLElement | null;
    if (active) {
      if (orientation === 'horizontal') {
        nav.style.setProperty('--active-x', `${active.offsetLeft}px`);
        nav.style.setProperty('--active-w', `${active.offsetWidth}px`);
      } else {
        nav.style.setProperty('--active-y', `${active.offsetTop}px`);
        nav.style.setProperty('--active-h', `${active.offsetHeight}px`);
      }
    }
  }, [activeId, orientation, children]);

  // Scroll-spy: on content scroll, find section closest to viewport top.
  useEffect(() => {
    const content = contentRef as React.RefObject<HTMLElement> | undefined;
    const root = content?.current;
    if (!root || !sectionRefs) return;

    let ticking = false;
    const update = (): void => {
      if (clickScrollingRef.current) return;
      let bestId = '';
      let bestDist = Infinity;
      for (const [sId, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
        const dist = Math.abs(top);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = sId;
        }
      }
      if (bestId) {
        setActiveId(bestId);
        scrollNavToId(bestId);
      }
    };

    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => root.removeEventListener('scroll', onScroll);
  }, [contentRef, sectionRefs, setActiveId, scrollNavToId]);

  // Click-driven: rAF floating indicator animation + content scroll + observer suppression.
  const handleItemClick = (sectionId: string): void => {
    const nav = navRef.current;
    const root = (contentRef as React.RefObject<HTMLElement> | undefined)?.current;
    const target = sectionRefs?.current[sectionId];

    setActiveId(sectionId);

    if (!nav) return;

    const activeEl = nav.querySelector('[aria-current="true"]') as HTMLElement | null;
    const targetEl = nav.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;

    if (!root || !target) {
      // Standalone navigation without linked content container
      if (activeEl && targetEl && typeof requestAnimationFrame !== 'undefined') {
        nav.setAttribute('data-animating', '');
        const duration = 200;
        const startTime = performance.now();

        const animate = (now: number): void => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          if (orientation === 'horizontal') {
            const startX = activeEl.offsetLeft;
            const endX = targetEl.offsetLeft;
            const x = startX + (endX - startX) * eased;
            nav.style.setProperty('--active-x', `${x}px`);
          } else {
            const startY = activeEl.offsetTop;
            const endY = targetEl.offsetTop;
            const y = startY + (endY - startY) * eased;
            nav.style.setProperty('--active-y', `${y}px`);
          }

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            if (orientation === 'horizontal') {
              nav.style.setProperty('--active-x', `${targetEl.offsetLeft}px`);
              nav.style.setProperty('--active-w', `${targetEl.offsetWidth}px`);
            } else {
              nav.style.setProperty('--active-y', `${targetEl.offsetTop}px`);
              nav.style.setProperty('--active-h', `${targetEl.offsetHeight}px`);
            }
            nav.removeAttribute('data-animating');
          }
        };
        requestAnimationFrame(animate);
      }
      return;
    }

    clickScrollingRef.current = true;
    nav.setAttribute('data-animating', '');
    const startScroll = root.scrollTop;
    const endScroll = target.offsetTop - root.offsetTop;
    const distance = Math.abs(endScroll - startScroll);
    const duration = Math.min(Math.max(distance * 0.3, 200), 800);
    const startTime = performance.now();

    const animate = (now: number): void => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      if (orientation === 'horizontal') {
        const startX = activeEl ? activeEl.offsetLeft : 0;
        const endX = targetEl ? targetEl.offsetLeft : startX;
        const x = startX + (endX - startX) * eased;
        nav.style.setProperty('--active-x', `${x}px`);
      } else {
        const startY = activeEl ? activeEl.offsetTop : 0;
        const endY = targetEl ? targetEl.offsetTop : startY;
        const y = startY + (endY - startY) * eased;
        nav.style.setProperty('--active-y', `${y}px`);
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        if (orientation === 'horizontal') {
          nav.style.setProperty('--active-x', `${targetEl?.offsetLeft ?? 0}px`);
          nav.style.setProperty('--active-w', `${targetEl?.offsetWidth ?? 40}px`);
        } else {
          nav.style.setProperty('--active-y', `${targetEl?.offsetTop ?? 0}px`);
          nav.style.setProperty('--active-h', `${targetEl?.offsetHeight ?? 40}px`);
        }
        nav.removeAttribute('data-animating');
        setActiveId(sectionId);
      }
    };

    requestAnimationFrame(animate);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scrollNavToId(sectionId);

    // Unlock scroll-spy once content scroll settles
    let lastScroll = -1;
    let stableCount = 0;
    const pollScroll = (): void => {
      const current = root.scrollTop;
      if (current === lastScroll) {
        stableCount++;
        if (stableCount >= 3) {
          clickScrollingRef.current = false;
          return;
        }
      } else {
        stableCount = 0;
        lastScroll = current;
      }
      requestAnimationFrame(pollScroll);
    };

    window.setTimeout(() => requestAnimationFrame(pollScroll), Math.max(duration * 2, 1200));
  };

  // Event delegation: click on nav captures [data-section-id]
  const handleNavClick = (e: React.MouseEvent<HTMLElement>): void => {
    const target = (e.target as HTMLElement).closest('[data-section-id]') as HTMLElement | null;
    if (!target) return;
    const sectionId = target.getAttribute('data-section-id');
    if (sectionId) handleItemClick(sectionId);
  };

  const navClasses = [
    styles.nav,
    orientation === 'horizontal' ? styles.horizontal : styles.vertical,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const orientedChildren = Children.map(children, (child) => {
    if (isValidElement<NavItemProps>(child) && child.type === NavItem) {
      return cloneElement(child, { orientation });
    }
    return child;
  });

  return (
    <nav id={id} ref={navRef} className={navClasses} aria-label={ariaLabel} onClick={handleNavClick}>
      {orientedChildren}
    </nav>
  );
}
