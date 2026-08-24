import { useState, useId, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode, type Ref } from 'react';
import { IconButton } from './IconButton';
import { Icon } from '@/shared/icons/Icon';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  /** Sidebar content — typically NavItem elements with data-section-id. */
  children: ReactNode;
  /** Whether a collapse toggle is shown (desktop only). */
  collapsible?: boolean;
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Called when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Optional header content (desktop only). */
  header?: ReactNode;
  /** Optional accessible label for the nav region. */
  ariaLabel?: string;
  /** Controlled active section id. If omitted, Sidebar manages internally. */
  activeId?: string;
  /** Called when active section changes (click or scroll-spy). */
  onActiveChange?: (id: string) => void;
  /** Content scroll container ref — required for scroll-spy + click-to-scroll. */
  contentRef?: Ref<HTMLElement>;
  /** Section refs map — consumer provides refs to content sections for scroll-spy. */
  sectionRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
  /** Optional class name. */
  className?: string;
}

/**
 * Sidebar — responsive navigation container with floating active indicator.
 *
 * - Mobile (<768px): horizontal scrollable tab bar at top.
 * - Desktop (>=768px): vertical sidebar on left, optionally collapsible
 *   to icon-only width.
 * - Owns: active state, floating bg animation (rAF), scroll-spy, scroll-to-active.
 * - Consumer provides: contentRef + sectionRefs for scroll-spy integration.
 *
 * Children should be `NavItem` elements with `data-section-id` attribute.
 * Sidebar injects `aria-current` + click handler via event delegation —
 * consumer does NOT need to pass active/onClick to each NavItem.
 */
export function Sidebar({
  children,
  collapsible,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  header,
  ariaLabel,
  activeId: controlledActiveId,
  onActiveChange,
  contentRef,
  sectionRefs,
  className,
}: SidebarProps): React.JSX.Element {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const [internalActiveId, setInternalActiveId] = useState<string>('');
  const activeId = controlledActiveId !== undefined ? controlledActiveId : internalActiveId;
  const id = useId();
  const navRef = useRef<HTMLElement>(null);
  const clickScrollingRef = useRef(false);

  const setActiveId = useCallback((nextId: string): void => {
    if (controlledActiveId === undefined) setInternalActiveId(nextId);
    onActiveChange?.(nextId);
  }, [controlledActiveId, onActiveChange]);

  // Auto-scroll sidebar to keep active item visible.
  // Detects horizontal (mobile) vs vertical (desktop) scroll direction.
  const scrollSidebarToId = useCallback((sectionId: string): void => {
    const nav = navRef.current;
    if (!nav) return;
    const item = nav.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
    if (!item) return;
    const navStyle = window.getComputedStyle(nav);
    const isHorizontal = navStyle.flexDirection === 'row' && (navStyle.overflowX === 'auto' || navStyle.overflowX === 'scroll');
    if (isHorizontal) {
      const pad = 8;
      const itemLeft = item.offsetLeft - nav.offsetLeft;
      const itemRight = itemLeft + item.offsetWidth;
      const viewLeft = nav.scrollLeft;
      const viewRight = viewLeft + nav.clientWidth;
      if (itemLeft < viewLeft + pad) {
        nav.scrollTo({ left: Math.max(0, itemLeft - pad), behavior: 'smooth' });
      } else if (itemRight > viewRight - pad) {
        nav.scrollTo({ left: itemRight - nav.clientWidth + pad, behavior: 'smooth' });
      }
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
  }, []);

  // Scroll sidebar on activeId change.
  useLayoutEffect(() => {
    if (activeId) scrollSidebarToId(activeId);
  }, [activeId, scrollSidebarToId]);

  // Sync aria-current on children + set floating bg CSS vars in one pass.
  // Must run together: set aria-current FIRST, then query [aria-current="true"]
  // to get correct element — otherwise stale DOM returns previous active item.
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
      nav.style.setProperty('--active-y', `${active.offsetTop}px`);
      nav.style.setProperty('--active-h', `${active.offsetHeight}px`);
    }
  }, [activeId, collapsed, children]);

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
      for (const [id, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
        const dist = Math.abs(top);
        if (dist < bestDist) { bestDist = dist; bestId = id; }
      }
      if (bestId) {
        setActiveId(bestId);
        scrollSidebarToId(bestId);
      }
    };
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => root.removeEventListener('scroll', onScroll);
  }, [contentRef, sectionRefs, setActiveId, scrollSidebarToId]);

  const toggle = (): void => {
    const next = !collapsed;
    if (controlledCollapsed === undefined) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  // Click-driven: rAF bg animation + content scroll + observer suppress.
  const handleItemClick = (sectionId: string): void => {
    const nav = navRef.current;
    const root = (contentRef as React.RefObject<HTMLElement> | undefined)?.current;
    const target = sectionRefs?.current[sectionId];
    if (!nav || !root || !target) {
      setActiveId(sectionId);
      return;
    }
    clickScrollingRef.current = true;
    nav.setAttribute('data-animating', '');
    const startScroll = root.scrollTop;
    const endScroll = target.offsetTop - root.offsetTop;
    const activeEl = nav.querySelector('[aria-current="true"]') as HTMLElement | null;
    const targetEl = nav.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
    const distance = Math.abs(endScroll - startScroll);
    const duration = Math.min(Math.max(distance * 0.3, 200), 800);
    const startTime = performance.now();
    const animate = (now: number): void => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const startY = activeEl ? activeEl.offsetTop : 0;
      const endY = targetEl ? targetEl.offsetTop : startY;
      const y = startY + (endY - startY) * eased;
      nav.style.setProperty('--active-y', `${y}px`);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        nav.style.setProperty('--active-y', `${endY}px`);
        nav.style.setProperty('--active-h', `${targetEl?.offsetHeight ?? 40}px`);
        nav.removeAttribute('data-animating');
        setActiveId(sectionId);
      }
    };
    requestAnimationFrame(animate);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scrollSidebarToId(sectionId);
    // Unlock observer only after content scroll fully settles.
    // Poll scroll position — if stable for 150ms, scroll is done.
    // scrollend event fires too early when scrollIntoView triggers
    // nested scroll containers (iframe + mainCol).
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
    // Start polling after content scroll likely done (rAF + scrollIntoView).
    // scrollIntoView smooth can take 2-3x longer than rAF bg animation.
    window.setTimeout(() => requestAnimationFrame(pollScroll), Math.max(duration * 2, 1200));
  };

  // Event delegation: nav click → find [data-section-id] → handleItemClick.
  const handleNavClick = (e: React.MouseEvent<HTMLElement>): void => {
    const target = (e.target as HTMLElement).closest('[data-section-id]') as HTMLElement | null;
    if (!target) return;
    const sectionId = target.getAttribute('data-section-id');
    if (sectionId) handleItemClick(sectionId);
  };

  return (
    <aside
      className={[styles.sidebar, collapsed ? styles.collapsed : '', className ?? ''].filter(Boolean).join(' ')}
      aria-expanded={!collapsed}
      data-collapsed={collapsed ? '' : undefined}
    >
      {(header || collapsible) && (
        <div className={styles.topbar}>
          {header && <div className={styles.header}>{header}</div>}
          {collapsible && (
            <IconButton
              type="button"
              aria-label={collapsed ? 'Expand sidebar to full' : 'Collapse sidebar to icons'}
              aria-controls={id}
              aria-expanded={!collapsed}
              variant="ghost"
              size="sm"
              onClick={toggle}
            >
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
            </IconButton>
          )}
        </div>
      )}
      <nav id={id} ref={navRef} className={styles.nav} aria-label={ariaLabel} onClick={handleNavClick}>
        {children}
      </nav>
    </aside>
  );
}
