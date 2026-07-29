import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { useCuesStore } from '@/stores/cuesStore';
import { SubtitleBlock } from './SubtitleBlock';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SrtCue } from '@/entities/media/types';

const makeCue = (index: number, text: string): SrtCue => ({
  index,
  start: index * 1000,
  end: index * 1000 + 500,
  text,
});

const baseStyle: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

function setCues(targetCues: SrtCue[], nativeCues: SrtCue[], targetIndex = -1, nativeIndex = -1) {
  act(() => {
    useCuesStore.getState().setCues(targetCues, nativeCues);
    useCuesStore.getState().setActiveIndex(targetIndex, nativeIndex);
  });
}

describe('SubtitleBlock', () => {
  it('renders the active target and native cue', () => {
    setCues([makeCue(0, 'target 0'), makeCue(1, 'target 1')], [makeCue(0, 'native 0'), makeCue(1, 'native 1')], 1, 1);
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);

    expect(screen.getByTestId('subtitle-block')).toBeInTheDocument();
    expect(screen.getByText('target 1')).toBeInTheDocument();
    expect(screen.getByText('native 1')).toBeInTheDocument();
  });

  it('hides native layer when native style visible is false', () => {
    setCues([makeCue(0, 'target 0')], [makeCue(0, 'native 0')], 0, 0);
    const nativeStyle = { ...baseStyle, visible: false };
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={nativeStyle} />);

    expect(screen.getByText('target 0')).toBeInTheDocument();
    expect(screen.queryByText('native 0')).not.toBeInTheDocument();
  });

  it('returns null when no active cue', () => {
    setCues([], []);
    const { container } = render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(container.firstChild).toBeNull();
  });
});
