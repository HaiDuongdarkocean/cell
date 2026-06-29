import { createSubtitleDropdown } from '../../../src/content/subtitleSelector';
import type { DetectedSubtitle } from '../../../src/types/media';

describe('createSubtitleDropdown (ADR-014 D3 — V2 ADR-007 D3)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const makeSub = (language: string, format: 'srt' | 'vtt' = 'srt'): DetectedSubtitle => ({
    id: `sub-${language}-${Math.random()}`,
    url: `https://x/${language}.srt`,
    format,
    language,
    tabId: 1,
    detectedAt: Date.now(),
  });

  it('renders icon when ≥2 sub same lang', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    expect(icon.getAttribute('data-testid')).toBe('subtitle-selector-target');
    expect(container.contains(icon)).toBe(true);
  });

  it('hides icon when only 1 sub (V1 behavior, no dropdown)', () => {
    const subs = [makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    expect(icon.style.display).toBe('none');
  });

  it('hides icon when 0 sub match language', () => {
    const subs = [makeSub('vi'), makeSub('fr')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    expect(icon.style.display).toBe('none');
  });

  it('opens popover on icon click with list of matching subs', () => {
    const subs = [makeSub('en', 'srt'), makeSub('en', 'vtt')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    const popover = document.querySelector('[data-testid="subtitle-selector-popover-target"]');
    expect(popover).toBeTruthy();
    const items = document.querySelectorAll('[data-testid^="subtitle-selector-item-target-"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Sub #1');
    expect(items[0].textContent).toContain('SRT');
    expect(items[1].textContent).toContain('VTT');
  });

  it('highlights active sub in popover (aria-selected)', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 1, () => {});
    icon.click();
    const item0 = document.querySelector('[data-testid="subtitle-selector-item-target-0"]');
    const item1 = document.querySelector('[data-testid="subtitle-selector-item-target-1"]');
    expect(item0?.getAttribute('aria-selected')).toBe('false');
    expect(item1?.getAttribute('aria-selected')).toBe('true');
  });

  it('calls onSelect with index when sub item clicked', () => {
    const subs = [makeSub('en'), makeSub('en')];
    let selected = -1;
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, (i) => { selected = i; });
    icon.click();
    const item1 = document.querySelector('[data-testid="subtitle-selector-item-target-1"]') as HTMLDivElement;
    item1.click();
    expect(selected).toBe(1);
  });

  it('closes popover after selecting sub', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    const item1 = document.querySelector('[data-testid="subtitle-selector-item-target-1"]') as HTMLDivElement;
    item1.click();
    const popover = document.querySelector('[data-testid="subtitle-selector-popover-target"]');
    expect(popover).toBeNull();
  });

  it('closes popover on click outside', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeTruthy();
    // Click outside (on body)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeNull();
  });

  it('closes popover on Esc key', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeNull();
  });

  it('toggles popover open/close on icon click', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeTruthy();
    icon.click();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeNull();
  });

  it('only 1 dropdown open at a time (clicking #2 closes #1)', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon: icon1 } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    const { icon: icon2 } = createSubtitleDropdown('native', container, subs, 'en', 0, () => {});
    icon1.click();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeTruthy();
    icon2.click();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeNull();
    expect(document.querySelector('[data-testid="subtitle-selector-popover-native"]')).toBeTruthy();
  });

  it('destroy removes icon + popover', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon, destroy } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    destroy();
    expect(container.contains(icon)).toBe(false);
    expect(document.querySelector('[data-testid="subtitle-selector-popover-target"]')).toBeNull();
  });

  it('filters subtitles case-insensitively (EN vs en)', () => {
    const subs = [makeSub('EN'), makeSub('EN')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    expect(icon.style.display).not.toBe('none');
    icon.click();
    const items = document.querySelectorAll('[data-testid^="subtitle-selector-item-target-"]');
    expect(items.length).toBe(2);
  });

  it('icon has correct aria attributes', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    expect(icon.getAttribute('aria-label')).toBe('Select target subtitle');
    expect(icon.getAttribute('aria-haspopup')).toBe('listbox');
    expect(icon.getAttribute('aria-expanded')).toBe('false');
  });

  it('sets aria-expanded=true when popover open', () => {
    const subs = [makeSub('en'), makeSub('en')];
    const { icon } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
    icon.click();
    expect(icon.getAttribute('aria-expanded')).toBe('true');
  });
});
