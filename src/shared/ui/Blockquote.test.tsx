import { render, screen } from '@testing-library/react';
import { Blockquote } from './Blockquote';

describe('Blockquote', () => {
  it('renders a blockquote element', () => {
    const { container } = render(<Blockquote>Quote text</Blockquote>);
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('Quote text')).toBeInTheDocument();
  });

  it('renders all variants', () => {
    const variants = ['default', 'bordered'] as const;
    for (const variant of variants) {
      const { container, unmount } = render(<Blockquote variant={variant}>{variant}</Blockquote>);
      expect(container.querySelector('blockquote')).toHaveClass(variant);
      unmount();
    }
  });

  it('sets cite attribute when provided', () => {
    const { container } = render(<Blockquote cite="https://example.com">Quote</Blockquote>);
    expect(container.querySelector('blockquote')).toHaveAttribute('cite', 'https://example.com');
  });

  it('renders citation text in a cite element', () => {
    const { container } = render(<Blockquote citation="Author">Quote</Blockquote>);
    const cite = container.querySelector('cite');
    expect(cite).toBeInTheDocument();
    expect(cite).toHaveTextContent('Author');
  });

  it('merges custom className', () => {
    const { container } = render(<Blockquote className="extra">Quote</Blockquote>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
