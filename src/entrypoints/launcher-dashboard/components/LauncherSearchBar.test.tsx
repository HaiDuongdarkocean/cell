import { render, screen, fireEvent } from '@testing-library/react';
import { LauncherSearchBar } from './LauncherSearchBar';

describe('LauncherSearchBar', () => {
  it('renders the search input with placeholder', () => {
    render(<LauncherSearchBar />);
    const input = screen.getByRole('searchbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search Cell…');
  });

  it('reflects controlled value and calls onChange', () => {
    const handleChange = jest.fn();
    const { rerender } = render(<LauncherSearchBar value="" onChange={handleChange} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dic' } });
    expect(handleChange).toHaveBeenCalledWith('dic');

    rerender(<LauncherSearchBar value="dic" onChange={handleChange} />);
    expect(screen.getByRole('searchbox')).toHaveValue('dic');
  });

  it('shows a clear button when the input has text and clears on click', () => {
    const handleChange = jest.fn();
    render(<LauncherSearchBar value="test" onChange={handleChange} />);

    const clear = screen.getByRole('button', { name: /clear search/i });
    expect(clear).toBeInTheDocument();

    fireEvent.click(clear);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('does not show a clear button when the input is empty', () => {
    render(<LauncherSearchBar value="" />);
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });
});
