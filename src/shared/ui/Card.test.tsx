import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders variants', () => {
    const variants = ['default', 'interactive', 'selected'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Card variant={variant}>{variant}</Card>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="extra-class">Card</Card>);
    expect(container.firstChild).toHaveClass('extra-class');
  });
});
