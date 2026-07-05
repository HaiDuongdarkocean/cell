import { render, screen, fireEvent } from '@testing-library/react';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { useThemeStore } from '@/stores/themeStore';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';

// Mock chrome.storage cho themeStore (ThemePanel dùng useThemeStore).
const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
const storageLocalSetMock = jest.fn<Promise<void>, [Record<string, unknown>]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
  // jsdom matchMedia mock
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
  storageLocalGetMock.mockResolvedValue({});
  useThemeStore.setState({ mode: 'dark', config: DEFAULT_THEME_CONFIG, isLoaded: true });
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('ThemePanel', () => {
  it('renders panel with all sections', () => {
    render(<ThemePanel />);
    expect(screen.getByTestId('theme-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mode-cards')).toBeInTheDocument();
    expect(screen.getByTestId('color-customization')).toBeInTheDocument();
    expect(screen.getByTestId('theme-preview')).toBeInTheDocument();
    expect(screen.getByTestId('contrast-badges')).toBeInTheDocument();
    expect(screen.getByTestId('theme-import-export')).toBeInTheDocument();
  });

  it('switching mode via ModeCards calls themeStore.switchMode', () => {
    render(<ThemePanel />);
    fireEvent.click(screen.getByTestId('mode-card-system'));
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('reset shows confirm dialog, cancel keeps config', () => {
    render(<ThemePanel />);
    fireEvent.click(screen.getByTestId('theme-reset-btn'));
    expect(screen.getByTestId('theme-reset-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('theme-reset-no'));
    expect(screen.queryByTestId('theme-reset-confirm')).not.toBeInTheDocument();
  });

  it('reset confirm Yes calls resetTheme', () => {
    // Mutate config first
    useThemeStore.getState().updateColor('dark', 'primary', '#ff0000');
    render(<ThemePanel />);
    fireEvent.click(screen.getByTestId('theme-reset-btn'));
    fireEvent.click(screen.getByTestId('theme-reset-yes'));
    expect(useThemeStore.getState().config).toEqual(DEFAULT_THEME_CONFIG);
  });

  it('shows contrast badges for resolved mode', () => {
    render(<ThemePanel />);
    // dark mode default → 3 badges
    expect(screen.getByTestId('contrast-badge-Text / Canvas')).toBeInTheDocument();
  });
});
