import { render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('renders an icon by name', () => {
    const { container } = render(<Icon name="play" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders all sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { container, unmount } = render(<Icon name="check" size={size} />);
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all colors', () => {
    const colors = ['primary', 'secondary', 'disabled', 'inverse'] as const;
    for (const color of colors) {
      const { container, unmount } = render(<Icon name="info" color={color} />);
      expect(container.firstChild).toHaveClass(color);
      unmount();
    }
  });

  it('is aria-hidden by default (decorative)', () => {
    const { container } = render(<Icon name="search" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('sets role=img and aria-label when label is provided', () => {
    const { container } = render(<Icon name="alertCircle" label="Error" />);
    expect(container.firstChild).toHaveAttribute('role', 'img');
    expect(container.firstChild).toHaveAttribute('aria-label', 'Error');
    expect(container.firstChild).not.toHaveAttribute('aria-hidden');
  });

  it('merges custom className', () => {
    const { container } = render(<Icon name="x" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
