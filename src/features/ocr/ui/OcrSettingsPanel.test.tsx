// OcrSettingsPanel tests — T17-T20.

import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OcrSettingsPanel } from './OcrSettingsPanel';

const storageData: Record<string, unknown> = {};

beforeAll(() => {
  const g = global as unknown as { chrome: unknown };
  g.chrome = {
    storage: {
      local: {
        get: jest.fn(async (keys?: string | string[] | null) => {
          if (typeof keys === 'string') return { [keys]: storageData[keys] };
          return { ...storageData };
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
          Object.assign(storageData, items);
        }),
      },
    },
  };
});

beforeEach(() => {
  Object.keys(storageData).forEach((k) => delete storageData[k]);
});

// Toggle uses data-cell-id (not data-testid) — query by role + aria-label.
function getOcrToggle(): HTMLElement {
  return screen.getByRole('switch', { name: 'Toggle OCR for this site' });
}

describe('OcrSettingsPanel (T17-T20)', () => {
  it('renders with toggle unchecked by default', async () => {
    render(<OcrSettingsPanel url="https://themoviebox.xyz/movies/123" />);
    await waitFor(() => {
      const toggle = getOcrToggle();
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('enables OCR when toggle is clicked', async () => {
    render(<OcrSettingsPanel url="https://themoviebox.xyz/movies/123" />);
    await waitFor(() => {
      expect(getOcrToggle()).toBeTruthy();
    });
    const toggle = getOcrToggle();
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('shows config options when enabled', async () => {
    const { container } = render(<OcrSettingsPanel url="https://themoviebox.xyz/movies/123" />);
    // Wait for initial load.
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
    });
    // Click to enable.
    fireEvent.click(getOcrToggle());
    // Wait for data-enabled to become true.
    await waitFor(() => {
      const panel = container.querySelector('[data-testid="ocr-settings-panel"]');
      expect(panel?.getAttribute('data-enabled')).toBe('true');
    }, { timeout: 3000 });
    // Config should now be visible — query within container.
    await waitFor(() => {
      const select = container.querySelector('[data-cell-id="ocr-target-language"]');
      expect(select).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('hides config options when disabled', async () => {
    const { container } = render(<OcrSettingsPanel url="https://themoviebox.xyz/movies/123" />);
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
    });
    // Enable.
    fireEvent.click(getOcrToggle());
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('true');
    }, { timeout: 3000 });
    // Disable.
    fireEvent.click(getOcrToggle());
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
    }, { timeout: 3000 });
    expect(container.querySelector('[data-cell-id="ocr-target-language"]')).toBeNull();
  });
});

// ─── Task 8: 108-lang dropdowns + split section ───

const TEST_URL = 'https://themoviebox.xyz/movies/123';
const TEST_ORIGIN = 'themoviebox.xyz';

interface SavedOriginState {
  targetLangOverride?: string | null;
  nativeLangOverride?: string | null;
  splitEnabled?: boolean;
  splitRatio?: number;
}

function getSavedOrigin(): SavedOriginState | undefined {
  const saved = storageData['ocrSettings'] as
    | { origins?: Record<string, SavedOriginState> }
    | undefined;
  return saved?.origins?.[TEST_ORIGIN];
}

async function renderEnabled(): Promise<HTMLElement> {
  const { container } = render(<OcrSettingsPanel url={TEST_URL} />);
  await waitFor(() => {
    expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
  });
  fireEvent.click(getOcrToggle());
  await waitFor(() => {
    expect(container.querySelector('[data-cell-id="ocr-target-language"]')).toBeTruthy();
  });
  return container;
}

describe('OcrSettingsPanel language dropdowns (Task 8)', () => {
  it('renders target + native language selects', async () => {
    const container = await renderEnabled();
    expect(container.querySelector('[data-cell-id="ocr-target-language"]')).toBeTruthy();
    expect(container.querySelector('[data-cell-id="ocr-native-language"]')).toBeTruthy();
  });

  it('offers ≥100 language options (auto + full PaddleOCR catalog)', async () => {
    const container = await renderEnabled();
    // Open the target language menu and count rendered options.
    fireEvent.click(screen.getByRole('button', { name: 'OCR target language' }));
    await waitFor(() => {
      expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    });
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThanOrEqual(100);
  });

  it("selecting 'vi' target persists targetLangOverride", async () => {
    await renderEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'OCR target language' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Vietnamese' }));
    await waitFor(() => {
      expect(getSavedOrigin()?.targetLangOverride).toBe('vi');
    });
  });

  it('reset button only appears when override set; clicking clears it', async () => {
    const container = await renderEnabled();
    // No override by default → no reset button.
    expect(container.querySelector('[data-cell-id="ocr-target-lang-reset"]')).toBeNull();
    // Set an override.
    fireEvent.click(screen.getByRole('button', { name: 'OCR target language' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Vietnamese' }));
    await waitFor(() => {
      expect(container.querySelector('[data-cell-id="ocr-target-lang-reset"]')).toBeTruthy();
    });
    // Reset → override null + button disappears.
    fireEvent.click(container.querySelector('[data-cell-id="ocr-target-lang-reset"]') as HTMLElement);
    await waitFor(() => {
      expect(getSavedOrigin()?.targetLangOverride).toBeNull();
    });
    await waitFor(() => {
      expect(container.querySelector('[data-cell-id="ocr-target-lang-reset"]')).toBeNull();
    });
  });
});

describe('OcrSettingsPanel split section (Task 8)', () => {
  it('split toggle + ratio slider persist to storage', async () => {
    await renderEnabled();
    // Enable split.
    const splitToggle = screen.getByRole('switch', { name: 'Toggle split dual subtitles' });
    fireEvent.click(splitToggle);
    await waitFor(() => {
      expect(getSavedOrigin()?.splitEnabled).toBe(true);
    });
    // Ratio slider: 70 (%) → 0.7. (findByRole — slider renders after the state commit.)
    const slider = (await screen.findByRole('slider', { name: 'OCR split ratio' })) as HTMLInputElement;
    expect(slider.value).toBe('50');
    fireEvent.change(slider, { target: { value: '70' } });
    await waitFor(() => {
      expect(getSavedOrigin()?.splitRatio).toBe(0.7);
    });
  });
});
