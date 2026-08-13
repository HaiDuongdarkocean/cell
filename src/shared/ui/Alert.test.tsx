import { render, screen, fireEvent } from '@testing-library/react';
import { Alert } from './Alert';

const TestIcon = () => <svg data-cell-id="test-icon" />;

describe('Alert', () => {
  it('renders all variants', () => {
    const variants = ['default', 'success', 'warning', 'error'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Alert variant={variant} title={variant} description="Message" />);
      expect(screen.getByRole('alert')).toHaveTextContent(variant);
      unmount();
    }
  });

  it('renders with status role', () => {
    render(<Alert role="status" title="Status" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls onDismiss when dismissed', () => {
    const onDismiss = jest.fn();
    render(<Alert title="Title" description="Desc" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a leading icon', () => {
    render(<Alert variant="error" icon={<TestIcon />} description="Error" />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Error');
  });
});
