import { render, screen } from '@testing-library/react';
import { TimeOffset } from './TimeOffset';

describe('TimeOffset', () => {
  it('renders positive offset with + sign in absolute format', () => {
    render(<TimeOffset offset={2.5} dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveTextContent('+2.5s');
  });

  it('renders negative offset with − sign in absolute format', () => {
    render(<TimeOffset offset={-1.5} dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveTextContent('−1.5s');
  });

  it('renders zero offset with ± sign', () => {
    render(<TimeOffset offset={0} dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveTextContent('±0.0s');
  });

  it('hides sign when showSign is false', () => {
    render(<TimeOffset offset={3.0} showSign={false} dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveTextContent('3.0s');
  });

  it('formats in relative mode as mm:ss', () => {
    render(<TimeOffset offset={65} format="relative" dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveTextContent('+1:05');
  });

  it('formats negative in relative mode', () => {
    render(<TimeOffset offset={-90} format="relative" dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveTextContent('−1:30');
  });

  it('has role="text" for accessibility', () => {
    render(<TimeOffset offset={1} />);
    expect(screen.getByRole('text')).toBeInTheDocument();
  });

  it('has aria-label with offset in seconds', () => {
    render(<TimeOffset offset={2.5} dataTestId="offset" />);
    expect(screen.getByTestId('offset')).toHaveAttribute(
      'aria-label',
      'Time offset: 2.5 seconds',
    );
  });

  it('applies positive sign class for positive offset', () => {
    const { container } = render(<TimeOffset offset={1} />);
    expect(container.querySelector('.signPositive')).toBeTruthy();
  });

  it('applies negative sign class for negative offset', () => {
    const { container } = render(<TimeOffset offset={-1} />);
    expect(container.querySelector('.signNegative')).toBeTruthy();
  });

  it('merges custom className', () => {
    const { container } = render(
      <TimeOffset offset={1} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
