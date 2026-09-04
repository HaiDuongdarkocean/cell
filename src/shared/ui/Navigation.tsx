import { useState, useId, useRef, useEffect, useLayoutEffect, useCallback, Children, isValidElement, cloneElement, type ReactNode, type Ref } from 'react';
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
 * Navigation — self-contained navigation organism.
 *
 * - Supports `orientation="vertical"` (sidebar/drawer) and `orientation="horizontal"` (tabs/chip-bar).
 * - Owns: active state, scroll-spy, scroll-to-active.
 * - Consumer provides: contentRef + sectionRefs for scroll-spy integration (optional).
 *
 * Children should be `NavItem` elements with `data-section-id` attribute.
 * Navigation injects `aria-current`, `orientation`, and click handler via event delegation.
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

  // Sync aria-current on children and scroll nav container when activeId changes.
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

    if (activeId) scrollNavToId(activeId);
  }, [activeId, scrollNavToId]);

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
  }, [contentRef, sectionRefs, setActiveId]);

  // Click-driven: set active, scroll content, suppress scroll-spy while scrolling.
  const handleItemClick = (sectionId: string): void => {
    const root = (contentRef as React.RefObject<HTMLElement> | undefined)?.current;
    const target = sectionRefs?.current[sectionId];

    setActiveId(sectionId);

    if (!root || !target) {
      scrollNavToId(sectionId);
      return;
    }

    clickScrollingRef.current = true;
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

    window.setTimeout(() => requestAnimationFrame(pollScroll), 800);
  };

  // Event delegation: click on nav captures [data-section-id]
  const handleNavClick = (e: React.MouseEvent<HTMLElement>): void => {
    const target = (e.target as HTMLElement).closest('[data-section-id]') as HTMLElement | null;
    if (!target) return;
    const sectionId = target.getAttribute('data-section-id');
    if (sectionId) handleItemClick(sectionId);
  };

  const navClasses = [styles.nav, orientation === 'horizontal' ? styles.horizontal : styles.vertical, className ?? '']
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
