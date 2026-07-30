import { render } from '@testing-library/react';
import { Separator } from './Separator';

describe('Separator', () => {
  it('renders a separator element', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders all orientations', () => {
    const orientations = ['horizontal', 'vertical'] as const;
    for (const orientation of orientations) {
      const { container, unmount } = render(<Separator orientation={orientation} />);
      expect(container.firstChild).toHaveClass(orientation);
      unmount();
    }
  });

  it('renders all variants', () => {
    const variants = ['solid', 'dashed'] as const;
    for (const variant of variants) {
      const { container, unmount } = render(<Separator variant={variant} />);
      expect(container.firstChild).toHaveClass(variant);
      unmount();
    }
  });

  it('is aria-hidden when decorative', () => {
    const { container } = render(<Separator decorative />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role=separator when not decorative', () => {
    const { container } = render(<Separator decorative={false} />);
    expect(container.firstChild).toHaveAttribute('role', 'separator');
    expect(container.firstChild).not.toHaveAttribute('aria-hidden');
  });

  it('sets aria-orientation when semantic', () => {
    const { container } = render(<Separator decorative={false} orientation="vertical" />);
    expect(container.firstChild).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('merges custom className', () => {
    const { container } = render(<Separator className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
