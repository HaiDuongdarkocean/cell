import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

const mockLanguages = [
  { srclang: 'en', label: 'English' },
  { srclang: 'es', label: 'Spanish' },
  { srclang: 'ja', label: 'Japanese' },
];

describe('LanguageSelector', () => {
  it('renders a select element with aria-label', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Subtitle language')).toBeInTheDocument();
  });

  it('renders all language options', () => {
    render(
      <LanguageSelector
        languages={mockLanguages}
        value="en"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('English')).toBeInTheDocument();
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
    const select = screen.getByLabelText('Subtitle language') as HTMLSelectElement;
    expect(select.value).toBe('es');
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
    const select = screen.getByLabelText('Subtitle language');
    fireEvent.change(select, { target: { value: 'ja' } });
    expect(onChange).toHaveBeenCalledWith('ja');
  });

  it('applies data-testid', () => {
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
