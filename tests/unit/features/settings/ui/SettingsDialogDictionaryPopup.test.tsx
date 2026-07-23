import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsDialog } from '@/features/settings/ui/SettingsDialog';
import { DEFAULT_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/settings';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('SettingsDialog dictionary popup default active tab', () => {
  it('emits settings with image defaultActiveTab when changed', () => {
    const onChange = jest.fn();
    const settings = makeSettings({
      dictionaryPopup: { ...DEFAULT_DICTIONARY_POPUP_SETTINGS, defaultActiveTab: null },
    });
    render(<SettingsDialog isOpen settings={settings} onChange={onChange} onClose={jest.fn()} />);

    const select = screen.getByLabelText(/Default active tab/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'image' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dictionaryPopup: expect.objectContaining({ defaultActiveTab: 'image' }),
      }),
    );
  });
});
