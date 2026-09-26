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

describe('DictionaryPopupSettingsPanel — surface tabs', () => {
  it('renders the popup-like tab strip with audio/image/translate/links', () => {
    renderPanel();
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audio/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /image/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /translate/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /links/i })).toBeInTheDocument();
  });

  it('defaults to the links tab showing stored external links', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: /links/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Cambridge Dictionary')).toBeInTheDocument();
  });

  it('translate tab shows the translation visibility pills', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /translate/i }));
    expect(screen.getByRole('radiogroup', { name: 'Translations' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Always shown' })).toBeInTheDocument();
  });

  it('audio and image tabs show empty-state hints without the manager', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /^audio/i }));
    expect(screen.queryByText('Cambridge Dictionary')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /image/i }));
    expect(screen.queryByText('Cambridge Dictionary')).not.toBeInTheDocument();
  });

  it('manager edits propagate through onChange with sibling fields preserved', () => {
    const onChange = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /edit cambridge/i }));
    fireEvent.change(screen.getByTestId('dict-link-editor-name'), { target: { value: 'Cambridge EN' } });
    fireEvent.click(screen.getByTestId('dict-link-editor-save'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      triggerMode: DEFAULT_DICTIONARY_POPUP_SETTINGS.triggerMode,
      externalDictLinks: expect.arrayContaining([
        expect.objectContaining({ name: 'Cambridge EN' }),
      ]),
    }));
  });
});
