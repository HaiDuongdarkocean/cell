import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders primary button by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('renders all variants', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>{size}</Button>);
      expect(screen.getByRole('button', { name: size })).toBeInTheDocument();
      unmount();
    }
  });

  it('supports Apple-inspired liquid glass styles on glass buttons', () => {
    const liquidStyles = [
      ['regular', 'liquidRegular'],
      ['clear', 'liquidClear'],
      ['prominent', 'liquidProminent'],
    ] as const;
    for (const [liquidStyle, className] of liquidStyles) {
      const { unmount } = render(<Button variant="glass" liquidStyle={liquidStyle}>Liquid</Button>);
      expect(screen.getByRole('button', { name: 'Liquid' })).toHaveClass(className);
      unmount();
    }
  });

  it('does not expose liquidStyle as a DOM attribute on non-glass buttons', () => {
    render(<Button variant="primary" liquidStyle="clear">Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).not.toHaveAttribute('liquidstyle');
    expect(button).not.toHaveClass('liquidClear');
  });

  it('disables and sets aria-busy when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button', { name: 'Loading' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disables when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders leading and trailing icons', () => {
    render(
      <Button leadingIcon={<span data-cell-id="leading">L</span>} trailingIcon={<span data-cell-id="trailing">T</span>}>
        Label
      </Button>,
    );
    expect(screen.getByTestId('leading')).toBeInTheDocument();
    expect(screen.getByTestId('trailing')).toBeInTheDocument();
  });

  it('auto-switches to circle and iconOnly when only an icon is provided', () => {
    const { container } = render(<Button aria-label="Icon only"><span data-cell-id="icon">I</span></Button>);
    expect(container.firstChild).toHaveClass('circle');
    expect(container.firstChild).toHaveClass('iconOnly');
  });

  it('supports transparent variant', () => {
    render(<Button variant="transparent">Transparent</Button>);
    expect(screen.getByRole('button', { name: 'Transparent' })).toBeInTheDocument();
  });
});
