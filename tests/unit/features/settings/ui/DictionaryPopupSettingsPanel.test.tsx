import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DictionaryPopupSettingsPanel } from '@/features/settings/ui/DictionaryPopupSettingsPanel';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings } from '@/entities/settings';

function makeProps(overrides: Partial<DictionaryPopupSettings> = {}) {
  const settings: DictionaryPopupSettings = { ...DEFAULT_DICTIONARY_POPUP_SETTINGS, ...overrides };
  return {
    settings,
    onChange: jest.fn(),
  };
}

describe('DictionaryPopupSettingsPanel', () => {
  it('calls onChange with selected default active tab (image)', () => {
    const props = makeProps({ defaultActiveTab: null });
    render(<DictionaryPopupSettingsPanel {...props} />);
    const select = screen.getByLabelText(/Default active tab/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'image' } });
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ defaultActiveTab: 'image' }),
    );
  });

  it('calls onChange with null when selecting None', () => {
    const props = makeProps({ defaultActiveTab: 'audio' });
    render(<DictionaryPopupSettingsPanel {...props} />);
    const select = screen.getByLabelText(/Default active tab/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ defaultActiveTab: null }),
    );
  });

  it('clears stale defaultActiveTabPerLang when defaultActiveTab changes', () => {
    const props = makeProps({
      defaultActiveTab: 'audio',
      defaultActiveTabPerLang: { en: 'audio' },
    });
    render(<DictionaryPopupSettingsPanel {...props} />);
    const select = screen.getByLabelText(/Default active tab/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'image' } });
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ defaultActiveTab: 'image', defaultActiveTabPerLang: undefined }),
    );
  });

  it('preserves defaultActiveTabPerLang when other fields change', () => {
    const props = makeProps({
      defaultActiveTab: 'audio',
      defaultActiveTabPerLang: { en: 'audio' },
    });
    render(<DictionaryPopupSettingsPanel {...props} />);
    const checkbox = screen.getByLabelText(/Enable Dictionary Popup/i) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ defaultActiveTabPerLang: { en: 'audio' } }),
    );
  });
});
