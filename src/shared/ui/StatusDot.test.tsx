import { render } from '@testing-library/react';
import { StatusDot } from './StatusDot';

describe('StatusDot', () => {
  it('renders a span with role=img', () => {
    const { container } = render(<StatusDot status="success" aria-label="Online" />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveAttribute('role', 'img');
  });

  it('requires aria-label', () => {
    const { container } = render(<StatusDot status="success" aria-label="Online" />);
    expect(container.firstChild).toHaveAttribute('aria-label', 'Online');
  });

  it('renders all status variants', () => {
    const statuses = ['success', 'warning', 'error', 'info', 'neutral'] as const;
    for (const status of statuses) {
      const { container, unmount } = render(
        <StatusDot status={status} aria-label={status} />,
      );
      expect(container.firstChild).toHaveClass(status);
      unmount();
    }
  });

  it('applies pulse class when pulse is true', () => {
    const { container } = render(<StatusDot pulse aria-label="Live" />);
    expect(container.firstChild).toHaveClass('pulse');
  });

  it('does not apply pulse class by default', () => {
    const { container } = render(<StatusDot aria-label="Static" />);
    expect(container.firstChild).not.toHaveClass('pulse');
  });

  it('merges custom className', () => {
    const { container } = render(<StatusDot className="extra" aria-label="Custom" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
