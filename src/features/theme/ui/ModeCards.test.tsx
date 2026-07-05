import { render, screen, fireEvent } from '@testing-library/react';
import { ModeCards } from '@/features/theme/ui/ModeCards';

describe('ModeCards', () => {
  it('renders 3 mode cards', () => {
    render(<ModeCards value="dark" onChange={jest.fn()} />);
    expect(screen.getByTestId('mode-card-light')).toBeInTheDocument();
    expect(screen.getByTestId('mode-card-dark')).toBeInTheDocument();
    expect(screen.getByTestId('mode-card-system')).toBeInTheDocument();
  });

  it('marks current mode as selected (aria-checked)', () => {
    render(<ModeCards value="dark" onChange={jest.fn()} />);
    expect(screen.getByTestId('mode-card-dark')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('mode-card-light')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when card clicked', () => {
    const onChange = jest.fn();
    render(<ModeCards value="dark" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('mode-card-system'));
    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('keyboard arrow right cycles to next mode', () => {
    const onChange = jest.fn();
    render(<ModeCards value="dark" onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('mode-card-dark'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('keyboard arrow left cycles to previous mode', () => {
    const onChange = jest.fn();
    render(<ModeCards value="light" onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('mode-card-light'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('has radiogroup role', () => {
    render(<ModeCards value="dark" onChange={jest.fn()} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});
