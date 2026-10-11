import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { ManagerState, SubtitlePanelsProps, SubtitlePanelsRef } from './subtitlePanelsTypes';

jest.mock('./NavCluster', () => ({ NavCluster: () => <div data-cell-id="nav-cluster-mock" /> }));
jest.mock('./SubtitleBlock', () => ({ SubtitleBlock: () => <div data-cell-id="subtitle-block-mock" /> }));
jest.mock('./ClusterRightToolbar', () => ({ ClusterRightToolbar: () => <div data-cell-id="right-toolbar-mock" /> }));
jest.mock('./OffsetLayer', () => ({ OffsetLayer: () => null }));
jest.mock('./SubtitleToast', () => ({ SubtitleToast: () => null }));
jest.mock('./SubtitleHint', () => ({ SubtitleHint: () => null }));
jest.mock('./SubtitlePanel', () => ({ SubtitlePanel: () => <div data-cell-id="subtitle-panel-mock" /> }));
let mockChromeProps: Record<string, unknown> | null = null;
jest.mock('./MobileCueChrome', () => ({
  MobileCueChrome: (props: Record<string, unknown>) => {
    mockChromeProps = props;
    return <div data-cell-id="mobile-cue-chrome" />;
  },
}));
let mockPmProps: { cueListOpen: boolean; onCueListOpenChange: (open: boolean) => void } | null = null;
jest.mock('./PlayerModeLayer', () => ({
  PlayerModeLayer: (props: { cueListOpen: boolean; onCueListOpenChange: (open: boolean) => void }) => {
    mockPmProps = props;
    return <div data-cell-id="pm-layer" />;
  },
}));
jest.mock('./ManagerLayer', () => ({
  ManagerLayer: () => <div data-cell-id="subtitle-manager-layer" />,
}));

jest.mock('./subtitlePlayerMode', () => ({
  usePlayerMode: ({ setPlayerMode }: { setPlayerMode: (u: (p: boolean) => boolean) => void }) =>
    () => setPlayerMode((p) => !p),
}));
const mockSetSplitViewOpen = jest.fn();
let mockSplitView: { open: boolean; target: HTMLElement | null } = { open: false, target: null };
jest.mock('./subtitleSplitView', () => ({
  useSplitView: () => ({
    splitViewOpen: mockSplitView.open,
    splitViewPortalTarget: mockSplitView.target,
    handleToggleSplitView: () => { mockSplitView.open = !mockSplitView.open; },
    setSplitViewOpen: mockSetSplitViewOpen,
    drainPendingRestore: () => undefined,
  }),
}));
jest.mock('./subtitleManagerHost', () => ({
  useManagerHostDelegation: () => ({ managerOpenOnHost: false }),
}));
jest.mock('./subtitleDrag', () => ({
  useSubtitleBlockDrag: () => ({
    dragging: false,
    handlePointerDown: () => undefined,
    handlePointerMove: () => undefined,
    handlePointerUp: () => undefined,
  }),
}));

let portalEl: HTMLElement | null = null;
jest.mock('./subtitlePortals', () => ({
  useOverlayPortals: () => {
    if (!portalEl) {
      portalEl = document.createElement('div');
      document.body.appendChild(portalEl);
    }
    return { managerPortalTarget: portalEl };
  },
}));

let mockIsMobile = false;
jest.mock('@/shared/ui/useIsMobile', () => ({ useIsMobile: () => mockIsMobile }));
jest.mock('@/shared/lib/chrome-apis', () => ({
  getStorage: () => Promise.resolve({}),
  setStorage: () => Promise.resolve(),
  onStorageChanged: () => undefined,
  removeOnStorageChangedListener: () => undefined,
}));
jest.mock('@/features/theme', () => ({
  ShadowThemeProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/features/studyModes', () => ({
  loadStudyModeState: () => Promise.resolve(),
  useStudyModeStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ activeModeId: undefined, customModes: [], setActiveModeId: () => undefined }),
}));

import { SubtitlePanels } from './SubtitlePanels';

const style: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#fff',
  backgroundColor: '#000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

const manager: ManagerState = {
  targetItems: [],
  nativeItems: [],
  targetActiveIndex: 0,
  nativeActiveIndex: 0,
  onSelect: jest.fn(),
  hasSearchKeys: false,
  apiKeys: [],
  onApiKeysChange: jest.fn(),
  onSearchResultSelect: jest.fn(),
};

function renderPanels(extraProps?: Partial<SubtitlePanelsProps>): SubtitlePanelsRef {
  const ref = createRef<SubtitlePanelsRef>();
  render(
    <SubtitlePanels
      ref={ref}
      targetStyle={style}
      nativeStyle={style}
      collapsed={false}
      isPlaying={false}
      repeatActive={false}
      yOffsetPercent={75}
      onPrev={jest.fn()}
      onNext={jest.fn()}
      onRepeat={jest.fn()}
      onRewind={jest.fn()}
      onForward={jest.fn()}
      onPlayPause={jest.fn()}
      onToggleCollapsed={jest.fn()}
      {...extraProps}
    />,
  );
  return ref.current!;
}

describe('SubtitlePanels — manager layer in Player Mode (AC-17)', () => {
  it('renders the manager layer while Player Mode is active', () => {
    const ref = renderPanels();
    act(() => { ref.setManager(manager); });
    act(() => { ref.setManagerOpen(true); });
    expect(screen.getByTestId('subtitle-manager-layer')).toBeInTheDocument();

    act(() => { ref.togglePlayerMode(); });
    expect(screen.getByTestId('pm-layer')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-manager-layer')).toBeInTheDocument();
  });

  it('manager opened inside PM still renders', () => {
    const ref = renderPanels();
    act(() => { ref.togglePlayerMode(); });
    act(() => { ref.setManager(manager); });
    act(() => { ref.setManagerOpen(true); });
    expect(screen.getByTestId('subtitle-manager-layer')).toBeInTheDocument();
  });
});

describe('SubtitlePanels — PM cue list independent from Split View (AC-6.5)', () => {
  beforeEach(() => {
    mockPmProps = null;
    mockSetSplitViewOpen.mockClear();
  });

  it('entering/exiting Player Mode never touches splitViewOpen state', () => {
    const onSplitViewChange = jest.fn();
    const ref = renderPanels({ onSplitViewChange });

    act(() => { ref.togglePlayerMode(); });
    expect(mockPmProps?.cueListOpen).toBe(true);

    act(() => { mockPmProps?.onCueListOpenChange(false); });
    expect(mockPmProps?.cueListOpen).toBe(false);

    act(() => { ref.togglePlayerMode(); });
    expect(mockSetSplitViewOpen).not.toHaveBeenCalled();
    expect(onSplitViewChange).not.toHaveBeenCalled();
  });
});

describe('SubtitlePanels — mobile sheet chrome (<600px)', () => {
  beforeEach(() => {
    mockChromeProps = null;
    const target = document.createElement('div');
    document.body.appendChild(target);
    mockSplitView = { open: true, target };
  });
  afterEach(() => {
    mockSplitView.target?.remove();
    mockIsMobile = false;
    mockSplitView = { open: false, target: null };
  });

  it('renders MobileCueChrome instead of SubtitlePanel and hides on-video layers', () => {
    mockIsMobile = true;
    renderPanels({ onSeek: jest.fn() });
    expect(screen.getByTestId('mobile-cue-chrome')).toBeInTheDocument();
    expect(screen.queryByTestId('subtitle-panel-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-cluster-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subtitle-block-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-toolbar-mock')).not.toBeInTheDocument();
  });

  it('keeps the on-video overlay when the sheet is closed', () => {
    mockIsMobile = true;
    mockSplitView.open = false;
    renderPanels({ onSeek: jest.fn() });
    expect(screen.queryByTestId('mobile-cue-chrome')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-cluster-mock')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-block-mock')).toBeInTheDocument();
    expect(screen.getByTestId('right-toolbar-mock')).toBeInTheDocument();
  });

  it('desktop sheet keeps the regular SubtitlePanel and the overlay layers', () => {
    renderPanels({ onSeek: jest.fn() });
    expect(screen.getByTestId('subtitle-panel-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-cue-chrome')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-cluster-mock')).toBeInTheDocument();
  });

  it('forwards repeatIcon to MobileCueChrome', () => {
    mockIsMobile = true;
    renderPanels({ onSeek: jest.fn(), repeatIcon: 'navRepeatA' });
    expect(mockChromeProps?.repeatIcon).toBe('navRepeatA');
  });

  it('wires the sheet exit button to the split-view toggle', () => {
    mockIsMobile = true;
    renderPanels({ onSeek: jest.fn() });
    expect(mockChromeProps?.cueListOpen).toBe(true);
    act(() => { (mockChromeProps?.onExit as () => void)(); });
    expect(mockSplitView.open).toBe(false);
  });
});
