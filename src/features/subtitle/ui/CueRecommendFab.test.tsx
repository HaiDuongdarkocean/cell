import { fireEvent, render, screen } from '@testing-library/react';
import { CueRecommendFab } from './CueRecommendFab';
import type { CueFilterMode } from '@/features/subtitle/logic/cueDifficulty';

const COUNTS: Record<CueFilterMode, number> = {
  all: 10,
  i1: 4,
  hasUnknown: 6,
  allKnown: 4,
  dense: 2,
  tracking: 1,
};

function renderFab(overrides: Partial<Parameters<typeof CueRecommendFab>[0]> = {}) {
  const onModeChange = overrides.onModeChange ?? jest.fn();
  render(
    <CueRecommendFab
      mode={overrides.mode ?? 'all'}
      counts={overrides.counts ?? COUNTS}
      onModeChange={onModeChange}
    />,
  );
  return { onModeChange };
}

describe('CueRecommendFab', () => {
  it('renders the FAB with badge count, aria-haspopup and collapsed state', () => {
    renderFab();

    const fab = screen.getByTestId('cue-filter-fab');
    expect(fab).toHaveAttribute('aria-haspopup', 'menu');
    expect(fab).toHaveAttribute('aria-expanded', 'false');
    expect(fab.getAttribute('aria-label')).toContain('4');
    expect(screen.getByTestId('cue-filter-badge').textContent).toBe('4');
  });

  it('shows 0 in the badge when no i+1 cues match', () => {
    renderFab({ counts: { ...COUNTS, i1: 0 } });

    expect(screen.getByTestId('cue-filter-badge').textContent).toBe('0');
  });

  it('caps the badge at 99+', () => {
    renderFab({ counts: { ...COUNTS, i1: 150 } });

    expect(screen.getByTestId('cue-filter-badge').textContent).toBe('99+');
  });

  it('opens a menu with six menuitemradio options and the active mode checked', () => {
    renderFab({ mode: 'i1' });

    fireEvent.click(screen.getByTestId('cue-filter-fab'));

    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(6);
    const checked = items.filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toContain('i+1');
    expect(checked[0].textContent).toContain('4');
    expect(screen.getByTestId('cue-filter-fab')).toHaveAttribute('aria-expanded', 'true');
  });

  it('selecting an item calls onModeChange, closes the menu and returns focus', () => {
    const { onModeChange } = renderFab();

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    const dense = screen.getAllByRole('menuitemradio').find((el) => el.textContent?.includes('3+'));
    expect(dense).toBeDefined();
    fireEvent.click(dense!);

    expect(onModeChange).toHaveBeenCalledWith('dense');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByTestId('cue-filter-fab'));
  });

  it('closes on Escape and returns focus to the FAB', () => {
    renderFab();

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(6);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByTestId('cue-filter-fab'));
  });

  it('closes on click outside', () => {
    renderFab();

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(6);

    fireEvent.mouseDown(document.body);
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
  });

  it('supports ArrowDown/Enter keyboard selection from the menu', () => {
    const { onModeChange } = renderFab();

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });

    expect(onModeChange).toHaveBeenCalledWith('hasUnknown');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on Enter from the trigger and navigates with arrow keys', () => {
    renderFab({ mode: 'allKnown' });

    const fab = screen.getByTestId('cue-filter-fab');
    fireEvent.keyDown(fab, { key: 'Enter' });

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitemradio');
    const active = items.findIndex((el) => el.getAttribute('aria-checked') === 'true');
    expect(active).toBe(3);
    expect(menu.getAttribute('aria-activedescendant')).toContain('allKnown');
  });
});
