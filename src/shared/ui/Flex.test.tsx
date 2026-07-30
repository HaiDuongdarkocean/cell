import { render, screen } from '@testing-library/react';
import { Flex } from './Flex';

describe('Flex', () => {
  it('renders children', () => {
    render(<Flex>Content</Flex>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders all directions', () => {
    const directions = ['row', 'column', 'row-reverse', 'column-reverse'] as const;
    for (const direction of directions) {
      const { unmount } = render(<Flex direction={direction}>{direction}</Flex>);
      expect(screen.getByText(direction)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all justify values', () => {
    const justifies = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const;
    for (const justify of justifies) {
      const { unmount } = render(<Flex justify={justify}>{justify}</Flex>);
      expect(screen.getByText(justify)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all align values', () => {
    const aligns = ['start', 'center', 'end', 'stretch', 'baseline'] as const;
    for (const align of aligns) {
      const { unmount } = render(<Flex align={align}>{align}</Flex>);
      expect(screen.getByText(align)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all wrap values', () => {
    const wraps = ['nowrap', 'wrap', 'wrap-reverse'] as const;
    for (const wrap of wraps) {
      const { unmount } = render(<Flex wrap={wrap}>{wrap}</Flex>);
      expect(screen.getByText(wrap)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies gap prop', () => {
    const { container } = render(<Flex gap="4">Gapped</Flex>);
    expect(container.firstChild).toHaveClass('gap4');
  });

  it('applies inline mode', () => {
    const { container } = render(<Flex inline>Inline</Flex>);
    expect(container.firstChild).toHaveClass('inline');
  });

  it('merges custom className', () => {
    const { container } = render(<Flex className="extra">Flex</Flex>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
