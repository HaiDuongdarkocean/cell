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
 * Subtitle Manager Panel API (ADR-015).
 */
export interface SubtitleManagerPanel {
  readonly toolbar: HTMLDivElement;
  readonly icon: HTMLButtonElement;
  readonly importButton: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  readonly open: () => void;
  readonly close: () => void;
  readonly updateTarget: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly updateNative: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly destroy: () => void;
}

// SVG path data from ICON_CATALOG. Sizing style injected per-use (65% / 12px / 16px).
const ICON_SVG = ICON_CATALOG.subtitleManager.svg.replace('<svg ', '<svg style="width:65% !important;height:65% !important;display:block;fill:none !important" ');
const CLOSE_SVG = ICON_CATALOG.x.svg.replace('<svg ', '<svg style="width:12px !important;height:12px !important;display:block;fill:none !important" ');
const CHEVRON_SVG = ICON_CATALOG.chevronDown.svg.replace('<svg ', '<svg style="width:16px !important;height:16px !important;display:block;fill:none !important" ');

/**
 * Create the unified Subtitle Manager Panel (ADR-015 V2 / UI v4).
 *
 * Replaces ADR-014 V1 separate dropdown icons with a single panel opened from a
 * manager icon. Panel has two collapsible sections (Target + Native), shows
 * active subtitle via radio highlight, and keeps the panel open after selection
 * so users can switch multiple times quickly.
 *
 * Matches docs/mockups/subtitle-selector-mockup.html.
 *
 * @param container - Video wrapper (toolbar + panel appended here)
 * @param importButton - Existing import button element (moved into toolbar)
 * @param options - onSelect callback, section labels
 * @returns Panel API
 */
export function createSubtitleManagerPanel(
  container: HTMLElement,
  importButton: HTMLButtonElement,
  options: {
    targetLabel?: string;
    nativeLabel?: string;
    onSelect?: (role: 'target' | 'native', index: number) => void;
  } = {},
): SubtitleManagerPanel {
  const targetLabel = options.targetLabel ?? 'Target';
  const nativeLabel = options.nativeLabel ?? 'Native';
  const onSelect = options.onSelect;

  // === Top-left toolbar ===
  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-testid', 'subtitle-toolbar');
  toolbar.style.cssText = `
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: var(--space-2, 8px);
    z-index: 1000001;
    pointer-events: none;
  `;
  container.appendChild(toolbar);
  // ADR-031: Netflix z-index fix — toolbar + panel both move to .watch-video.
  mountToWatchVideo(toolbar, container);

  // Move import button into toolbar (it was created elsewhere for lifecycle reasons).
  // Keep its relative positioning + overflow: hidden so the hidden file input stays
  // clipped inside the 32x32 button and does not overlap the manager icon.
  toolbar.appendChild(importButton);

  // === Manager icon ===
  const icon = document.createElement('button');
  icon.setAttribute('type', 'button');
  icon.setAttribute('data-testid', 'subtitle-manager-icon');
  icon.setAttribute('aria-label', 'Subtitle manager');
  icon.setAttribute('title', 'Open subtitle manager');
  icon.setAttribute('aria-expanded', 'false');
  icon.style.cssText = `
    width: var(--sb-btn-size, 40px);
    height: var(--sb-btn-size, 40px);
    /* Overlay appearance: no border, feathered backdrop, bg + text opacity from settings. */
    border: none;
    border-radius: var(--radius-full, 9999px);
    background: rgba(30, 41, 59, var(--sb-bg-opacity, 0.2));
    color: rgba(241, 245, 249, var(--sb-text-opacity, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
    isolation: isolate;
    pointer-events: auto;
    user-select: none;
    transition: background 150ms ease, color 150ms ease, transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
  icon.style.position = 'relative';
  icon.style.setProperty('border', 'none', 'important');
  icon.innerHTML = ICON_SVG;
  // Feathered backdrop — span mở rộng + blur 1px + mask radial fade
  const iconFeather = document.createElement('span');
  iconFeather.style.cssText = `
    position: absolute;
    inset: -1.5px;
    border-radius: var(--radius-full, 9999px);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    background: rgba(15, 23, 42, 0.1);
    -webkit-mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
    mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
    z-index: -1;
    transition: background 150ms ease;
    pointer-events: none;
  `;
  icon.appendChild(iconFeather);
  toolbar.appendChild(icon);

  // === Panel ===
  const panel = document.createElement('div');
  panel.setAttribute('data-testid', 'subtitle-manager-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Subtitle manager');
  panel.style.cssText = `
    display: none;
    position: absolute;
    top: 44px;
    left: 8px;
    z-index: 1000002;
    width: 320px;
    max-height: 360px;
    overflow-y: auto;
    background-color: var(--color-background);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl, 12px);
    box-shadow: var(--shadow-md, none);
    padding: var(--space-1, 4px);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    font-size: var(--font-size-base, 14px);
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: normal;
    text-align: left;
    text-shadow: none;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) var(--color-surface-hover);
  `;
  const panelStyle = document.createElement('style');
  panelStyle.textContent = `
    [data-testid="subtitle-manager-panel"] *,
    [data-testid="subtitle-manager-panel"] *::before,
    [data-testid="subtitle-manager-panel"] *::after {
      box-sizing: border-box;
      max-width: 100%;
    }
    [data-testid="subtitle-manager-panel"] button {
      margin: 0;
      font-family: inherit;
      line-height: 1.5;
    }
    [data-testid="subtitle-manager-icon"]:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    [data-testid="subtitle-manager-panel"]::-webkit-scrollbar {
      width: var(--space-2, 8px);
    }
    [data-testid="subtitle-manager-panel"]::-webkit-scrollbar-track {
      background: var(--color-surface-hover);
      border-radius: var(--radius-full, 9999px);
    }
    [data-testid="subtitle-manager-panel"]::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: var(--radius-full, 9999px);
      border: 2px solid var(--color-surface-hover);
    }
    [data-testid="subtitle-manager-panel"]::-webkit-scrollbar-thumb:hover {
      background: var(--color-primary);
    }
  `;
  panel.appendChild(panelStyle);
  container.appendChild(panel);
  // ADR-031: Netflix z-index fix — manager panel must sit above Netflix overlays.
  mountToWatchVideo(panel, container);

  // Panel header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    margin: 0;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border-bottom: 1px solid var(--color-border-subtle);
    box-sizing: border-box;
  `;
  const title = document.createElement('span');
  title.textContent = 'Subtitle Manager';
  title.style.cssText = 'font-size: var(--font-size-sm, 13px); font-weight: 600; color: var(--color-text);';
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('data-testid', 'subtitle-manager-close');
  closeBtn.setAttribute('aria-label', 'Close subtitle manager');
  closeBtn.setAttribute('title', 'Close subtitle manager');
  closeBtn.style.cssText = `
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
    border-radius: var(--radius-sm, 6px);
    transition: background 150ms ease, color 150ms ease, transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
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
  const roleColor = (role: 'target' | 'native'): string =>
    role === 'target' ? 'var(--color-primary)' : 'var(--color-warning)';
  const roleBg = (role: 'target' | 'native'): string =>
    role === 'target' ? 'var(--color-primary-subtle)' : 'var(--color-warning-subtle, rgba(245, 158, 11, 0.1))';

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
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        padding: ${isActive ? 'calc(var(--space-2, 8px) - 1px) calc(var(--space-3, 12px) - 1px)' : 'var(--space-2, 8px) var(--space-3, 12px)'};
        cursor: pointer;
        border-radius: var(--radius-sm, 6px);
        border: 1px solid ${isActive ? roleColor(role) : 'transparent'};
        background: ${isActive ? roleBg(role) : 'transparent'};
        transition: background 150ms ease;
      `;

      // Radio dot
      const radio = document.createElement('span');
      radio.setAttribute('aria-hidden', 'true');
      radio.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid ${isActive ? roleColor(role) : 'var(--color-text-muted)'};
        background: ${isActive ? roleColor(role) : 'transparent'};
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      if (isActive) {
        const dot = document.createElement('span');
        dot.style.cssText = 'width: 4px; height: 4px; border-radius: 50%; background: var(--color-text-inverse, white);';
        radio.appendChild(dot);
      }

      // Name + meta
      const textCol = document.createElement('div');
      textCol.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;';
      const name = document.createElement('span');
      name.textContent = item.name;
      name.style.cssText = 'font-size: var(--font-size-sm, 13px); font-weight: 500; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      const meta = document.createElement('div');
      meta.style.cssText = 'display: flex; gap: var(--space-2, 8px); align-items: center; font-size: var(--font-size-xs, 12px); color: var(--color-text-muted);';
      const formatBadge = document.createElement('span');
      formatBadge.textContent = item.format.toUpperCase();
      formatBadge.style.cssText = `
        padding: 1px 5px;
        border-radius: var(--radius-sm, 6px);
        background: var(--color-surface-hover);
        font-weight: 600;
        font-size: 9px;
        letter-spacing: 0.04em;
      `;
      meta.appendChild(formatBadge);
      // ADR-020: ASR badge for YouTube auto-generated captions.
      if (item.isAsr === true) {
        const asrBadge = document.createElement('span');
        asrBadge.textContent = 'AUTO';
        asrBadge.style.cssText = `
          padding: 1px 5px;
          border-radius: var(--radius-sm, 6px);
          background: var(--color-warning-subtle, rgba(245, 158, 11, 0.15));
          color: var(--color-warning, #f59e0b);
          font-weight: 600;
          font-size: 9px;
          letter-spacing: 0.04em;
        `;
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
        imported.style.cssText = 'color: var(--color-success); font-weight: 600;';
        meta.appendChild(imported);
      }
      if (item.source === 'translated') {
        const translatedBadge = document.createElement('span');
        translatedBadge.textContent = 'TRANSLATED';
        translatedBadge.style.cssText = `
          padding: 1px 5px;
          border-radius: var(--radius-sm, 6px);
          background: var(--color-warning-subtle, rgba(245, 158, 11, 0.15));
          color: var(--color-warning, #f59e0b);
          font-weight: 600;
          font-size: 9px;
          letter-spacing: 0.04em;
        `;
        meta.appendChild(translatedBadge);
      }
      // Optional role indicator when item name doesn't obviously match section (imported/translated fallback)
      if ((item.source === 'imported' || item.source === 'translated') && !item.name.toLowerCase().startsWith(role)) {
        const roleInd = document.createElement('span');
        roleInd.textContent = `→ ${roleLabel(role)}`;
        roleInd.style.cssText = `font-weight: 600; color: ${roleColor(role)};`;
        meta.appendChild(roleInd);
      }
      textCol.appendChild(name);
      textCol.appendChild(meta);

      row.appendChild(radio);
      row.appendChild(textCol);

      row.addEventListener('click', () => {
        onSelect?.(role, index);
      });
      row.addEventListener('mouseenter', () => {
        if (!isActive) row.style.background = 'var(--color-surface-hover)';
      });
      row.addEventListener('mouseleave', () => {
        if (!isActive) row.style.background = 'transparent';
      });
      section.body.appendChild(row);
    });
  };

  const roleLabel = (role: 'target' | 'native'): string =>
    role === 'target' ? targetLabel : nativeLabel;

  const updateSection = (role: 'target' | 'native', items: SubtitlePanelItem[], activeIndex: number): void => {
    state[role].items = items;
    state[role].activeIndex = activeIndex < items.length ? activeIndex : Math.max(0, items.length - 1);
    renderSection(role);
  };

  const open = (): void => {
    panel.style.display = 'block';
    icon.setAttribute('aria-expanded', 'true');
    // Active state: keep overlay surface and change only the SVG color.
    icon.style.color = 'var(--color-primary)';
    renderSection('target');
    renderSection('native');
    bindOutsideClick();
  };

  const close = (): void => {
    panel.style.display = 'none';
    icon.setAttribute('aria-expanded', 'false');
    icon.style.color = 'rgba(241, 245, 249, var(--sb-text-opacity, 1))';
    iconFeather.style.background = 'rgba(15, 23, 42, 0.1)';
    unbindOutsideClick();
  };

  // Event listeners
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.style.display === 'none') open();
    else close();
  });
  // Hover feedback when panel is closed.
  icon.addEventListener('mouseenter', () => {
    if (panel.style.display === 'none') {
      icon.style.color = 'var(--color-primary)';
      iconFeather.style.background = 'rgba(15, 23, 42, 0.25)';
    }
  });
  icon.addEventListener('mouseleave', () => {
    if (panel.style.display === 'none') {
      icon.style.color = 'rgba(241, 245, 249, var(--sb-text-opacity, 1))';
      iconFeather.style.background = 'rgba(15, 23, 42, 0.1)';
    }
  });
  // Focus ring handled by CSS :focus-visible (WCAG 2.4.7) — no JS outline.

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'var(--color-surface-hover)';
    closeBtn.style.color = 'var(--color-text)';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'var(--color-text-muted)';
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
  targetSection.header.addEventListener('mouseenter', () => {
    targetSection.header.style.background = 'var(--color-surface-hover)';
  });
  targetSection.header.addEventListener('mouseleave', () => {
    targetSection.header.style.background = 'transparent';
  });
  nativeSection.header.addEventListener('mouseenter', () => {
    nativeSection.header.style.background = 'var(--color-surface-hover)';
  });
  nativeSection.header.addEventListener('mouseleave', () => {
    nativeSection.header.style.background = 'transparent';
  });

  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', escHandler);

  let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  const bindOutsideClick = (): void => {
    unbindOutsideClick();
    outsideClickHandler = (e: MouseEvent) => {
      if (panel.style.display === 'none') return;
      const target = e.target as Node;
      if (!panel.contains(target) && !icon.contains(target) && !importButton.contains(target)) {
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
    toolbar.remove();
    panel.remove();
  };

  return {
    toolbar,
    icon,
    importButton,
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
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    cursor: pointer;
    border-radius: var(--radius-sm, 6px);
    user-select: none;
    width: 100%;
    min-height: 40px;
    margin: 0;
    border: none;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    line-height: 1.5;
    text-align: left;
    box-sizing: border-box;
    transition: background 150ms ease;
  `;

  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = CHEVRON_SVG;
  chevron.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
    margin: 0;
    color: var(--color-text-muted);
    transition: transform 150ms ease;
  `;
  header.appendChild(chevron);

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-size: var(--font-size-xs, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex: 1;
    color: ${role === 'target' ? 'var(--color-primary)' : 'var(--color-warning)'};
  `;
  header.appendChild(labelEl);

  const count = document.createElement('span');
  count.style.cssText = 'font-size: var(--font-size-xs, 12px); color: var(--color-text-muted);';
  count.textContent = '0 subtitles';
  header.appendChild(count);
  section.appendChild(header);

  const body = document.createElement('div');
  body.setAttribute('data-testid', 'manager-section-body');
  body.setAttribute('data-role', role);
  body.style.cssText = 'padding: 0 var(--space-1, 4px); display: block;';
  section.appendChild(body);

  return { header, body, count, label: labelEl, chevron };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function extractLanguageName(name: string): string {
  // "English #2" → "English"; "my-subtitle" → ""
  const match = name.match(/^([A-Za-z\s]+)\s*#/);
  return match ? match[1].trim() : '';
}
