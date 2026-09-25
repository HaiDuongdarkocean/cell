import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DictionaryPopupSettingsPanel } from './DictionaryPopupSettingsPanel';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings } from '@/entities/settings/types';

function renderPanel(settings?: Partial<DictionaryPopupSettings>): jest.Mock<(s: DictionaryPopupSettings) => void> {
  const onChange = jest.fn<(s: DictionaryPopupSettings) => void>();
  render(
    <DictionaryPopupSettingsPanel
      settings={{ ...DEFAULT_DICTIONARY_POPUP_SETTINGS, ...settings }}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('DictionaryPopupSettingsPanel — examples step', () => {
  it('defaults to manual when includeAllExamplesOnDefSelect is unset', () => {
    const { includeAllExamplesOnDefSelect: _omit, ...rest } = DEFAULT_DICTIONARY_POPUP_SETTINGS;
    renderPanel(rest);
    const group = screen.getByRole('radiogroup', { name: 'When selecting a definition' });
    const manual = group.querySelector('[role="radio"][aria-checked="true"]');
    expect(manual).toHaveTextContent('Pick examples myself');
  });

  it('maps the "all" pill to includeAllExamplesOnDefSelect: true', () => {
    const onChange = renderPanel();
    const group = screen.getByRole('radiogroup', { name: 'When selecting a definition' });
    fireEvent.click(screen.getByRole('radio', { name: 'Include all examples' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      includeAllExamplesOnDefSelect: true,
    }));
    expect(group).toBeInTheDocument();
  });

  it('maps the "manual" pill back to includeAllExamplesOnDefSelect: false', () => {
    const onChange = renderPanel({ includeAllExamplesOnDefSelect: true });
    fireEvent.click(screen.getByRole('radio', { name: 'Pick examples myself' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      includeAllExamplesOnDefSelect: false,
    }));
  });
});
