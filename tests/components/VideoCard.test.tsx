import { render, screen, fireEvent } from '@testing-library/react';
import type { DetectedVideo, VideoQuality } from '@/types/media';
import { VideoCard } from '@/popup/components/VideoCard';

const mockVideo: DetectedVideo = {
  id: 'video-1',
  url: 'https://example.com/video.m3u8',
  format: 'm3u8',
  title: 'Test Video',
  tabId: 1,
  tabUrl: 'https://example.com',
  detectedAt: Date.now(),
  variants: [
    { url: 'https://example.com/1080.m3u8', quality: '1080p' },
    { url: 'https://example.com/720.m3u8', quality: '720p' },
  ],
};

const singleVariantVideo: DetectedVideo = {
  ...mockVideo,
  id: 'video-single',
  variants: [{ url: 'https://example.com/720.m3u8', quality: '720p' }],
};

describe('VideoCard', () => {
  it('renders the video title', () => {
    render(
      <VideoCard
        video={mockVideo}
        onDownload={jest.fn()}
        onSelectQuality={jest.fn()}
      />,
    );

    expect(screen.getByTestId('video-title')).toHaveTextContent('Test Video');
  });

  it('renders the download button', () => {
    render(
      <VideoCard
        video={mockVideo}
        onDownload={jest.fn()}
        onSelectQuality={jest.fn()}
      />,
    );

    expect(screen.getByTestId('download-button')).toBeInTheDocument();
  });

  it('calls onDownload with video.id when the download button is clicked', () => {
    const onDownload = jest.fn();
    render(
      <VideoCard
        video={mockVideo}
        onDownload={onDownload}
        onSelectQuality={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('download-button'));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith('video-1');
  });

  it('renders a quality selector when there are multiple variants', () => {
    render(
      <VideoCard
        video={mockVideo}
        onDownload={jest.fn()}
        onSelectQuality={jest.fn()}
      />,
    );

    const select = screen.getByTestId('quality-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // Two quality options should be present
    expect(select.options.length).toBe(2);
    expect(select.options[0].textContent).toBe('1080p');
    expect(select.options[1].textContent).toBe('720p');
  });

  it('does not render a quality selector when there is a single variant', () => {
    render(
      <VideoCard
        video={singleVariantVideo}
        onDownload={jest.fn()}
        onSelectQuality={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('quality-select')).not.toBeInTheDocument();
  });

  it('calls onSelectQuality with video.id and the selected quality on change', () => {
    const onSelectQuality = jest.fn();
    render(
      <VideoCard
        video={mockVideo}
        onDownload={jest.fn()}
        onSelectQuality={onSelectQuality}
      />,
    );

    const select = screen.getByTestId('quality-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '720p' } });

    expect(onSelectQuality).toHaveBeenCalledTimes(1);
    expect(onSelectQuality).toHaveBeenCalledWith('video-1', '720p' as VideoQuality);
  });
});
