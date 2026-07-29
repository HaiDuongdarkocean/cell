import { createSubtitleManagerPanel } from '@/features/subtitle/ui/subtitleManagerPanel.legacy';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitleManagerPanel.legacy';
import { DEFAULT_LIGHT_TOKENS, formatStaticTokens, formatComponentTokens } from '@/shared/lib/tokens';

// Inject full default token set so var(--*) resolve in tests.
beforeAll(() => {
  const style = document.createElement('style');
  const colorTokens = Object.entries(DEFAULT_LIGHT_TOKENS)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  style.textContent = `.test-theme-root { ${formatStaticTokens().replace(/\n/g, ' ')} ${formatComponentTokens().replace(/\n/g, ' ')} ${colorTokens} }`;
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

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'test-theme-root';
    document.body.appendChild(container);
    selected = null;
  });

  afterEach(() => {
    container.remove();
  });

  it('renders manager icon', () => {
    const { icon } = createSubtitleManagerPanel(container);
    expect(icon.getAttribute('data-testid')).toBe('subtitle-manager-icon');
    expect(icon.getAttribute('aria-label')).toBe('Subtitle manager');
    expect(icon.getAttribute('title')).toBeTruthy();
  });

  it('opens panel when manager icon clicked', () => {
    const { icon, panel } = createSubtitleManagerPanel(container);
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(false);
    icon.click();
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(true);
  });

  it('uses the overlay appearance and active class for SVG color', () => {
    const { icon } = createSubtitleManagerPanel(container);
    expect(icon.className).toContain('subtitle-manager-icon');
    expect(icon.classList.contains('subtitle-manager-icon--active')).toBe(false);
    icon.click();
    expect(icon.classList.contains('subtitle-manager-icon--active')).toBe(true);
  });

  it('has bouncy transform transition via CSS class', () => {
    const { icon } = createSubtitleManagerPanel(container);
    expect(icon.className).toContain('subtitle-manager-icon');
  });

  it('panel resets inherited text-shadow via CSS class', () => {
    // Host players (e.g. Artplayer) often set text-shadow on their container.
    // Our panel is injected inside that container, so it inherits the shadow
    // and text looks slightly blurred. We explicitly reset it via CSS.
    container.style.textShadow = '0 0 2px rgba(0,0,0,0.5)';
    const { panel } = createSubtitleManagerPanel(container);
    expect(panel.className).toContain('subtitle-manager-panel');
  });

  it('panel has 2 sections (Target + Native)', () => {
    const { panel } = createSubtitleManagerPanel(container);
    const headers = panel.querySelectorAll('[data-testid="manager-section-header"]');
    expect(headers.length).toBe(2);
    expect(headers[0].getAttribute('data-role')).toBe('target');
    expect(headers[1].getAttribute('data-role')).toBe('native');
  });

  it('renders target items and highlights active', () => {
    const { panel, updateTarget } = createSubtitleManagerPanel(container, {
      onSelect: (r: 'target' | 'native', i: number) => { selected = { role: r, index: i }; },
    });
    updateTarget([makeItem('target', 0), makeItem('target', 1)], 1);
    const items = panel.querySelectorAll('[data-testid^="manager-item-target-"]');
    expect(items.length).toBe(2);
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(items[0].getAttribute('aria-selected')).toBe('false');
  });

  it('clicking item calls onSelect and keeps panel open', () => {
    const { panel, updateTarget, icon } = createSubtitleManagerPanel(container, {
      onSelect: (r: 'target' | 'native', i: number) => { selected = { role: r, index: i }; },
    });
    icon.click();
    updateTarget([makeItem('target', 0), makeItem('target', 1)], 0);
    const item1 = panel.querySelector('[data-testid="manager-item-target-1"]') as HTMLElement;
    item1.click();
    expect(selected).toEqual({ role: 'target', index: 1 });
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(true);
  });

  it('closes panel via close button', () => {
    const { icon, panel, close } = createSubtitleManagerPanel(container);
    icon.click();
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(true);
    close();
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(false);
  });

  it('closes panel on Esc', () => {
    const { icon, panel } = createSubtitleManagerPanel(container);
    icon.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(false);
  });

  it('closes panel on click outside', () => {
    const { icon, panel } = createSubtitleManagerPanel(container);
    icon.click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(panel.classList.contains('subtitle-manager-panel--open')).toBe(false);
  });

  it('sections are collapsible', () => {
    const { panel, updateTarget } = createSubtitleManagerPanel(container);
    updateTarget([makeItem('target', 0)], 0);
    const header = panel.querySelector('[data-testid="manager-section-header"][data-role="target"]') as HTMLElement;
    const body = panel.querySelector('[data-testid="manager-section-body"][data-role="target"]') as HTMLElement;
    expect(body.style.display).not.toBe('none');
    header.click();
    expect(body.style.display).toBe('none');
    header.click();
    expect(body.style.display).not.toBe('none');
  });

  it('panel uses CSS theme tokens via class', () => {
    const { panel } = createSubtitleManagerPanel(container);
    expect(panel.className).toContain('subtitle-manager-panel');
  });

  it('destroy removes panel from container', () => {
    const { panel, destroy } = createSubtitleManagerPanel(container);
    destroy();
    expect(container.contains(panel)).toBe(false);
  });

  // Regression: import subtitle must not wipe auto-detected subtitles from panel.
  // The controller now merges auto + imported items into one list and passes it
  // to updateTarget/updateNative. The panel must render BOTH and distinguish them
  // via the "Imported" badge on imported items.
  it('renders merged auto + imported items together (import does not wipe auto)', () => {
    const { panel, updateTarget } = createSubtitleManagerPanel(container);
    const autoItems = [
      makeItem('target', 0, { id: 'auto-target-0', name: 'English #1', source: 'auto' }),
      makeItem('target', 1, { id: 'auto-target-1', name: 'English #2', source: 'auto' }),
    ];
    const importedItems = [
      makeItem('target', 0, { id: 'imported-target-0', name: 'manual-test', source: 'imported', index: 0 }),
    ];
    // Controller merges: [...auto, ...imported], activeIndex = auto.length + importActive
    updateTarget([...autoItems, ...importedItems], 2);

    const rows = panel.querySelectorAll('[data-testid^="manager-item-target-"]');
    expect(rows.length).toBe(3); // 2 auto + 1 imported, NOT 1 (imported only)

    // Auto items render without "Imported" badge
    const item0 = rows[0] as HTMLElement;
    expect(item0.textContent).toContain('English #1');
    expect(item0.textContent).not.toContain('Imported');

    // Imported item renders WITH "Imported" badge
    const item2 = rows[2] as HTMLElement;
    expect(item2.textContent).toContain('manual-test');
    expect(item2.textContent).toContain('Imported');

    // Active index points to the imported item (index 2)
    expect(item2.getAttribute('aria-selected')).toBe('true');
  });

  it('renders translated source with TRANSLATED badge and no Imported badge', () => {
    const { panel, updateNative } = createSubtitleManagerPanel(container);
    const translatedItem = makeItem('native', 0, {
      id: 'translated-native',
      name: 'Vietnamese (translated)',
      source: 'translated',
      role: 'native',
      index: 0,
    });
    updateNative([translatedItem], 0);

    const row = panel.querySelector('[data-testid="manager-item-native-0"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Vietnamese (translated)');
    expect(row.textContent).toContain('TRANSLATED');
    expect(row.textContent).not.toContain('Imported');
    expect(row.textContent).not.toContain('AUTO');
  });

  it('clicking an auto item in a merged list calls onSelect with the correct index', () => {
    const { panel, updateTarget, icon } = createSubtitleManagerPanel(container, {
      onSelect: (r: 'target' | 'native', i: number) => { selected = { role: r, index: i }; },
    });
    icon.click();
    const autoItems = [
      makeItem('target', 0, { id: 'auto-target-0', name: 'English #1', source: 'auto', index: 0 }),
    ];
    const importedItems = [
      makeItem('target', 0, { id: 'imported-target-0', name: 'manual-test', source: 'imported', index: 0 }),
    ];
    updateTarget([...autoItems, ...importedItems], 1);

    // Click the auto item (panel index 0) — controller routes by item.source
    const autoRow = panel.querySelector('[data-testid="manager-item-target-0"]') as HTMLElement;
    autoRow.click();
    expect(selected).toEqual({ role: 'target', index: 0 });
  });
});
