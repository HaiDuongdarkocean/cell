import { render, screen, fireEvent } from '@testing-library/react';
import { LauncherTile } from './LauncherTile';

describe('LauncherTile', () => {
  it('renders icon and label', () => {
    render(<LauncherTile icon="bookOpen" label="Dictionary" />);
    expect(screen.getByRole('button', { name: 'Dictionary' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<LauncherTile icon="bookOpen" label="Dictionary" onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictionary' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
