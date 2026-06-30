/**
 * Item displayed in the Subtitle Manager Panel (ADR-015).
 * Can be auto-detected or imported, target or native.
 */
export interface SubtitlePanelItem {
  readonly id: string;
  readonly name: string; // Display name (e.g. "English #2" or "my-subtitle")
  readonly format: string; // srt/vtt/ass
  readonly size?: number; // bytes
  readonly source: 'auto' | 'imported';
  readonly role: 'target' | 'native';
  readonly index: number; // position within role section
}

/**
 * Subtitle Manager Panel API (ADR-015).
 */
export interface SubtitleManagerPanel {
  readonly toolbar: HTMLDivElement;
  readonly icon: HTMLButtonElement;
  readonly importButton: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  readonly chip: HTMLDivElement;
  readonly open: () => void;
  readonly close: () => void;
  readonly updateTarget: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly updateNative: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly updateChip: (targetName: string | null, nativeName: string | null) => void;
  readonly destroy: () => void;
}

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M14 12h4"/><path d="M6 16h2"/><path d="M12 16h6"/></svg>`;
const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`;
const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

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
    gap: var(--spacing-sm, 8px);
    z-index: 1000001;
    pointer-events: none;
  `;
  container.appendChild(toolbar);

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
    width: 32px;
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    user-select: none;
    transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  `;
  icon.innerHTML = ICON_SVG;
  toolbar.appendChild(icon);

  // === Active chip ===
  const chip = document.createElement('div');
  chip.setAttribute('data-testid', 'subtitle-active-chip');
  chip.setAttribute('aria-label', 'Active subtitles');
  chip.setAttribute('title', 'Currently active target and native subtitles');
  chip.style.cssText = `
    display: none;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    height: 32px;
    padding: 0 var(--spacing-md, 12px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs, 12px);
    font-weight: 500;
    max-width: 160px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    pointer-events: auto;
    user-select: none;
  `;
  toolbar.appendChild(chip);

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
    border-radius: var(--radius-md, 8px);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    padding: var(--spacing-xs, 4px);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    font-size: var(--font-size-base, 14px);
  `;
  container.appendChild(panel);

  // Panel header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border-bottom: 1px solid var(--color-border-subtle);
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
    border-radius: var(--radius-sm, 6px);
    transition: background 150ms ease, color 150ms ease;
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
    role === 'target' ? 'var(--color-primary-subtle)' : 'rgba(245, 158, 11, 0.1)';

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
        gap: var(--spacing-sm, 8px);
        padding: ${isActive ? 'calc(var(--spacing-sm, 8px) - 1px) calc(var(--spacing-md, 12px) - 1px)' : 'var(--spacing-sm, 8px) var(--spacing-md, 12px)'};
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
        dot.style.cssText = 'width: 4px; height: 4px; border-radius: 50%; background: white;';
        radio.appendChild(dot);
      }

      // Name + meta
      const textCol = document.createElement('div');
      textCol.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;';
      const name = document.createElement('span');
      name.textContent = item.name;
      name.style.cssText = 'font-size: var(--font-size-sm, 13px); font-weight: 500; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      const meta = document.createElement('div');
      meta.style.cssText = 'display: flex; gap: var(--spacing-sm, 8px); align-items: center; font-size: var(--font-size-xs, 12px); color: var(--color-text-muted);';
      const formatBadge = document.createElement('span');
      formatBadge.textContent = item.format.toUpperCase();
      formatBadge.style.cssText = `
        padding: 1px 5px;
        border-radius: 3px;
        background: var(--color-surface-hover);
        font-weight: 600;
        font-size: 9px;
        letter-spacing: 0.04em;
      `;
      meta.appendChild(formatBadge);
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
      // Optional role indicator when item name doesn't obviously match section (imported fallback)
      if (item.source === 'imported' && !item.name.toLowerCase().startsWith(role)) {
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

  const updateChip = (targetName: string | null, nativeName: string | null): void => {
    chip.innerHTML = '';
    if (!targetName && !nativeName) {
      chip.style.display = 'none';
      return;
    }
    const addPart = (name: string, colorVar: string) => {
      const span = document.createElement('span');
      span.textContent = name;
      span.style.cssText = `color: ${colorVar}; font-weight: 600;`;
      chip.appendChild(span);
    };
    if (targetName) addPart(targetName, 'var(--color-primary)');
    if (targetName && nativeName) {
      const sep = document.createElement('span');
      sep.textContent = '·';
      sep.style.cssText = 'color: var(--color-text-muted); margin: 0 2px;';
      chip.appendChild(sep);
    }
    if (nativeName) addPart(nativeName, 'var(--color-warning)');
    chip.style.display = 'flex';
  };

  const open = (): void => {
    panel.style.display = 'block';
    icon.setAttribute('aria-expanded', 'true');
    icon.style.background = 'var(--color-primary-subtle)';
    icon.style.borderColor = 'var(--color-primary)';
    icon.style.color = 'var(--color-primary)';
    renderSection('target');
    renderSection('native');
    bindOutsideClick();
  };

  const close = (): void => {
    panel.style.display = 'none';
    icon.setAttribute('aria-expanded', 'false');
    icon.style.background = 'var(--color-surface)';
    icon.style.borderColor = 'var(--color-border)';
    icon.style.color = 'var(--color-text)';
    unbindOutsideClick();
  };

  // Event listeners
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.style.display === 'none') open();
    else close();
  });

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
      if (!panel.contains(target) && !icon.contains(target) && !chip.contains(target) && !importButton.contains(target)) {
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
    chip,
    open,
    close,
    updateTarget: (items, activeIndex) => updateSection('target', items, activeIndex),
    updateNative: (items, activeIndex) => updateSection('native', items, activeIndex),
    updateChip,
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
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    cursor: pointer;
    border-radius: var(--radius-sm, 6px);
    user-select: none;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    text-align: left;
    transition: background 150ms ease;
  `;

  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = CHEVRON_SVG;
  chevron.style.cssText = `
    display: inline-flex;
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
  body.style.cssText = 'padding: 0 var(--spacing-xs, 4px); display: block;';
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
