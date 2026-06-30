import { formatSubtitleName } from './subtitleNaming';

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
  readonly icon: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  readonly chip: HTMLDivElement;
  readonly open: () => void;
  readonly close: () => void;
  readonly updateTarget: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly updateNative: (items: SubtitlePanelItem[], activeIndex: number) => void;
  readonly updateChip: (targetName: string | null, nativeName: string | null) => void;
  readonly destroy: () => void;
}

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H2V3z"/><path d="M12 7h8"/><path d="M12 12h8"/><path d="M12 17h8"/></svg>`;
const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * Create the unified Subtitle Manager Panel (ADR-015 V2).
 *
 * Replaces ADR-014 V1 separate dropdown icons with a single panel opened from a
 * manager icon. Panel has two collapsible sections (Target + Native), shows
 * active subtitle via radio highlight, and keeps the panel open after selection
 * so users can switch multiple times quickly.
 *
 * @param container - Video wrapper (icon + chip + panel appended here)
 * @param options - onSelect callback, section labels
 * @returns Panel API
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

  // === Active chip (toolbar, right of manager icon) ===
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
  container.appendChild(chip);

  // === Manager icon ===
  const icon = document.createElement('button');
  icon.setAttribute('type', 'button');
  icon.setAttribute('data-testid', 'subtitle-manager-icon');
  icon.setAttribute('aria-label', 'Open subtitle manager');
  icon.setAttribute('title', 'Open subtitle manager — select or import subtitles');
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
  `;
  icon.innerHTML = ICON_SVG;
  container.appendChild(icon);

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
    padding: 4px;
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
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border-subtle);
  `;
  const title = document.createElement('span');
  title.textContent = 'Subtitles';
  title.style.cssText = 'font-size: var(--font-size-sm, 13px); font-weight: 600;';
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
    border-radius: 4px;
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
  const renderSection = (role: 'target' | 'native'): void => {
    const section = role === 'target' ? targetSection : nativeSection;
    const { items, activeIndex } = state[role];
    section.count.textContent = String(items.length);
    section.body.innerHTML = '';

    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.setAttribute('role', 'option');
      row.setAttribute('data-testid', `manager-item-${role}-${index}`);
      row.setAttribute('aria-selected', String(index === activeIndex));
      row.setAttribute('title', `Select ${item.name}`);
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        cursor: pointer;
        border-radius: var(--radius-md, 8px);
        border: 1px solid transparent;
        ${index === activeIndex ? 'background: var(--color-surface-hover); border-color: var(--color-' + (role === 'target' ? 'primary' : 'warning') + ');' : ''}
      `;

      // Radio dot
      const radio = document.createElement('span');
      radio.setAttribute('aria-hidden', 'true');
      radio.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--color-${role === 'target' ? 'primary' : 'warning'});
        background: ${index === activeIndex ? 'var(--color-' + (role === 'target' ? 'primary' : 'warning') + ')' : 'transparent'};
        flex-shrink: 0;
      `;

      // Name + meta
      const textCol = document.createElement('div');
      textCol.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;';
      const name = document.createElement('span');
      name.textContent = item.name;
      name.style.cssText = 'font-size: var(--font-size-sm, 13px); font-weight: 500; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      const meta = document.createElement('span');
      const sizeText = item.size ? ` · ${formatBytes(item.size)}` : '';
      meta.textContent = `${item.format.toUpperCase()}${sizeText}`;
      meta.style.cssText = 'font-size: var(--font-size-xs, 12px); color: var(--color-text-muted);';
      textCol.appendChild(name);
      textCol.appendChild(meta);

      row.appendChild(radio);
      row.appendChild(textCol);

      row.addEventListener('click', () => {
        onSelect?.(role, index);
      });
      row.addEventListener('mouseenter', () => {
        if (index !== activeIndex) row.style.background = 'var(--color-surface-hover)';
      });
      row.addEventListener('mouseleave', () => {
        if (index !== activeIndex) row.style.background = 'transparent';
      });
      section.body.appendChild(row);
    });
  };

  const updateSection = (role: 'target' | 'native', items: SubtitlePanelItem[], activeIndex: number): void => {
    state[role].items = items;
    state[role].activeIndex = activeIndex < items.length ? activeIndex : Math.max(0, items.length - 1);
    renderSection(role);
  };

  const updateChip = (targetName: string | null, nativeName: string | null): void => {
    const parts: string[] = [];
    if (targetName) parts.push(targetName);
    if (nativeName) parts.push(nativeName);
    if (parts.length === 0) {
      chip.style.display = 'none';
      chip.textContent = '';
      return;
    }
    chip.textContent = parts.join(' · ');
    chip.style.display = 'flex';
  };

  const open = (): void => {
    panel.style.display = 'block';
    icon.setAttribute('aria-expanded', 'true');
    renderSection('target');
    renderSection('native');
    bindOutsideClick();
  };

  const close = (): void => {
    panel.style.display = 'none';
    icon.setAttribute('aria-expanded', 'false');
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

  const headerClick = (e: MouseEvent) => {
    const header = e.currentTarget as HTMLElement;
    const role = header.getAttribute('data-role') as 'target' | 'native';
    const section = role === 'target' ? targetSection : nativeSection;
    state[role].expanded = !state[role].expanded;
    section.body.style.display = state[role].expanded ? 'block' : 'none';
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
      if (panel.style.display === 'none') return;
      const target = e.target as Node;
      if (!panel.contains(target) && !icon.contains(target) && !chip.contains(target)) {
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
    icon.remove();
    panel.remove();
    chip.remove();
  };

  return {
    icon,
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
): { header: HTMLElement; body: HTMLElement; count: HTMLElement; chevron: HTMLElement } {
  const header = document.createElement('div');
  header.setAttribute('data-testid', 'manager-section-header');
  header.setAttribute('data-role', role);
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'true');
  header.setAttribute('aria-label', `Toggle ${label} section`);
  header.setAttribute('title', `Toggle ${label} section`);
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    border-radius: var(--radius-md, 8px);
    user-select: none;
  `;
  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.style.cssText = 'display: inline-block; transition: transform 150ms ease;';
  chevron.textContent = '▾';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-size: var(--font-size-xs, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex: 1;
    color: var(--color-${role === 'target' ? 'primary' : 'warning'});
  `;
  const count = document.createElement('span');
  count.style.cssText = 'font-size: var(--font-size-xs, 12px); color: var(--color-text-muted);';
  count.textContent = '0';
  header.appendChild(chevron);
  header.appendChild(labelEl);
  header.appendChild(count);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.setAttribute('data-testid', 'manager-section-body');
  body.setAttribute('data-role', role);
  body.style.cssText = 'padding: 0 4px 8px; display: block;';
  panel.appendChild(body);

  return { header, body, count, chevron };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
