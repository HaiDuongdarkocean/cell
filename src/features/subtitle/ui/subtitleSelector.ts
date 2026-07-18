import type { DetectedSubtitle } from '@/entities/media';
import { ICON_CATALOG } from '@/shared/icons';
import { languageMatches } from '@/shared/config/languageRegistry';
import { formatSubtitleName } from '../logic/subtitleNaming';

/**
 * Subtitle selector dropdown for overlay (ADR-014 D3, V2 of ADR-007 D3).
 *
 * ADR-015: refactored to support `updateSubtitleDropdown` (update-in-place)
 * for bug #5 fix — no destroy/re-create on auto-load push, no flicker.
 *
 * When ≥2 subtitles share the same language, render a dropdown icon at
 * top-right of the video container. Click → popover list of matching subs
 * (cue count + format), highlight active. Click outside / Esc / select → close.
 *
 * Only 1 dropdown open at a time (clicking dropdown #2 closes dropdown #1).
 * Icon position: absolute top-right container (not overlay) — avoids covering
 * subtitle text. z-index = overlay z-index + 1.
 *
 * @param role - 'target' | 'native' (for data-testid + aria-label)
 * @param container - Video wrapper (icon appended here, position absolute)
 * @param subtitles - All detected subtitles (filters by language internally)
 * @param language - Language code to filter (case-insensitive)
 * @param activeIndex - Currently active sub index (highlighted in popover)
 * @param onSelect - Callback with chosen sub index (0-based into filtered matches)
 * @returns { icon, destroy, update } — icon button + cleanup + in-place updater
 */
export function createSubtitleDropdown(
  role: 'target' | 'native',
  container: HTMLElement,
  subtitles: DetectedSubtitle[],
  language: string,
  activeIndex: number,
  onSelect: (index: number) => void,
): { icon: HTMLButtonElement; destroy: () => void; update: (newSubtitles: DetectedSubtitle[], newActiveIndex: number) => void } {
  let matches = subtitles.filter(
    (s) => languageMatches(language, s.language),
  );
  let currentActiveIndex = activeIndex;

  // V1 behavior: only 1 match → no dropdown needed
  if (matches.length < 2) {
    const noop = document.createElement('button');
    noop.style.display = 'none';
    return {
      icon: noop,
      destroy: () => noop.remove(),
      update: () => { /* noop — never had a real dropdown */ },
    };
  }

  const icon = document.createElement('button');
  icon.setAttribute('type', 'button');
  icon.setAttribute('data-testid', `subtitle-selector-${role}`);
  icon.setAttribute('aria-label', `Select ${role} subtitle`);
  icon.setAttribute('aria-haspopup', 'listbox');
  icon.setAttribute('aria-expanded', 'false');
  icon.className = 'subtitle-selector-icon';

  // chevron-down SVG (Lucide-style) — path data from ICON_CATALOG.chevronDown
  icon.innerHTML = ICON_CATALOG.chevronDown.svg.replace(
    '<svg ',
    '<svg width="16" height="16" style="display:block;fill:none !important" ',
  );

  let popover: HTMLDivElement | null = null;
  let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  let escHandler: ((e: KeyboardEvent) => void) | null = null;

  const closePopover = (): void => {
    if (popover) {
      popover.remove();
      popover = null;
    }
    icon.setAttribute('aria-expanded', 'false');
    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler);
      outsideClickHandler = null;
    }
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
    // Notify global registry (only 1 dropdown open at a time)
    activeDropdown = null;
  };

  const renderItems = (): void => {
    if (!popover) return;
    // Clear existing items (update-in-place — keep popover element, replace children)
    popover.innerHTML = '';
    matches.forEach((sub, index) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'option');
      item.setAttribute('data-testid', `subtitle-selector-item-${role}-${index}`);
      item.setAttribute('aria-selected', String(index === currentActiveIndex));
      item.className = `subtitle-selector-item${index === currentActiveIndex ? ' subtitle-selector-item--active' : ''}`;
      item.textContent = formatSubtitleName(
        'auto',
        sub.language,
        index,
        undefined,
        sub.displayName,
      );
      // ADR-020: render ASR badge for YouTube auto-generated captions.
      if (sub.isAsr === true) {
        const badge = document.createElement('span');
        badge.className = 'subtitle-selector-asr-badge';
        badge.textContent = 'auto';
        item.appendChild(badge);
      }
      const meta = document.createElement('span');
      meta.className = 'subtitle-selector-meta';
      meta.textContent = sub.format.toUpperCase();
      item.appendChild(meta);

      item.addEventListener('click', () => {
        onSelect(index);
        closePopover();
      });
      popover!.appendChild(item);
    });
  };

  const openPopover = (): void => {
    // Close any other open dropdown first (only 1 at a time)
    if (activeDropdown && activeDropdown !== closePopover) {
      activeDropdown();
    }

    popover = document.createElement('div');
    popover.setAttribute('data-testid', `subtitle-selector-popover-${role}`);
    popover.setAttribute('role', 'listbox');
    popover.className = 'subtitle-selector-popover';

    renderItems();
    container.appendChild(popover);
    icon.setAttribute('aria-expanded', 'true');

    // Close on click outside (mousedown fires before click on item)
    outsideClickHandler = (e: MouseEvent): void => {
      if (popover && !popover.contains(e.target as Node) && e.target !== icon) {
        closePopover();
      }
    };
    document.addEventListener('mousedown', outsideClickHandler);

    // Close on Esc
    escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closePopover();
      }
    };
    document.addEventListener('keydown', escHandler);

    // Register as active dropdown
    activeDropdown = closePopover;
  };

  const iconClickHandler = (e: MouseEvent): void => {
    e.stopPropagation();
    if (popover) {
      closePopover();
    } else {
      openPopover();
    }
  };
  icon.addEventListener('click', iconClickHandler);

  container.appendChild(icon);

  // ADR-015 T3: update-in-place — no destroy/re-create, no flicker (bug #5 fix)
  const update = (newSubtitles: DetectedSubtitle[], newActiveIndex: number): void => {
    matches = newSubtitles.filter(
      (s) => languageMatches(language, s.language),
    );
    // Clamp activeIndex to valid range (matches may have shrunk/reordered)
    currentActiveIndex = newActiveIndex < matches.length
      ? newActiveIndex
      : Math.max(0, matches.length - 1);
    if (popover) {
      renderItems(); // popover open → refresh list in-place
    }
    // If popover closed, next open will call renderItems() with fresh matches
  };

  return {
    icon,
    destroy: () => {
      closePopover();
      icon.removeEventListener('click', iconClickHandler);
      icon.remove();
    },
    update,
  };
}

/**
 * Global registry: only 1 dropdown open at a time (ADR-014 D3 spec).
 * Clicking dropdown #2 closes dropdown #1. `activeDropdown` = closePopover
 * function of currently-open dropdown, or null.
 */
let activeDropdown: (() => void) | null = null;
