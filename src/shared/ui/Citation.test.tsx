import { render, screen } from '@testing-library/react';
import { Citation } from './Citation';

describe('Citation', () => {
  it('renders a cite element', () => {
    const { container } = render(<Citation>Author Name</Citation>);
    expect(container.querySelector('cite')).toBeInTheDocument();
    expect(screen.getByText('Author Name')).toBeInTheDocument();
  });

  it('wraps in an anchor when href is provided', () => {
    const { container } = render(<Citation href="https://example.com">Source</Citation>);
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link?.querySelector('cite')).toBeInTheDocument();
  });

  it('does not render an anchor when href is omitted', () => {
    const { container } = render(<Citation>No link</Citation>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('cite')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(<Citation className="extra">Text</Citation>);
    expect(container.querySelector('cite')).toHaveClass('extra');
  });
});
