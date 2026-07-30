import { render, screen } from '@testing-library/react';
import { TrackLabel } from './TrackLabel';

describe('TrackLabel', () => {
  it('renders the label and srclang', () => {
    render(<TrackLabel label="English" srclang="en" active={false} />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('sets aria-current="true" when active', () => {
    render(
      <TrackLabel
        label="English"
        srclang="en"
        active={true}
        dataTestId="track"
      />,
    );
    expect(screen.getByTestId('track')).toHaveAttribute('aria-current', 'true');
  });

  it('does not set aria-current when inactive', () => {
    render(
      <TrackLabel
        label="English"
        srclang="en"
        active={false}
        dataTestId="track"
      />,
    );
    expect(screen.getByTestId('track')).not.toHaveAttribute('aria-current');
  });

  it('shows active dot indicator when active', () => {
    const { container } = render(
      <TrackLabel label="English" srclang="en" active={true} />,
    );
    expect(container.querySelector('.dot')).toBeTruthy();
  });

  it('does not show active dot when inactive', () => {
    const { container } = render(
      <TrackLabel label="English" srclang="en" active={false} />,
    );
    expect(container.querySelector('.dot')).toBeNull();
  });

  it('applies active class when active', () => {
    const { container } = render(
      <TrackLabel label="English" srclang="en" active={true} />,
    );
    expect(container.firstChild).toHaveClass('active');
  });

  it('applies data-testid', () => {
    render(
      <TrackLabel
        label="English"
        srclang="en"
        active={false}
        dataTestId="track-label"
      />,
    );
    expect(screen.getByTestId('track-label')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(
      <TrackLabel
        label="English"
        srclang="en"
        active={false}
        className="extra"
      />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
