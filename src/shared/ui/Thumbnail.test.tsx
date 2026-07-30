import { render, screen, fireEvent } from '@testing-library/react';
import { Thumbnail } from './Thumbnail';

describe('Thumbnail', () => {
  it('renders an img with src and alt', () => {
    render(<Thumbnail src="/test.jpg" alt="Test image" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/test.jpg');
    expect(img).toHaveAttribute('alt', 'Test image');
  });

  it('applies ratio class', () => {
    const { container } = render(<Thumbnail src="/test.jpg" alt="Test" ratio="16:9" />);
    expect(container.firstChild).toHaveClass('ratio16x9');
  });

  it('defaults to 1:1 ratio', () => {
    const { container } = render(<Thumbnail src="/test.jpg" alt="Test" />);
    expect(container.firstChild).toHaveClass('ratio1x1');
  });

  it('shows fallback when image errors and no fallbackSrc', () => {
    const { container } = render(<Thumbnail src="/broken.jpg" alt="Broken" showSkeleton={false} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Broken');
  });

  it('switches to fallbackSrc on error', () => {
    render(<Thumbnail src="/primary.jpg" alt="Test" fallbackSrc="/fallback.jpg" showSkeleton={false} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/fallback.jpg');
  });

  it('merges custom className', () => {
    const { container } = render(<Thumbnail src="/test.jpg" alt="Test" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
