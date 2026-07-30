import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders fallback initials when no src', () => {
    render(<Avatar alt="John Doe" />);
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('renders image when src is provided', () => {
    render(<Avatar src="https://example.com/a.png" alt="Jane" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.png');
    expect(img).toHaveAttribute('alt', 'Jane');
  });

  it('renders all sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { container, unmount } = render(<Avatar alt="Test" size={size} />);
      expect(container.firstChild).toHaveClass(size);
      unmount();
    }
  });

  it('renders all shapes', () => {
    const shapes = ['circle', 'square'] as const;
    for (const shape of shapes) {
      const { container, unmount } = render(<Avatar alt="Test" shape={shape} />);
      expect(container.firstChild).toHaveClass(shape);
      unmount();
    }
  });

  it('renders status dot with aria-label', () => {
    const { container } = render(<Avatar alt="Test" status="online" />);
    const dot = container.querySelector('[aria-label="status: online"]');
    expect(dot).toBeInTheDocument();
  });

  it('does not render status dot when status is none', () => {
    const { container } = render(<Avatar alt="Test" status="none" />);
    expect(container.querySelector('[aria-label^="status:"]')).not.toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(<Avatar alt="Test" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
