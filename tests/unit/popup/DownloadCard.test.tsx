import { render, screen } from '@testing-library/react';
import { DownloadCard } from '@/popup/components/media/DownloadCard';
import type { DownloadItem } from '@/types/media';

function makeDownload(overrides?: Partial<DownloadItem>): DownloadItem {
  return {
    id: 'dl-1',
    mediaType: 'video',
    url: 'https://example.com/video.m3u8',
    title: 'Test Video',
    status: 'downloading',
    progress: 50,
    ...overrides,
  };
}

const noopHandlers = {
  onPause: jest.fn(),
  onResume: jest.fn(),
  onCancel: jest.fn(),
  onRetry: jest.fn(),
  onRemove: jest.fn(),
};

describe('DownloadCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // === Action buttons visibility ===

  it('shows pause + cancel buttons when downloading', () => {
    render(<DownloadCard download={makeDownload({ status: 'downloading', progress: 50 })} {...noopHandlers} />);
    expect(screen.getByTestId('pause-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('resume-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-btn')).not.toBeInTheDocument();
  });

  it('shows pause + cancel buttons when converting', () => {
    render(<DownloadCard download={makeDownload({ status: 'converting', progress: 30, downloadProgress: 100, convertProgress: 30 })} {...noopHandlers} />);
    expect(screen.getByTestId('pause-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('shows resume + cancel buttons when paused', () => {
    render(<DownloadCard download={makeDownload({ status: 'paused', progress: 50 })} {...noopHandlers} />);
    expect(screen.getByTestId('resume-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('pause-btn')).not.toBeInTheDocument();
  });

  it('shows retry + cancel buttons when error', () => {
    render(<DownloadCard download={makeDownload({ status: 'error', progress: 40, error: 'Network failed' })} {...noopHandlers} />);
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('remove-btn')).not.toBeInTheDocument();
  });

  it('shows only remove button when done', () => {
    render(<DownloadCard download={makeDownload({ status: 'done', progress: 100, completedAt: Date.now() + 1000, startedAt: Date.now() })} {...noopHandlers} />);
    expect(screen.getByTestId('remove-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pause-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('retry-btn')).not.toBeInTheDocument();
  });

  it('shows cancel button when queued', () => {
    render(<DownloadCard download={makeDownload({ status: 'queued', progress: 0 })} {...noopHandlers} />);
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('pause-btn')).not.toBeInTheDocument();
  });

  // === Action button clicks ===

  it('calls onPause when pause button clicked', () => {
    const onPause = jest.fn();
    render(<DownloadCard download={makeDownload({ status: 'downloading' })} {...noopHandlers} onPause={onPause} />);
    screen.getByTestId('pause-btn').click();
    expect(onPause).toHaveBeenCalledWith('dl-1');
  });

  it('calls onResume when resume button clicked', () => {
    const onResume = jest.fn();
    render(<DownloadCard download={makeDownload({ status: 'paused' })} {...noopHandlers} onResume={onResume} />);
    screen.getByTestId('resume-btn').click();
    expect(onResume).toHaveBeenCalledWith('dl-1');
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn();
    render(<DownloadCard download={makeDownload({ status: 'downloading' })} {...noopHandlers} onCancel={onCancel} />);
    screen.getByTestId('cancel-btn').click();
    expect(onCancel).toHaveBeenCalledWith('dl-1');
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    render(<DownloadCard download={makeDownload({ status: 'error' })} {...noopHandlers} onRetry={onRetry} />);
    screen.getByTestId('retry-btn').click();
    expect(onRetry).toHaveBeenCalledWith('dl-1');
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = jest.fn();
    render(<DownloadCard download={makeDownload({ status: 'done' })} {...noopHandlers} onRemove={onRemove} />);
    screen.getByTestId('remove-btn').click();
    expect(onRemove).toHaveBeenCalledWith('dl-1');
  });

  // === Two-phase progress ===

  it('renders two-phase progress when converting with downloadProgress=100', () => {
    render(
      <DownloadCard
        download={makeDownload({
          status: 'converting',
          progress: 35,
          downloadProgress: 100,
          convertProgress: 35,
          conversionPhase: 'transmuxing',
        })}
        {...noopHandlers}
      />,
    );
    // Should have "Download" phase label and "Converting" phase label
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText(/Converting/)).toBeInTheDocument();
    // Should show 100% for download phase
    expect(screen.getByText('100%')).toBeInTheDocument();
    // Should show 35% for converting phase
    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('renders single-phase progress when downloading (no two-phase)', () => {
    render(
      <DownloadCard
        download={makeDownload({ status: 'downloading', progress: 60, downloadProgress: 60 })}
        {...noopHandlers}
      />,
    );
    // Should NOT have "Download" phase label (that's only in two-phase mode)
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
    // Should show 60% progress
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders queued indicator without progress bar', () => {
    render(<DownloadCard download={makeDownload({ status: 'queued', progress: 0 })} {...noopHandlers} />);
    expect(screen.getByText('Waiting…')).toBeInTheDocument();
  });

  // === Error display ===

  it('renders error message when status is error', () => {
    render(<DownloadCard download={makeDownload({ status: 'error', progress: 40, error: 'Network timeout' })} {...noopHandlers} />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  // === Quality badge ===

  it('renders quality badge when quality is set', () => {
    render(<DownloadCard download={makeDownload({ quality: '1080p' })} {...noopHandlers} />);
    expect(screen.getByText('1080p')).toBeInTheDocument();
  });

  it('does not render quality badge when quality is undefined', () => {
    render(<DownloadCard download={makeDownload()} {...noopHandlers} />);
    // Title is present, but no quality badge
    expect(screen.getByText('Test Video')).toBeInTheDocument();
  });

  // === Phase labels ===

  it('renders conversion phase label when converting', () => {
    render(
      <DownloadCard
        download={makeDownload({
          status: 'converting',
          progress: 50,
          downloadProgress: 100,
          convertProgress: 50,
          conversionPhase: 'merging',
        })}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText(/Merging/)).toBeInTheDocument();
  });

  // === Detail items ===

  it('renders file size detail when done', () => {
    render(
      <DownloadCard
        download={makeDownload({
          status: 'done',
          progress: 100,
          fileSize: 466_000_000,
          startedAt: 1000,
          completedAt: 3000,
        })}
        {...noopHandlers}
      />,
    );
    // 466_000_000 bytes ≈ 444.4 MB — check for "MB" suffix
    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('renders worker count detail when using parallel workers', () => {
    render(
      <DownloadCard
        download={makeDownload({
          status: 'converting',
          progress: 50,
          downloadProgress: 100,
          convertProgress: 50,
          workerCount: 4,
          usedWorkers: true,
        })}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText(/4 workers/)).toBeInTheDocument();
  });

  it('renders duration detail when done with timestamps', () => {
    render(
      <DownloadCard
        download={makeDownload({
          status: 'done',
          progress: 100,
          startedAt: 1000,
          completedAt: 3000,
        })}
        {...noopHandlers}
      />,
    );
    // 2000ms = 2.0s
    expect(screen.getByText(/2.0s/)).toBeInTheDocument();
  });

  // === data-testid ===

  it('has data-testid="download-item" on the card root', () => {
    render(<DownloadCard download={makeDownload()} {...noopHandlers} />);
    expect(screen.getByTestId('download-item')).toBeInTheDocument();
  });
});
