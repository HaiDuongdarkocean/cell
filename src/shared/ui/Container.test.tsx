import { render, screen } from '@testing-library/react';
import { Container } from './Container';

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Content</Container>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders all maxWidth presets', () => {
    const widths = ['sm', 'md', 'lg', 'xl', 'full'] as const;
    for (const maxWidth of widths) {
      const { unmount } = render(<Container maxWidth={maxWidth}>{maxWidth}</Container>);
      expect(screen.getByText(maxWidth)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders with numeric maxWidth', () => {
    const { container } = render(<Container maxWidth={500}>Custom</Container>);
    expect(container.firstChild).toHaveStyle({ maxWidth: '500px' });
  });

  it('applies padding prop', () => {
    const { container } = render(<Container padding="6">Padded</Container>);
    expect(container.firstChild).toHaveClass('padding6');
  });

  it('applies center by default', () => {
    const { container } = render(<Container>Centered</Container>);
    expect(container.firstChild).toHaveClass('center');
  });

  it('disables center when center=false', () => {
    const { container } = render(<Container center={false}>Not centered</Container>);
    expect(container.firstChild).not.toHaveClass('center');
  });

  it('defaults to maxWidth lg and padding 4', () => {
    const { container } = render(<Container>Default</Container>);
    expect(container.firstChild).toHaveClass('maxWidthLg');
    expect(container.firstChild).toHaveClass('padding4');
  });

  it('merges custom className', () => {
    const { container } = render(<Container className="extra">Container</Container>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
