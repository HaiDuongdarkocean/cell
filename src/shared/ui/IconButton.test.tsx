import { render, screen, fireEvent } from '@testing-library/react';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('renders an accessible button with aria-label', () => {
    render(
      <IconButton aria-label="Settings">
        <Icon name="settings" size={20} />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('renders all sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(
        <IconButton size={size} aria-label={`Size ${size}`}>
          <Icon name="settings" size={20} />
        </IconButton>,
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders both variants', () => {
    const variants = ['ghost', 'danger'] as const;
    for (const variant of variants) {
      const { unmount } = render(
        <IconButton variant={variant} aria-label={variant}>
          <Icon name="trash" size={20} />
        </IconButton>,
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(
      <IconButton aria-label="Click" onClick={onClick}>
        <Icon name="settings" size={20} />
      </IconButton>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables interaction when disabled', () => {
    render(
      <IconButton aria-label="Disabled" disabled>
        <Icon name="settings" size={20} />
      </IconButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables interaction and sets aria-busy when loading', () => {
    render(<IconButton aria-label="Loading" loading />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('applies active state', () => {
    const { container } = render(
      <IconButton active aria-label="Active">
        <Icon name="settings" size={20} />
      </IconButton>,
    );
    expect(container.firstChild).toHaveClass('activePrimary');
  });

  it('merges custom className', () => {
    const { container } = render(
      <IconButton className="extra" aria-label="Custom">
        <Icon name="settings" size={20} />
      </IconButton>,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
