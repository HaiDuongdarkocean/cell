import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

const mockLanguages = [
  { srclang: 'en', label: 'English' },
  { srclang: 'es', label: 'Spanish' },
  { srclang: 'ja', label: 'Japanese' },
];

describe('LanguageSelector', () => {
  it('renders a trigger with aria-label', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Subtitle language')).toBeInTheDocument();
  });

  it('shows the selected language label in the trigger', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('renders all language options when opened', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Subtitle language'));
    expect(screen.getByText('Spanish')).toBeInTheDocument();
    expect(screen.getByText('Japanese')).toBeInTheDocument();
  });

  it('reflects the controlled value', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="es"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Spanish')).toBeInTheDocument();
  });

  it('calls onChange with the selected srclang', () => {
    const onChange = jest.fn();
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Subtitle language'));
    fireEvent.click(screen.getByText('Japanese'));
    expect(onChange).toHaveBeenCalledWith('ja');
  });

  it('applies data-cell-id', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
        dataTestId="lang-select"
      />,
    );
    expect(screen.getByTestId('lang-select')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
        disabled
      />,
    );
    expect(screen.getByLabelText('Subtitle language')).toBeDisabled();
  });
});
