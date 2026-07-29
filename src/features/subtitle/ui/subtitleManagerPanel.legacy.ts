/**
 * Item displayed in the Subtitle Manager Panel (ADR-015).
 * Can be auto-detected, imported, or machine-translated, target or native.
 */
import { ICON_CATALOG } from '@/shared/icons';
import { mountToWatchVideo } from './netflixPlayback';

export interface SubtitlePanelItem {
  readonly id: string;
  readonly name: string; // Display name (e.g. "English #2" or "my-subtitle")
  readonly format: string; // srt/vtt/ass
  readonly size?: number; // bytes
  readonly source: 'auto' | 'imported' | 'translated';
  readonly role: 'target' | 'native';
  readonly index: number; // position within role section
  readonly isAsr?: boolean; // ADR-020: YouTube auto-generated captions badge
}

/**
 * Subtitle Manager Panel API (ADR-015 / ADR-027).
 * ADR-027: toolbar removed — icon is appended to the subtitle block's
 * secondary column slot by the caller. Panel dialog stays in container.
 */
export interface SubtitleManagerPanel {
  readonly icon: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  readonly open: () => void;
  readonly close: () => void;
  readonly updateTarget: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly updateNative: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly destroy: () => void;
}

// SVG path data from ICON_CATALOG. Sizing style injected per-use (65% / space-3 / space-4).
const ICON_SVG = ICON_CATALOG.subtitleManager.svg.replace('<svg ', '<svg style="width:65% !important;height:65% !important;display:block;fill:none !important" ');
const CLOSE_SVG = ICON_CATALOG.x.svg.replace('<svg ', '<svg style="width:var(--space-3) !important;height:var(--space-3) !important;display:block;fill:none !important" ');
const CHEVRON_SVG = ICON_CATALOG.chevronDown.svg.replace('<svg ', '<svg style="width:var(--space-4) !important;height:var(--space-4) !important;display:block;fill:none !important" ');

/**
 * Create the unified Subtitle Manager Panel (ADR-015 V2 / UI v4 / ADR-027).
 *
 * ADR-027: No longer creates a top-left toolbar. The manager icon is returned
 * for the caller to append into the subtitle block's secondary column slot.
 * The panel dialog is appended to container (above Netflix overlays).
 *
 * @param container - Video wrapper (panel appended here)
 * @param options - onSelect callback, section labels
 * @returns Panel API (icon + panel, NO toolbar/importButton)
 */
export function createSubtitleManagerPanel(
  container: HTMLElement,
  options: {
    targetLabel?: string;
    nativeLabel?: string;
    onSelect?: (role: 'target' | 'native', index: number) => void;
  } = {},
): SubtitleManagerPanel {
  const targetLabel = options.targetLabel ?? 'Target';
  const nativeLabel = options.nativeLabel ?? 'Native';
  const onSelect = options.onSelect;

  // === Manager icon (returned to caller — appended to subtitle block slot) ===
  const icon = document.createElement('button');
  icon.setAttribute('type', 'button');
  icon.setAttribute('data-testid', 'subtitle-manager-icon');
  icon.setAttribute('aria-label', 'Subtitle manager');
  icon.setAttribute('title', 'Open subtitle manager');
  icon.setAttribute('aria-expanded', 'false');
  icon.className = 'subtitle-manager-icon';
  icon.innerHTML = ICON_SVG;
  // Feathered backdrop — span mở rộng + blur 1px + mask radial fade
  const iconFeather = document.createElement('span');
  iconFeather.className = 'subtitle-manager-icon-feather';
  icon.appendChild(iconFeather);

  // === Panel (dialog) ===
  const panel = document.createElement('div');
  panel.setAttribute('data-testid', 'subtitle-manager-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Subtitle manager');
  panel.className = 'subtitle-manager-panel';
  container.appendChild(panel);
  // ADR-031: Netflix z-index fix — manager panel must sit above Netflix overlays.
  mountToWatchVideo(panel, container);

  // Panel header
  const header = document.createElement('div');
  header.className = 'subtitle-manager-header';
  const title = document.createElement('span');
  title.textContent = 'Subtitle Manager';
  title.className = 'subtitle-manager-title';
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('data-testid', 'subtitle-manager-close');
  closeBtn.setAttribute('aria-label', 'Close subtitle manager');
  closeBtn.setAttribute('title', 'Close subtitle manager');
  closeBtn.className = 'subtitle-manager-close';
  closeBtn.innerHTML = CLOSE_SVG;
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // State per section
  const state = {
    target: { items: [] as SubtitlePanelItem[], activeIndex: 0, expanded: true },
    native: { items: [] as SubtitlePanelItem[], activeIndex: 0, expanded: true },
  };

  // Section containers
  const targetSection = createSection(panel, 'target', targetLabel);
  const nativeSection = createSection(panel, 'native', nativeLabel);

  // === Helpers ===
  const roleLabel = (role: 'target' | 'native'): string =>
    role === 'target' ? targetLabel : nativeLabel;

  const renderSection = (role: 'target' | 'native'): void => {
    const section = role === 'target' ? targetSection : nativeSection;
    const { items, activeIndex } = state[role];
    const lang = items[activeIndex]?.name ? extractLanguageName(items[activeIndex].name) : '';
    section.count.textContent = `${items.length} subtitle${items.length === 1 ? '' : 's'}`;
    section.label.textContent = lang ? `${roleLabel(role)} · ${lang}` : roleLabel(role);
    section.body.innerHTML = '';

    items.forEach((item, index) => {
      const isActive = index === activeIndex;
      const row = document.createElement('div');
      row.setAttribute('role', 'option');
      row.setAttribute('data-testid', `manager-item-${role}-${index}`);
      row.setAttribute('aria-selected', String(isActive));
      row.setAttribute('title', `Select ${item.name}`);
      row.className = [
        'subtitle-manager-item',
        `subtitle-manager-item--${role}`,
        isActive ? 'subtitle-manager-item--active' : '',
      ].filter(Boolean).join(' ');

      // Radio dot
      const radio = document.createElement('span');
      radio.setAttribute('aria-hidden', 'true');
      radio.className = [
        'subtitle-manager-radio',
        `subtitle-manager-radio--${role}`,
        isActive ? 'subtitle-manager-radio--active' : '',
      ].filter(Boolean).join(' ');
      if (isActive) {
        const dot = document.createElement('span');
        dot.className = 'subtitle-manager-radio-dot';
        radio.appendChild(dot);
      }

      // Name + meta
      const textCol = document.createElement('div');
      textCol.className = 'subtitle-manager-item-text';
      const name = document.createElement('span');
      name.textContent = item.name;
      name.className = 'subtitle-manager-item-name';
      const meta = document.createElement('div');
      meta.className = 'subtitle-manager-item-meta';
      const formatBadge = document.createElement('span');
      formatBadge.textContent = item.format.toUpperCase();
      formatBadge.className = 'subtitle-manager-format-badge';
      meta.appendChild(formatBadge);
      // ADR-020: ASR badge for YouTube auto-generated captions.
      if (item.isAsr === true) {
        const asrBadge = document.createElement('span');
        asrBadge.textContent = 'AUTO';
        asrBadge.className = 'subtitle-manager-asr-badge';
        meta.appendChild(asrBadge);
      }
      if (item.size) {
        const size = document.createElement('span');
        size.textContent = formatBytes(item.size);
        meta.appendChild(size);
      }
      if (item.source === 'imported') {
        const imported = document.createElement('span');
        imported.textContent = 'Imported';
        imported.className = 'subtitle-manager-imported-badge';
        meta.appendChild(imported);
      }
      if (item.source === 'translated') {
        const translatedBadge = document.createElement('span');
        translatedBadge.textContent = 'TRANSLATED';
        translatedBadge.className = 'subtitle-manager-translated-badge';
        meta.appendChild(translatedBadge);
      }
      // Optional role indicator when item name doesn't obviously match section (imported/translated fallback)
      if ((item.source === 'imported' || item.source === 'translated') && !item.name.toLowerCase().startsWith(role)) {
        const roleInd = document.createElement('span');
        roleInd.textContent = `→ ${roleLabel(role)}`;
        roleInd.className = `subtitle-manager-role-indicator subtitle-manager-role-indicator--${role}`;
        meta.appendChild(roleInd);
      }
      textCol.appendChild(name);
      textCol.appendChild(meta);

      row.appendChild(radio);
      row.appendChild(textCol);

      row.addEventListener('click', () => {
        onSelect?.(role, index);
      });
      section.body.appendChild(row);
    });
  };

  const updateSection = (role: 'target' | 'native', items: SubtitlePanelItem[], activeIndex: number): void => {
    state[role].items = items;
    state[role].activeIndex = activeIndex < items.length ? activeIndex : Math.max(0, items.length - 1);
    renderSection(role);
  };

  const open = (): void => {
    panel.classList.add('subtitle-manager-panel--open');
    icon.setAttribute('aria-expanded', 'true');
    icon.classList.add('subtitle-manager-icon--active');
    renderSection('target');
    renderSection('native');
    bindOutsideClick();
  };

  const close = (): void => {
    panel.classList.remove('subtitle-manager-panel--open');
    icon.setAttribute('aria-expanded', 'false');
    icon.classList.remove('subtitle-manager-icon--active');
    unbindOutsideClick();
  };

  // Event listeners
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!panel.classList.contains('subtitle-manager-panel--open')) open();
    else close();
  });
  // Hover feedback handled by CSS :hover:not(.subtitle-manager-icon--active).
  // Focus ring handled by CSS :focus-visible (WCAG 2.4.7) — no JS outline.

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  const headerClick = (e: MouseEvent) => {
    const headerEl = e.currentTarget as HTMLElement;
    const role = headerEl.getAttribute('data-role') as 'target' | 'native';
    const section = role === 'target' ? targetSection : nativeSection;
    state[role].expanded = !state[role].expanded;
    section.body.style.display = state[role].expanded ? 'block' : 'none';
    section.header.setAttribute('aria-expanded', String(state[role].expanded));
    section.chevron.style.transform = state[role].expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
  };
  targetSection.header.addEventListener('click', headerClick);
  nativeSection.header.addEventListener('click', headerClick);

  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', escHandler);

  let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  const bindOutsideClick = (): void => {
    unbindOutsideClick();
    outsideClickHandler = (e: MouseEvent) => {
      if (!panel.classList.contains('subtitle-manager-panel--open')) return;
      const target = e.target as Node;
      if (!panel.contains(target) && !icon.contains(target)) {
        close();
      }
    };
    document.addEventListener('mousedown', outsideClickHandler);
  };
  const unbindOutsideClick = (): void => {
    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler);
      outsideClickHandler = null;
    }
  };

  const destroy = (): void => {
    close();
    document.removeEventListener('keydown', escHandler);
    unbindOutsideClick();
    panel.remove();
  };

  return {
    icon,
    panel,
    open,
    close,
    updateTarget: (items, activeIndex) => updateSection('target', items, activeIndex),
    updateNative: (items, activeIndex) => updateSection('native', items, activeIndex),
    destroy,
  };
}

function createSection(
  panel: HTMLElement,
  role: 'target' | 'native',
  label: string,
): { header: HTMLElement; body: HTMLElement; count: HTMLElement; label: HTMLElement; chevron: HTMLElement } {
  const section = document.createElement('div');
  section.setAttribute('data-testid', 'manager-section');
  section.setAttribute('data-role', role);
  panel.appendChild(section);

  const header = document.createElement('button');
  header.setAttribute('type', 'button');
  header.setAttribute('data-testid', 'manager-section-header');
  header.setAttribute('data-role', role);
  header.setAttribute('aria-expanded', 'true');
  header.setAttribute('aria-label', `Toggle ${label} section`);
  header.setAttribute('title', `Toggle ${label} section`);
  header.className = 'subtitle-manager-section-header';

  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = CHEVRON_SVG;
  chevron.className = 'subtitle-manager-section-chevron';
  header.appendChild(chevron);

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.className = `subtitle-manager-section-label subtitle-manager-section-label--${role}`;
  header.appendChild(labelEl);

  const count = document.createElement('span');
  count.className = 'subtitle-manager-section-count';
  count.textContent = '0 subtitles';
  header.appendChild(count);
  section.appendChild(header);

  const body = document.createElement('div');
  body.setAttribute('data-testid', 'manager-section-body');
  body.setAttribute('data-role', role);
  body.className = 'subtitle-manager-section-body';
  section.appendChild(body);

  return { header, body, count, label: labelEl, chevron };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function extractLanguageName(name: string): string {
  // "English #2" → "English"; "my-subtitle" → ""
  const match = name.match(/^([A-Za-z\s]+)\s*#/);
  return match ? match[1].trim() : '';
}
