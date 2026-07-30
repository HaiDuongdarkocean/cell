import { render, screen } from '@testing-library/react';
import { Center } from './Center';

describe('Center', () => {
  it('renders children', () => {
    render(<Center>Centered</Center>);
    expect(screen.getByText('Centered')).toBeInTheDocument();
  });

  it('applies centering styles', () => {
    const { container } = render(<Center>Centered</Center>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ display: 'flex', alignItems: 'center', justifyContent: 'center' });
  });

  it('renders inline variant with inline-flex', () => {
    const { container } = render(<Center inline>Inline</Center>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ display: 'inline-flex' });
  });

  it('renders as a custom element', () => {
    render(<Center as="section">Section</Center>);
    expect(screen.getByText('Section').tagName).toBe('SECTION');
  });

  it('merges custom className', () => {
    const { container } = render(<Center className="extra">Centered</Center>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
