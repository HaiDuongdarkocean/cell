import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the status as children by default', () => {
    render(<StatusBadge status="unknown" />);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('renders custom children when provided', () => {
    render(<StatusBadge status="known">Custom Label</StatusBadge>);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('renders as a button', () => {
    const { container } = render(<StatusBadge status="unknown" />);
    expect(container.firstChild?.nodeName).toBe('BUTTON');
  });

  it('renders all statuses', () => {
    const statuses = ['unknown', 'tracking', 'known', 'ignore'] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    }
  });

  it('merges custom className', () => {
    const { container } = render(<StatusBadge status="unknown" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<StatusBadge status="unknown" onClick={onClick} />);
    screen.getByText('unknown').click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
