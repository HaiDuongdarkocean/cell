import { render, screen } from '@testing-library/react';
import { Code } from './Code';

describe('Code', () => {
  it('renders a code element', () => {
    const { container } = render(<Code>const x = 1;</Code>);
    expect(container.querySelector('code')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders inline (not a pre/block)', () => {
    const { container } = render(<Code>inline code</Code>);
    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelector('code')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(<Code className="extra">x</Code>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
