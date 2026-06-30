import { createSubtitleDropdown } from '@/features/subtitle/ui/subtitleSelector';
import type { DetectedSubtitle } from '@/types/media';

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
    expect(items[0].textContent).toContain('English #1');
    expect(items[0].textContent).toContain('SRT');
    expect(items[1].textContent).toContain('English #2');
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

  // === ADR-015 T3: updateSubtitleDropdown (bug #5 fix — update-in-place) ===
  describe('updateSubtitleDropdown (ADR-015 — bug #5 fix, update-in-place)', () => {
    it('updates popover list items in-place without destroying icon', () => {
      const subs = [makeSub('en'), makeSub('en')];
      const { icon, update } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
      icon.click();
      const iconRef = icon; // capture identity
      const newSubs = [makeSub('en'), makeSub('en'), makeSub('en')]; // 3 subs now
      update(newSubs, 0);
      // Icon element identity stable (not recreated)
      expect(container.contains(iconRef)).toBe(true);
      expect(iconRef).toBe(icon);
      // Popover now has 3 items
      const items = document.querySelectorAll('[data-testid^="subtitle-selector-item-target-"]');
      expect(items.length).toBe(3);
    });

    it('preserves activeIndex across update (bug #5 — no reset to 0)', () => {
      const subs = [makeSub('en'), makeSub('en')];
      const { icon, update } = createSubtitleDropdown('target', container, subs, 'en', 1, () => {});
      icon.click();
      // Simulate auto-load push with same matches — activeIndex must stay 1
      update(subs, 1);
      const item1 = document.querySelector('[data-testid="subtitle-selector-item-target-1"]');
      expect(item1?.getAttribute('aria-selected')).toBe('true');
      const item0 = document.querySelector('[data-testid="subtitle-selector-item-target-0"]');
      expect(item0?.getAttribute('aria-selected')).toBe('false');
    });

    it('clamps activeIndex when matches shrink below current index', () => {
      const subs = [makeSub('en'), makeSub('en'), makeSub('en')];
      const { icon, update } = createSubtitleDropdown('target', container, subs, 'en', 2, () => {});
      icon.click();
      // Matches shrink to 2 — activeIndex 2 is out of range, clamp to 1
      const newSubs = [makeSub('en'), makeSub('en')];
      update(newSubs, 2);
      const item1 = document.querySelector('[data-testid="subtitle-selector-item-target-1"]');
      expect(item1?.getAttribute('aria-selected')).toBe('true');
    });

    it('does not flicker — icon element not removed/re-appended on update', () => {
      const subs = [makeSub('en'), makeSub('en')];
      const { icon, update } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
      icon.click();
      const iconBefore = icon;
      const parentBefore = icon.parentNode;
      update(subs, 0);
      expect(icon.parentNode).toBe(parentBefore);
      expect(icon).toBe(iconBefore);
    });

    it('update works when popover is closed (updates for next open)', () => {
      const subs = [makeSub('en'), makeSub('en')];
      const { icon, update } = createSubtitleDropdown('target', container, subs, 'en', 0, () => {});
      // Popover closed — update should not throw, next open reflects new state
      const newSubs = [makeSub('en'), makeSub('en'), makeSub('en')];
      expect(() => update(newSubs, 0)).not.toThrow();
      icon.click();
      const items = document.querySelectorAll('[data-testid^="subtitle-selector-item-target-"]');
      expect(items.length).toBe(3);
    });
  });
});
