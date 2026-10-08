import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { ManagerState, SubtitlePanelsProps, SubtitlePanelsRef } from './subtitlePanelsTypes';

jest.mock('./NavCluster', () => ({ NavCluster: () => null }));
jest.mock('./SubtitleBlock', () => ({ SubtitleBlock: () => null }));
jest.mock('./ClusterRightToolbar', () => ({ ClusterRightToolbar: () => null }));
jest.mock('./OffsetLayer', () => ({ OffsetLayer: () => null }));
jest.mock('./SubtitleToast', () => ({ SubtitleToast: () => null }));
jest.mock('./SubtitleHint', () => ({ SubtitleHint: () => null }));
jest.mock('./SubtitlePanel', () => ({ SubtitlePanel: () => null }));
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
jest.mock('./subtitleSplitView', () => ({
  useSplitView: () => ({
    splitViewOpen: false,
    splitViewPortalTarget: null,
    handleToggleSplitView: () => undefined,
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

jest.mock('@/shared/ui/useIsMobile', () => ({ useIsMobile: () => false }));
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
