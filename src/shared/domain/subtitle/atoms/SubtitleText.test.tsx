import { render, screen } from '@testing-library/react';
import { SubtitleText } from './SubtitleText';

describe('SubtitleText', () => {
  it('renders the subtitle text content', () => {
    render(<SubtitleText>Hello world</SubtitleText>);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('has role="text" for accessibility', () => {
    render(<SubtitleText dataTestId="sub">Test caption</SubtitleText>);
    expect(screen.getByRole('text')).toBeInTheDocument();
  });

  it('applies data-cell-id', () => {
    render(<SubtitleText dataTestId="subtitle-text">Caption</SubtitleText>);
    expect(screen.getByTestId('subtitle-text')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(
      <SubtitleText className="extra">Caption</SubtitleText>,
    );
    expect(container.firstChild).toHaveClass('extra');
  });

  it('applies background opacity via CSS variable', () => {
    const { container } = render(
      <SubtitleText backgroundOpacity={0.8}>Caption</SubtitleText>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue('--subtitle-bg-opacity')).toBe('0.8');
  });

  it('applies custom font size via CSS variable', () => {
    const { container } = render(
      <SubtitleText fontSize="var(--font-size-xl)">Caption</SubtitleText>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue('--subtitle-font-size')).toBe(
      'var(--font-size-xl)',
    );
  });
});
