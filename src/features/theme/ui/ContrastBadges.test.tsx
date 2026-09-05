import { render, screen } from '@testing-library/react';
import { ContrastBadges } from '@/features/theme/ui/ContrastBadges';
import { validateTheme } from '@/features/theme/logic/contrastValidator';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';

describe('ContrastBadges', () => {
  it('renders 3 badges for 3 pairs', () => {
    const result = validateTheme(DEFAULT_THEME_CONFIG.customColors.light);
    render(<ContrastBadges result={result} />);
    expect(screen.getByTestId('contrast-badges')).toBeInTheDocument();
    expect(screen.getByTestId('contrast-badge-Text / Canvas')).toBeInTheDocument();
    expect(screen.getByTestId('contrast-badge-Text Secondary / Canvas')).toBeInTheDocument();
    expect(screen.getByTestId('contrast-badge-Primary Foreground / Primary')).toBeInTheDocument();
  });

  it('badge shows ratio + level as visible text (keyboard-accessible)', () => {
    const result = validateTheme(DEFAULT_THEME_CONFIG.customColors.light);
    render(<ContrastBadges result={result} />);
    const badge = screen.getByTestId('contrast-badge-Text / Canvas');
    expect(badge.textContent).toMatch(/Text \/ Canvas:.*:1/);
  });

  it('shows Fail badge when contrast fails', () => {
    const bad = { ...DEFAULT_THEME_CONFIG.customColors.light, text: '#ffffff' };
    const result = validateTheme(bad);
    render(<ContrastBadges result={result} />);
    const badge = screen.getByTestId('contrast-badge-Text / Canvas');
    expect(badge.textContent).toContain('Fail');
  });
});
