import { render, screen } from '@testing-library/react';
import { ThemePreview } from '@/features/theme/ui/ThemePreview';

describe('ThemePreview', () => {
  it('renders preview container', () => {
    render(<ThemePreview />);
    expect(screen.getByTestId('theme-preview')).toBeInTheDocument();
  });

  it('renders buttons section', () => {
    render(<ThemePreview />);
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Secondary')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('renders typography samples', () => {
    render(<ThemePreview />);
    expect(screen.getByText(/Primary text/)).toBeInTheDocument();
    expect(screen.getByText(/Success —/)).toBeInTheDocument();
    expect(screen.getByText(/Error —/)).toBeInTheDocument();
  });

  it('renders card + form + dropzone + toast', () => {
    render(<ThemePreview />);
    expect(screen.getByText('Card content — surface with border')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Text input')).toBeInTheDocument();
    expect(screen.getByText('Drag file here or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Success toast')).toBeInTheDocument();
    expect(screen.getByText('Error toast')).toBeInTheDocument();
  });
});
