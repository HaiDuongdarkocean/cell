import { createSubtitleManagerPanel } from '@/features/subtitle/ui/subtitleManagerPanel';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitleManagerPanel';

// Inject minimal theme tokens so var(--color-*) resolve in tests
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = `
    .test-theme-root { --color-primary: #2563eb; --color-warning: #f59e0b; --color-background: #ffffff; --color-surface: #f8fafc; --color-surface-hover: #f1f5f9; --color-text: #0f172a; --color-text-secondary: #475569; --color-text-muted: #94a3b8; --color-border: #e2e8f0; --color-border-subtle: #f1f5f9; --font-size-xs: 12px; --font-size-sm: 13px; --font-size-base: 14px; --spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 12px; --radius-md: 8px; --radius-lg: 12px; --shadow-md: 0 4px 12px rgba(0,0,0,0.08); }
  `;
  document.head.appendChild(style);
});

describe('createSubtitleManagerPanel (ADR-015 — unified subtitle manager)', () => {
  let container: HTMLDivElement;
  let selected: { role: 'target' | 'native'; index: number } | null = null;

  const makeItem = (
    role: 'target' | 'native',
    index: number,
    overrides: Partial<SubtitlePanelItem> = {},
  ): SubtitlePanelItem => ({
    id: `${role}-${index}`,
    name: `${role === 'target' ? 'English' : 'Arabic'} #${index + 1}`,
    format: 'srt',
    size: 1024,
    source: 'auto',
    role,
    index,
    ...overrides,
  });

  const createImportButton = (): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'subtitle-import-button');
    btn.setAttribute('aria-label', 'Import subtitle file');
    return btn;
  };

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'test-theme-root';
    document.body.appendChild(container);
    selected = null;
  });

  afterEach(() => {
    container.remove();
  });

  it('renders manager icon in toolbar', () => {
    const { icon } = createSubtitleManagerPanel(container, createImportButton());
    expect(icon.getAttribute('data-testid')).toBe('subtitle-manager-icon');
    expect(icon.getAttribute('aria-label')).toBe('Subtitle manager');
    expect(icon.getAttribute('title')).toBeTruthy();
  });

  it('opens panel when manager icon clicked', () => {
    const { icon, panel } = createSubtitleManagerPanel(container, createImportButton());
    expect(panel.style.display).toBe('none');
    icon.click();
    expect(panel.style.display).toBe('block');
  });

  it('panel has 2 sections (Target + Native)', () => {
    const { panel } = createSubtitleManagerPanel(container, createImportButton());
    const headers = panel.querySelectorAll('[data-testid="manager-section-header"]');
    expect(headers.length).toBe(2);
    expect(headers[0].getAttribute('data-role')).toBe('target');
    expect(headers[1].getAttribute('data-role')).toBe('native');
  });

  it('renders target items and highlights active', () => {
    const { panel, updateTarget } = createSubtitleManagerPanel(container, createImportButton(), {
      onSelect: (r: 'target' | 'native', i: number) => { selected = { role: r, index: i }; },
    });
    updateTarget([makeItem('target', 0), makeItem('target', 1)], 1);
    const items = panel.querySelectorAll('[data-testid^="manager-item-target-"]');
    expect(items.length).toBe(2);
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(items[0].getAttribute('aria-selected')).toBe('false');
  });

  it('clicking item calls onSelect and keeps panel open', () => {
    const { panel, updateTarget, icon } = createSubtitleManagerPanel(container, createImportButton(), {
      onSelect: (r: 'target' | 'native', i: number) => { selected = { role: r, index: i }; },
    });
    icon.click();
    updateTarget([makeItem('target', 0), makeItem('target', 1)], 0);
    const item1 = panel.querySelector('[data-testid="manager-item-target-1"]') as HTMLElement;
    item1.click();
    expect(selected).toEqual({ role: 'target', index: 1 });
    expect(panel.style.display).toBe('block');
  });

  it('closes panel via close button', () => {
    const { icon, panel, close } = createSubtitleManagerPanel(container, createImportButton());
    icon.click();
    expect(panel.style.display).toBe('block');
    close();
    expect(panel.style.display).toBe('none');
  });

  it('closes panel on Esc', () => {
    const { icon, panel } = createSubtitleManagerPanel(container, createImportButton());
    icon.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.style.display).toBe('none');
  });

  it('closes panel on click outside', () => {
    const { icon, panel } = createSubtitleManagerPanel(container, createImportButton());
    icon.click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(panel.style.display).toBe('none');
  });

  it('sections are collapsible', () => {
    const { panel, updateTarget } = createSubtitleManagerPanel(container, createImportButton());
    updateTarget([makeItem('target', 0)], 0);
    const header = panel.querySelector('[data-testid="manager-section-header"][data-role="target"]') as HTMLElement;
    const body = panel.querySelector('[data-testid="manager-section-body"][data-role="target"]') as HTMLElement;
    expect(body.style.display).not.toBe('none');
    header.click();
    expect(body.style.display).toBe('none');
    header.click();
    expect(body.style.display).not.toBe('none');
  });

  it('panel uses CSS theme tokens', () => {
    const { panel } = createSubtitleManagerPanel(container, createImportButton());
    expect(panel.style.width).toBe('320px');
    expect(panel.style.backgroundColor).toBe('var(--color-background)');
    expect(panel.style.color).toBe('var(--color-text)');
  });

  it('destroy removes all elements', () => {
    const { toolbar, panel, destroy } = createSubtitleManagerPanel(container, createImportButton());
    destroy();
    expect(container.contains(toolbar)).toBe(false);
    expect(container.contains(panel)).toBe(false);
  });
});
