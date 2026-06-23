import { render, screen, fireEvent } from '@testing-library/react';
import type { DetectedSubtitle } from '@/types/media';
import { SubtitleItem } from '@/popup/components/SubtitleItem';

const mockSubtitle: DetectedSubtitle = {
  id: 'sub-1',
  url: 'https://example.com/sub.en.vtt',
  format: 'vtt',
  language: 'en',
  tabId: 1,
  detectedAt: Date.now(),
};

describe('SubtitleItem', () => {
  it('renders the subtitle language', () => {
    render(<SubtitleItem subtitle={mockSubtitle} onDownload={jest.fn()} />);
    expect(screen.getByTestId('subtitle-language')).toHaveTextContent('en');
  });

  it('renders the subtitle format', () => {
    render(<SubtitleItem subtitle={mockSubtitle} onDownload={jest.fn()} />);
    expect(screen.getByTestId('subtitle-format')).toHaveTextContent('vtt');
  });

  it('renders a download button', () => {
    render(<SubtitleItem subtitle={mockSubtitle} onDownload={jest.fn()} />);
    expect(screen.getByTestId('subtitle-download')).toBeInTheDocument();
  });

  it('calls onDownload with the subtitle id when the download button is clicked', async () => {
    const onDownload = jest.fn();
    render(<SubtitleItem subtitle={mockSubtitle} onDownload={onDownload} />);

    await fireEvent.click(screen.getByTestId('subtitle-download'));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith('sub-1');
  });
});
