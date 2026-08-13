import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayPreview } from '@/features/subtitle/ui/appearance/OverlayPreview';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';

describe('OverlayPreview — appearance view live preview (production composition)', () => {
  it('renders 16:9 frame with overlay root + 3-zone layout', () => {
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="Hello world"
        nativeText="Xin chào"
        onTextChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('overlay-preview')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-preview-root')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-preview-toolbar')).toBeInTheDocument();
  });

  it('renders target and native text via SubtitleBlock production component', () => {
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="Target line"
        nativeText="Native line"
        onTextChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Target line')).toBeInTheDocument();
    expect(screen.getByText('Native line')).toBeInTheDocument();
  });

  it('hides native layer when nativeStyle.visible is false', () => {
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={{ ...DEFAULT_OVERLAY_STYLE_NATIVE, visible: false }}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="Target"
        nativeText="Native"
        onTextChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.queryByText('Native')).not.toBeInTheDocument();
  });

  it('calls onTextChange when target line is edited and blurred', () => {
    const onTextChange = jest.fn();
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="Original target"
        nativeText="Native"
        onTextChange={onTextChange}
      />,
    );

    const targetLine = screen.getByTestId('overlay-preview-target-line');
    fireEvent.focus(targetLine);
    fireEvent.blur(targetLine, { target: { textContent: 'Edited target' } });

    expect(onTextChange).toHaveBeenCalledWith('target', 'Edited target');
  });

  it('calls onTextChange when native line is edited and blurred', () => {
    const onTextChange = jest.fn();
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="Target"
        nativeText="Original native"
        onTextChange={onTextChange}
      />,
    );

    const nativeLine = screen.getByTestId('overlay-preview-native-line');
    fireEvent.focus(nativeLine);
    fireEvent.blur(nativeLine, { target: { textContent: 'Edited native' } });

    expect(onTextChange).toHaveBeenCalledWith('native', 'Edited native');
  });

  it('applies yOffsetPercent as --sb-y CSS variable on overlay root', () => {
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={{ ...DEFAULT_SUBTITLE_BLOCK_SETTINGS, yOffsetPercent: 80 }}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="T"
        nativeText="N"
        onTextChange={jest.fn()}
      />,
    );

    const root = screen.getByTestId('overlay-preview-root');
    expect(root.style.getPropertyValue('--sb-y')).toBe('80');
  });

  it('renders NavCluster production component (visual only)', () => {
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="T"
        nativeText="N"
        onTextChange={jest.fn()}
      />,
    );

    const navCluster = screen.getByTestId('nav-cluster');
    expect(navCluster).toBeInTheDocument();
  });

  it('renders toolbar with production buttons (quick-add, edit-card, panel-toggle, manager-toggle, player-mode)', () => {
    render(
      <OverlayPreview
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
        clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
        targetText="T"
        nativeText="N"
        onTextChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Quick add card')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit card')).toBeInTheDocument();
    expect(screen.getByLabelText('Open subtitle list')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate native subtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('Update current card')).toBeInTheDocument();
    expect(screen.getByLabelText('Open subtitle manager')).toBeInTheDocument();
    expect(screen.getByLabelText('Enter player mode')).toBeInTheDocument();
  });
});
