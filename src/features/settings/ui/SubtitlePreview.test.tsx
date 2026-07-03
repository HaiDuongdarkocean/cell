import { render, screen } from '@testing-library/react';
import { SubtitlePreview } from '@/features/settings/ui/SubtitlePreview';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { OverlayStyleConfig } from '@/entities/subtitle';

describe('SubtitlePreview — settings-controls-restyle spec F4', () => {
  it('renders sample text with role label', () => {
    render(<SubtitlePreview style={DEFAULT_OVERLAY_STYLE_TARGET} role="target" />);
    expect(screen.getByTestId('subtitle-preview-target')).toBeInTheDocument();
    expect(screen.getByText(/This is how the target subtitle will look/i)).toBeInTheDocument();
  });

  it('renders native role text', () => {
    render(<SubtitlePreview style={DEFAULT_OVERLAY_STYLE_NATIVE} role="native" />);
    expect(screen.getByText(/This is how the native subtitle will look/i)).toBeInTheDocument();
  });

  it('applies fontSize from style config', () => {
    const config: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: 32 };
    render(<SubtitlePreview style={config} role="target" />);
    const box = screen.getByTestId('subtitle-preview-target');
    expect(box.style.fontSize).toBe('32px');
  });

  it('applies textColor from style config', () => {
    const config: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_TARGET, textColor: '#ff0000' };
    render(<SubtitlePreview style={config} role="target" />);
    expect(screen.getByTestId('subtitle-preview-target').style.color).toBe('rgb(255, 0, 0)');
  });

  it('converts hex bg + alpha to rgba string', () => {
    const config: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_TARGET, backgroundColor: '#000000', backgroundOpacity: 0.5 };
    render(<SubtitlePreview style={config} role="target" />);
    expect(screen.getByTestId('subtitle-preview-target').style.background).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('applies textShadow when preset != none', () => {
    const config: OverlayStyleConfig = {
      ...DEFAULT_OVERLAY_STYLE_TARGET,
      textShadow: { preset: 'soft', color: '#000000', blur: 4, offsetX: 1, offsetY: 1 },
    };
    render(<SubtitlePreview style={config} role="target" />);
    expect(screen.getByTestId('subtitle-preview-target').style.textShadow).toBe('1px 1px 4px #000000');
  });

  it('returns none for textShadow when preset = none', () => {
    const config: OverlayStyleConfig = {
      ...DEFAULT_OVERLAY_STYLE_TARGET,
      textShadow: { preset: 'none', color: '#000000', blur: 0, offsetX: 0, offsetY: 0 },
    };
    render(<SubtitlePreview style={config} role="target" />);
    expect(screen.getByTestId('subtitle-preview-target').style.textShadow).toBe('none');
  });

  it('applies fontFamily from style config', () => {
    const config: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_TARGET, fontFamily: 'serif' };
    render(<SubtitlePreview style={config} role="target" />);
    expect(screen.getByTestId('subtitle-preview-target').style.fontFamily).toBe('serif');
  });
});
