import { render, screen } from '@testing-library/react';
import { Kbd } from './Kbd';

describe('Kbd', () => {
  it('renders children inside a <kbd> element', () => {
    render(<Kbd>Ctrl</Kbd>);
    const el = screen.getByText('Ctrl');
    expect(el.tagName).toBe('KBD');
  });

  it('renders multiple keys', () => {
    const { container } = render(
      <>
        <Kbd>Ctrl</Kbd>
        <Kbd>+</Kbd>
        <Kbd>S</Kbd>
      </>,
    );
    const kbds = container.querySelectorAll('kbd');
    expect(kbds).toHaveLength(3);
  });

  it('merges custom className', () => {
    const { container } = render(<Kbd className="extra">Enter</Kbd>);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('passes through extra HTML attributes', () => {
    render(<Kbd data-testid="key">Shift</Kbd>);
    expect(screen.getByTestId('key')).toBeInTheDocument();
  });
});
