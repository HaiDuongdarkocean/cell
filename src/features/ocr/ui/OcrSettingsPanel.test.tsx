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
      const select = container.querySelector('[data-cell-id="ocr-language-mode"]');
      expect(select).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('hides config options when disabled', async () => {
    render(<OcrSettingsPanel url="https://themoviebox.xyz/movies/123" />);
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
    expect(screen.queryByTestId('ocr-language-mode')).toBeNull();
  });
});
