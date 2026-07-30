import { render, screen } from '@testing-library/react';
import { Heading } from './Heading';

describe('Heading', () => {
  it('renders h1 by default', () => {
    const { container } = render(<Heading>Title</Heading>);
    expect(container.querySelector('h1')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders the correct tag for each level', () => {
    const levels = [1, 2, 3, 4, 5, 6] as const;
    for (const level of levels) {
      const { container, unmount } = render(<Heading level={level}>L{level}</Heading>);
      expect(container.querySelector(`h${level}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies visual size class independent of level', () => {
    const { container } = render(<Heading level={2} size={4}>Decoupled</Heading>);
    const el = container.querySelector('h2');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('size-4');
  });

  it('defaults visual size to level when size is omitted', () => {
    const { container } = render(<Heading level={3}>Default size</Heading>);
    expect(container.querySelector('h3')).toHaveClass('size-3');
  });

  it('merges custom className', () => {
    const { container } = render(<Heading className="extra">Custom</Heading>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
