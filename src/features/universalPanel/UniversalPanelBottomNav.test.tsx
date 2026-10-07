import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { UniversalPanelBottomNav, type ToolAction } from './UniversalPanelBottomNav';
import { PANEL_BAR_TABS, PANEL_TOOLS_TABS } from './panelTabs';

const TOOLS: ToolAction[] = [
  { id: 'reader', icon: 'library', title: 'Open Reader', onClick: jest.fn() },
];

function renderNav(activeTab: Parameters<typeof UniversalPanelBottomNav>[0]['activeTab'] = 'dictionary', onTabChange = jest.fn()) {
  return render(<UniversalPanelBottomNav activeTab={activeTab} onTabChange={onTabChange} tools={TOOLS} />);
}

describe('UniversalPanelBottomNav (up-mobile-chrome)', () => {
  it('the registry splits 4 bar tabs from 3 demoted tabs', () => {
    expect(PANEL_BAR_TABS.map((t) => t.key)).toEqual(['dictionary', 'vocabulary', 'studyModes', 'settings']);
    expect(PANEL_TOOLS_TABS.map((t) => t.key)).toEqual(['playlist', 'queue', 'recap']);
  });

  it('renders at most 5 destinations — 4 bar tabs + the Tools button', () => {
    renderNav();
    const nav = screen.getByTestId('universal-panel-bottom-nav');
    expect(nav.querySelectorAll('button')).toHaveLength(5);
    expect(screen.getByTestId('universal-panel-mobile-tab-dictionary')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-mobile-tab-vocabulary')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-mobile-tab-studyModes')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-mobile-tab-settings')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-mobile-tools')).toBeInTheDocument();
  });

  it('marks the active bar item with aria-current', () => {
    renderNav('vocabulary');
    expect(screen.getByTestId('universal-panel-mobile-tab-vocabulary')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('universal-panel-mobile-tools')).not.toHaveAttribute('aria-current');
  });

  it('shows no bar indicator when a demoted tab is active (Tools stays unmarked)', () => {
    renderNav('playlist');
    const nav = screen.getByTestId('universal-panel-bottom-nav');
    expect(nav.querySelector('[aria-current]')).toBeNull();
  });

  it('lists demoted tabs as navigation rows in the Tools sheet (≤2 taps)', () => {
    const onTabChange = jest.fn();
    renderNav('dictionary', onTabChange);
    fireEvent.click(screen.getByTestId('universal-panel-mobile-tools'));

    const sheet = screen.getByTestId('universal-panel-tools-sheet');
    const playlistRow = screen.getByTestId('universal-panel-mobile-tab-playlist');
    const recapRow = screen.getByTestId('universal-panel-mobile-tab-recap');
    expect(sheet.contains(playlistRow)).toBe(true);
    expect(sheet.contains(recapRow)).toBe(true);
    expect(playlistRow).toHaveTextContent('Playlist');
    expect(recapRow).toHaveTextContent('Recap');

    // Tap 2: row activates the tab and closes the sheet.
    fireEvent.click(playlistRow);
    expect(onTabChange).toHaveBeenCalledWith('playlist');
    expect(screen.queryByTestId('universal-panel-tools-sheet')).not.toBeInTheDocument();
  });

  it('marks the active demoted row inside the sheet', () => {
    renderNav('recap');
    fireEvent.click(screen.getByTestId('universal-panel-mobile-tools'));
    const recapRow = screen.getByTestId('universal-panel-mobile-tab-recap');
    const playlistRow = screen.getByTestId('universal-panel-mobile-tab-playlist');
    expect(recapRow).toHaveAttribute('aria-current', 'page');
    expect(recapRow).toHaveAttribute('aria-checked', 'true');
    expect(playlistRow).not.toHaveAttribute('aria-current');
    expect(playlistRow).toHaveAttribute('aria-checked', 'false');
  });

  it('renders the Tools sheet without a decorative drag handle', () => {
    renderNav();
    fireEvent.click(screen.getByTestId('universal-panel-mobile-tools'));
    const sheet = screen.getByTestId('universal-panel-tools-sheet');
    expect(sheet.querySelector('.dragHandle')).toBeNull();
  });
});
