import { render, screen } from '@testing-library/react';
import { Box } from './Box';

describe('Box', () => {
  it('renders children', () => {
    render(<Box>Content</Box>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders as different semantic tags', () => {
    const tags = ['section', 'article', 'main', 'aside', 'header', 'footer', 'nav'] as const;
    for (const tag of tags) {
      const { container, unmount } = render(<Box as={tag}>{tag}</Box>);
      expect(container.querySelector(tag)).toBeTruthy();
      unmount();
    }
  });

  it('renders all bg variants', () => {
    const bgs = ['surface', 'body', 'muted', 'card', 'popover', 'inverted', 'transparent'] as const;
    for (const bg of bgs) {
      const { unmount } = render(<Box bg={bg}>{bg}</Box>);
      expect(screen.getByText(bg)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all radius variants', () => {
    const radii = ['none', 'inner', 'element', 'container', 'page', 'full'] as const;
    for (const radius of radii) {
      const { unmount } = render(<Box radius={radius}>{radius}</Box>);
      expect(screen.getByText(radius)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all elevation variants', () => {
    const elevations = ['none', 'low', 'med', 'high'] as const;
    for (const elevation of elevations) {
      const { unmount } = render(<Box elevation={elevation}>{elevation}</Box>);
      expect(screen.getByText(elevation)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies padding prop', () => {
    const { container } = render(<Box padding="4">Padded</Box>);
    expect(container.firstChild).toHaveClass('padding4');
  });

  it('applies border prop', () => {
    const { container } = render(<Box border>Bordered</Box>);
    expect(container.firstChild).toHaveClass('border');
  });

  it('merges custom className', () => {
    const { container } = render(<Box className="extra">Box</Box>);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('passes id prop', () => {
    const { container } = render(<Box id="my-box">Box</Box>);
    expect(container.firstChild).toHaveAttribute('id', 'my-box');
  });
});
