// OcrSettingsPanel tests — T17-T20 + 4-card redesign (UI e2e).

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
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
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

async function renderEnabled(): Promise<{ container: HTMLElement }> {
  const { container } = render(<OcrSettingsPanel url={TEST_URL} />);
  await waitFor(() => {
    expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
  });
  fireEvent.click(getOcrToggle());
  await waitFor(() => {
    expect(container.querySelector('[data-cell-id="ocr-target-language"]')).toBeTruthy();
  });
  return { container };
}

describe('OcrSettingsPanel language dropdowns (Task 8)', () => {
  it('renders target + native language selects', async () => {
    const { container } = await renderEnabled();
    expect(container.querySelector('[data-cell-id="ocr-target-language"]')).toBeTruthy();
    expect(container.querySelector('[data-cell-id="ocr-native-language"]')).toBeTruthy();
  });

  it('offers ≥100 language options (auto + full PaddleOCR catalog)', async () => {
    await renderEnabled();
    // Open the target language menu and count rendered options. The menu is
    // rendered in a portal, so options are in the global document.
    fireEvent.click(screen.getByRole('button', { name: 'OCR target language' }));
    await waitFor(() => {
      expect(screen.queryAllByRole('option').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByRole('option').length).toBeGreaterThanOrEqual(100);
  });

  it("selecting 'vi' target persists targetLangOverride", async () => {
    await renderEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'OCR target language' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Vietnamese' }));
    await waitFor(() => {
      expect(getSavedOrigin()?.targetLangOverride).toBe('vi');
    });
  });

  it('reset button always visible; disabled when no override, enabled when override set', async () => {
    const { container } = await renderEnabled();
    // Reset button always present, disabled by default (no override).
    const resetBtn = container.querySelector('[data-cell-id="ocr-target-lang-reset"]') as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    expect(resetBtn.disabled).toBe(true);
    // Set an override → reset enabled.
    fireEvent.click(screen.getByRole('button', { name: 'OCR target language' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Vietnamese' }));
    await waitFor(() => {
      expect(getSavedOrigin()?.targetLangOverride).toBe('vi');
    });
    await waitFor(() => {
      const btn = container.querySelector('[data-cell-id="ocr-target-lang-reset"]') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
    // Click reset → override null + button disabled again.
    fireEvent.click(container.querySelector('[data-cell-id="ocr-target-lang-reset"]') as HTMLElement);
    await waitFor(() => {
      expect(getSavedOrigin()?.targetLangOverride).toBeNull();
    });
    await waitFor(() => {
      const btn = container.querySelector('[data-cell-id="ocr-target-lang-reset"]') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
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

// ─── 4-card redesign: structure + section headers + region buttons ───

describe('OcrSettingsPanel 4-card redesign (UI e2e)', () => {
  it('renders exactly 1 toggle card when disabled (no config cards)', async () => {
    const { container } = render(<OcrSettingsPanel url={TEST_URL} />);
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
    });
    const cards = container.querySelectorAll('[data-testid="ocr-settings-panel"] > div');
    expect(cards.length).toBe(1);
  });

  it('renders 4 cards when enabled: toggle + languages + split + capture region', async () => {
    const { container } = await renderEnabled();
    const cards = container.querySelectorAll('[data-testid="ocr-settings-panel"] > div');
    expect(cards.length).toBe(4);
  });

  it('shows 3 section headers when enabled: LANGUAGES, SPLIT, CAPTURE REGION', async () => {
    const { container } = await renderEnabled();
    const headers = container.querySelectorAll('[class*="sectionHeader"]');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe('Languages');
    expect(headers[1].textContent).toBe('Split');
    expect(headers[2].textContent).toBe('Capture region');
  });

  it('hides all section headers when disabled', async () => {
    const { container } = render(<OcrSettingsPanel url={TEST_URL} />);
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('false');
    });
    const headers = container.querySelectorAll('[class*="sectionHeader"]');
    expect(headers.length).toBe(0);
  });

  it('language fields are stacked (label row + select, not inline)', async () => {
    const { container } = await renderEnabled();
    // Each langField contains a langLabelRow + a Select (by data-cell-id).
    const langFields = container.querySelectorAll('[class*="langField"]');
    expect(langFields.length).toBe(2);
    const selectIds = ['ocr-target-language', 'ocr-native-language'];
    langFields.forEach((field, i) => {
      const labelRow = field.querySelector('[class*="langLabelRow"]');
      const select = field.querySelector(`[data-cell-id="${selectIds[i]}"]`);
      expect(labelRow).toBeTruthy();
      expect(select).toBeTruthy();
      // Select should NOT be inside the labelRow (stacked, not inline).
      expect(labelRow?.contains(select)).toBe(false);
    });
  });

  it('region buttons are horizontal (icon + label inline, not vertical)', async () => {
    const { container } = await renderEnabled();
    const selectBtn = container.querySelector('[data-cell-id="ocr-region-select"]') as HTMLButtonElement;
    const resetBtn = container.querySelector('[data-cell-id="ocr-region-reset"]') as HTMLButtonElement;
    expect(selectBtn).toBeTruthy();
    expect(resetBtn).toBeTruthy();
    // Labels present: "Select", "Reset" (horizontal = icon + label inline).
    expect(selectBtn.textContent?.trim()).toBe('Select');
    expect(resetBtn.textContent?.trim()).toBe('Reset');
    // Edit button hidden by default (no custom region).
    expect(container.querySelector('[data-cell-id="ocr-region-edit"]')).toBeNull();
  });

  it('edit button appears when custom region is set', async () => {
    // Seed a custom region in storage before render.
    storageData['ocrSettings'] = {
      schemaVersion: 1,
      origins: {
        [TEST_ORIGIN]: {
          ...({} as SavedOriginState),
          ocrEnabled: true,
          customRegion: { xPct: 10, yPct: 70, widthPct: 60, heightPct: 25 },
        },
      },
    };
    const { container } = render(<OcrSettingsPanel url={TEST_URL} />);
    await waitFor(() => {
      expect(getOcrToggle().getAttribute('aria-checked')).toBe('true');
    });
    await waitFor(() => {
      expect(container.querySelector('[data-cell-id="ocr-region-edit"]')).toBeTruthy();
    });
    const editBtn = container.querySelector('[data-cell-id="ocr-region-edit"]') as HTMLButtonElement;
    expect(editBtn.textContent?.trim()).toBe('Edit');
  });

  it('info hint expands/collapses on click', async () => {
    const { container } = render(<OcrSettingsPanel url={TEST_URL} />);
    await waitFor(() => {
      expect(getOcrToggle()).toBeTruthy();
    });
    const infoBtn = container.querySelector('[data-cell-id="ocr-info-btn"]') as HTMLButtonElement;
    expect(infoBtn).toBeTruthy();
    expect(infoBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(infoBtn);
    expect(infoBtn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(infoBtn);
    expect(infoBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('region sliders render 4: Position X, Position Y, Width, Height', async () => {
    await renderEnabled();
    const xSlider = screen.getByRole('slider', { name: 'Region X position' });
    const ySlider = screen.getByRole('slider', { name: 'Region Y position' });
    const wSlider = screen.getByRole('slider', { name: 'Region width' });
    const hSlider = screen.getByRole('slider', { name: 'Region height' });
    expect(xSlider).toBeTruthy();
    expect(ySlider).toBeTruthy();
    expect(wSlider).toBeTruthy();
    expect(hSlider).toBeTruthy();
  });
});
