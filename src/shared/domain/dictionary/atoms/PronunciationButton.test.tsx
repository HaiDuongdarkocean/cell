import { render, screen, fireEvent } from '@testing-library/react';
import { PronunciationButton } from './PronunciationButton';

describe('PronunciationButton', () => {
  it('renders a button with correct aria-label', () => {
    render(<PronunciationButton word="hello" />);
    expect(screen.getByRole('button', { name: 'Pronounce hello' })).toBeInTheDocument();
  });

  it('renders the volumeHigh icon by default', () => {
    const { container } = render(<PronunciationButton word="hello" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders a spinner when loading', () => {
    const { container } = render(<PronunciationButton word="hello" loading />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when loading', () => {
    render(<PronunciationButton word="hello" loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires click handler', () => {
    const onClick = jest.fn();
    render(<PronunciationButton word="hello" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<PronunciationButton word="hello" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
