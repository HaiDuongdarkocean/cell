import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { ProgressBar } from '@/popup/components/ProgressBar';
import type { DownloadStatus } from '@/types/media';

describe('ProgressBar', () => {
  it('renders with 0% progress', () => {
    render(<ProgressBar progress={0} status="queued" />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toBeInTheDocument();
    expect(fill.style.width).toBe('0%');
  });

  it('renders with 50% progress (fill width 50%)', () => {
    render(<ProgressBar progress={50} status="downloading" />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill.style.width).toBe('50%');
  });

  it('renders with 100% progress', () => {
    render(<ProgressBar progress={100} status="done" />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('shows correct status text', () => {
    const status: DownloadStatus = 'downloading';
    render(<ProgressBar progress={42} status={status} />);
    const statusEl = screen.getByTestId('progress-status');
    expect(statusEl).toHaveTextContent('downloading');
  });

  it('done status shows success color class', () => {
    render(<ProgressBar progress={100} status="done" />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill.className).toMatch(/done/);
  });

  it('renders the progress bar container', () => {
    render(<ProgressBar progress={25} status="downloading" />);
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });
});
