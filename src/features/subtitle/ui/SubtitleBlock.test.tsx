import { render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { useCuesStore } from '@/stores/cuesStore';
import { SubtitleBlock } from './SubtitleBlock';
import type { OverlayStyleConfig } from '@/entities/subtitle';

const makeCue = (index: number) => ({
  index,
  start: index * 1000,
  end: index * 1000 + 500,
  targetText: `target ${index}`,
  nativeText: `native ${index}`,
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

function setCues(cues: ReturnType<typeof makeCue>[], activeIndex = 0) {
  act(() => {
    useCuesStore.getState().setCues(cues);
    useCuesStore.getState().setActiveIndex(activeIndex);
  });
}

describe('SubtitleBlock', () => {
  it('renders the active target and native cue', () => {
    setCues([makeCue(0), makeCue(1)], 1);
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);

    expect(screen.getByTestId('subtitle-block')).toBeInTheDocument();
    expect(screen.getByText('target 1')).toBeInTheDocument();
    expect(screen.getByText('native 1')).toBeInTheDocument();
  });

  it('hides native layer when native style visible is false', () => {
    setCues([makeCue(0)], 0);
    const nativeStyle = { ...baseStyle, visible: false };
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={nativeStyle} />);

    expect(screen.getByText('target 0')).toBeInTheDocument();
    expect(screen.queryByText('native 0')).not.toBeInTheDocument();
  });

  it('returns null when no active cue', () => {
    setCues([], 0);
    const { container } = render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(container.firstChild).toBeNull();
  });
});
